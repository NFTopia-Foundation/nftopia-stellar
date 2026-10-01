# Marketplace Settlement Smart Contract

A comprehensive Soroban smart contract for secure NFT marketplace settlement on the Stellar blockchain.

## Overview

This contract implements a secure, efficient marketplace settlement system with the following features:

- **Atomic Swaps**: Either both sides of transactions succeed or both fail
- **Multi-Asset Support**: Handle XLM and other Stellar assets as payment
- **Escrow Management**: Secure holding of funds and NFTs during settlement
- **Royalty Distribution**: Automatic splitting of payments to creators, sellers, and platform
- **Auction Mechanics**: Support for English and Dutch auctions with reserve prices
- **Dispute Resolution**: Time-based releases with arbitration support
- **Security Features**: Reentrancy guards, front-running protection, and commitment schemes

## Key Components

### Core Contracts
- `settlement_core.rs`: Main contract functions and public API
- `atomic_swap.rs`: Atomic swap engine and escrow management
- `auction_engine.rs`: Auction mechanics and bidding system
- `royalty_distributor.rs`: Royalty calculation and distribution
- `fee_manager.rs`: Platform fee management and dynamic pricing
- `dispute_resolution.rs`: Dispute handling and arbitration

### Security
- `security/reentrancy_guard.rs`: Protection against reentrant calls
- `security/frontrun_protection.rs`: Anti-front-running measures, commitment schemes and withdrawal anomaly monitoring

### Utilities
- `utils/math_utils.rs`: Safe mathematical operations
- `utils/time_utils.rs`: Time-based calculations and validation
- `utils/asset_utils.rs`: Asset handling and validation

### Storage
- `storage/transaction_store.rs`: Transaction data management
- `storage/auction_store.rs`: Auction data management
- `storage/dispute_store.rs`: Dispute data management

## Public Functions

### Sales
- `create_sale()`: Create a fixed-price NFT sale
- `execute_sale()`: Execute a sale transaction
- `cancel_transaction()`: Cancel a pending transaction

### Auctions
- `create_auction()`: Create an auction (English or Dutch)
- `place_bid()`: Place a bid on an auction
- `reveal_bid()`: Reveal a committed bid
- `end_auction()`: End an auction and determine winner

### Trades
- `create_trade()`: Create an NFT-for-NFT trade
- `accept_trade()`: Accept a trade offer
- `execute_trade()`: Execute a trade

### Disputes
- `initiate_dispute()`: Start a dispute for a transaction
- `vote_on_dispute()`: Vote on an active dispute
- `execute_dispute_resolution()`: Execute dispute resolution

### Swap Timeouts
- `cleanup_expired_swaps()`: Sweep expired swaps, refunding escrow (permissionless)
- `expire_swap()`: Expire one swap by transaction id (permissionless)
- `reclaim_expired_escrow()`: Reclaim holdings past their escrow backstop (permissionless)
- `get_atomic_swap()`: Read a transaction's atomic swap, including its deadlines
- `get_swap_time_remaining()`: Seconds left before a swap's deadline
- `get_swap_timeout_config()`: Read the timeout policy in force

### Administration
- `initialize()`: Initialize the contract with a fee config and, optionally, a swap
  timeout policy
- `update_fee_config()`: Update fee configuration
- `update_swap_timeout_config()`: Update the swap timeout policy (admin only)
- `emergency_withdraw()`: Emergency withdrawal (admin only)
- `withdraw_platform_fees()`: Withdraw accumulated platform fees

## Withdrawal anomaly monitoring

`security/frontrun_protection.rs` evaluates every withdrawal attempt against the
account's own recent history. The monitor is **not** a no-op: each attempt is
recorded, classified, and then allowed, flagged, or held.

### Criteria

