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
- `security/frontrun_protection.rs`: Anti-front-running measures and commitment schemes

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

### Administration
- `initialize()`: Initialize the contract
- `update_fee_config()`: Update fee configuration
- `emergency_withdraw()`: Emergency withdrawal (admin only)
- `withdraw_platform_fees()`: Withdraw accumulated platform fees

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
- **Arbitration**: Multi-signature dispute resolution

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
- **Emergency Controls**: Admin emergency withdrawal capabilities

## Events

The contract emits comprehensive events for all operations:
- Sale events (created, executed, cancelled)
- Auction events (created, bid placed, ended, extended)
- Trade events (created, accepted, executed)
- Royalty and fee events
- Dispute events
- Security events

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