| Criterion       | Trigger                                                                                                                                                                                                  | Outcome      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Velocity        | More than `max_withdrawals_per_window` withdrawals (default 5) inside the trailing `window_seconds` (default 3600s)                                                                                       | **Held**     |
| Rapid sequence  | Less than `min_withdrawal_gap_seconds` (default 5s) since the account's previous withdrawal                                                                                                               | **Held**     |
| Amount spike    | At least `min_history_for_spike` (default 3) prior withdrawals **and** amount > `spike_multiplier` (default 10x) the account's historical average **and** amount >= `min_spike_amount` (default 1000)     | **Flagged**  |

Criteria are checked in that order and the first match wins. The absolute
`min_spike_amount` floor stops dust-sized withdrawals from tripping the ratio
check.

### Response

| Decision        | Meaning                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Allowed`       | Normal pattern; the withdrawal may proceed.                                                                                                                                                                              |
| `Flagged(kind)` | Suspicious but permitted. The attempt is recorded and a `WithdrawalAnomalyEvent` with `blocked = false` is emitted so operators can alert on it.                                                                          |
| `Held(kind)`    | Blocked. A `WithdrawalHold` is written for the account and a `WithdrawalAnomalyEvent` with `blocked = true` is emitted. The account cannot withdraw again - even with a well-spaced, small amount - until an operator clears the hold. |

A held account can never lift its own hold: `clear_hold` is a library function
that entrypoints must gate behind an admin/operator authorization check.
Clearing a hold deliberately keeps the rolling history, so an auditor can still
see what happened after the fact.

### Configuration

- Defaults are active before any admin configuration, so monitoring cannot be
  silently off.
- `set_config` rejects thresholds that would disable detection: zero window,
  zero limits, a negative spike floor, or a `history_limit` smaller than
  `max_withdrawals_per_window` (which would trim away the very entries the
  velocity check counts).
- Storage: the config lives in instance storage; per-account history and holds
  live in persistent storage with TTL extension.

## Data Structures

### Transactions
- `SaleTransaction`: Fixed-price sales
- `AuctionTransaction`: Auction data
- `TradeTransaction`: NFT-for-NFT trades
- `BundleTransaction`: Multi-item sales

### Assets & Payments
- `Asset`: Asset representation
- `RoyaltyDistribution`: Royalty payment distribution
- `FeeConfig`: Fee configuration

### Security
- `Bid`: Bid data with commitment support
- `Dispute`: Dispute information
- `EscrowHolding`: Escrow holdings

## Usage Examples

### Creating a Sale
```rust
let transaction_id = contract.create_sale(
    seller,
    nft_contract,
    token_id,
    price,
    currency,
    duration_seconds
);
```

### Placing a Bid
```rust
contract.place_bid(
    auction_id,
    bidder,
    bid_amount,
    None // or Some(commitment_hash)
);
```

### Executing a Sale
```rust
let result = contract.execute_sale(
    transaction_id,
    buyer,
    payment_amount
);
```

## Security Features

- **Reentrancy Protection**: Guards against reentrant calls
- **Front-Running Protection**: Commit-reveal schemes for bids
- **Atomic Swaps**: All-or-nothing transaction execution
- **Escrow Security**: Secure fund holding during settlement
- **Swap Timeouts**: Deadlines enforced against both ledger timestamps and ledger
  sequence numbers, with a per-holding escrow backstop (see below)
- **Arbitration**: Multi-signature dispute resolution

## Swap Timeouts and Mainnet Ledger Variability

Mainnet ledger close intervals vary and `env.ledger().timestamp()` reports the close
time of the current ledger rather than a real-world clock, so time-based expiry needs
more than one timestamp comparison. Every atomic swap therefore carries two deadlines:
`expires_at` (a timestamp) and `expires_at_ledger` (the ledger sequence the same
deadline is projected to fall on, at ~5s per ledger).

The two are used for different things:

- **Rejecting operations** — `deposit_to_escrow` and `execute_swap` fail with
  `SwapExpired` once the timestamp passes `expires_at + grace_period_seconds`. A
  rejection is reversible (the escrow stays refundable), so the timestamp alone is
  enough. The grace period covers the delay between transaction submission and ledger
  inclusion, so a transaction submitted just inside its deadline is not falsely
  expired.
- **Confirming an expiry** — `expire_swap` and `cleanup_expired_swaps` additionally
  require `ledger_tolerance_blocks` ledgers to close past `expires_at_ledger`, so
  neither a drifting timestamp nor an unusually slow stretch of ledger closes can
  force an irreversible refund on its own. Until both clocks agree they return
  `NotYetExpired`.

Escrow can never be locked indefinitely. Each `EscrowHolding` carries
`escrow_expires_at` (swap expiry + grace + `escrow_buffer_seconds`); past that point
`reclaim_expired_escrow` returns the assets to their depositors regardless of swap
state and regardless of the ledger-sequence check. Every refund path marks
`released_at`, so the several entrypoints (cancel, expire, cleanup, reclaim,
emergency) can be called in any order without paying a holder twice.

`SwapExpired` and `SwapAutoRefunded` events are emitted for off-chain monitoring of
timeout-driven refunds.

`cleanup_expired_swaps` and `expire_swap` respect the pause circuit breaker, like
`cancel_transaction`. `reclaim_expired_escrow` deliberately does not: it is a
last-resort recovery path like `emergency_withdraw`, and gating it would let a paused
contract hold deposits past every deadline.

Timeout error codes live in a separate `SwapTimeoutError` enum (`SwapExpired`,
`NotYetExpired`, `SwapAlreadyFinalized`, `InvalidSwapDuration`,
`InvalidTimeoutConfig`) because `SettlementError` is at the 50-case spec limit. They
are converted into `SettlementError` at the contract boundary — `SwapExpired` surfaces
as `TransactionExpired`, `NotYetExpired` as `InvalidState`, `SwapAlreadyFinalized` as
`InvalidTransactionState`, `InvalidSwapDuration` as `InvalidAmount`.

The policy is set by `SwapTimeoutConfig`, supplied at `initialize()` or updated by the
admin via `update_swap_timeout_config()`:

| Field | Default | Purpose |
| --- | --- | --- |
| `max_swap_duration` | 30 days | Ceiling on a swap's lifetime |
| `default_swap_duration` | 7 days | Applied when a caller passes a 0 timeout |
| `grace_period_seconds` | 300 | Ledger-inclusion latency tolerance |
| `ledger_tolerance_blocks` | 5 | Ledgers past projected expiry before confirming |
| `escrow_buffer_seconds` | 86400 | Added to swap expiry for the escrow backstop |

## Testing

Run tests with:
```bash
cargo test
```

## Building

Build the contract with:
```bash
cargo build --target wasm32-unknown-unknown --release
```

## Deployment

Deploy to Stellar network using Soroban CLI:
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/marketplace_settlement.wasm \
  --source <your-secret-key>
```

## Configuration

The contract supports extensive configuration:

- **Fee Management**: Dynamic fees based on volume and user tiers
- **Auction Settings**: Configurable durations, increments, and extensions
- **Dispute Resolution**: Customizable arbitration parameters
- **Royalty Enforcement**: Automatic royalty distribution
- **Swap Timeouts**: Configurable swap lifetime, grace period, ledger tolerance, and
  escrow backstop
- **Emergency Controls**: Admin emergency withdrawal capabilities

## Events

The contract emits comprehensive events for all operations:
- Sale events (created, executed, cancelled)
- Auction events (created, bid placed, ended, extended)
- Trade events (created, accepted, executed)
- Royalty and fee events
- Dispute events
- Security events
- Swap timeout events (expired, auto-refunded, timeout config updated)

## Error Handling

Comprehensive error types for all failure scenarios:
- Authorization errors
- State validation errors
- Payment validation errors
- Mathematical operation errors
- Security violation errors

## Future Enhancements

- Batch operations for efficiency
- Cross-chain settlement support
- Advanced auction types (sealed-bid, Vickrey)
- Reputation-based fee discounts
- Automated market making integration
- Multi-signature escrow options