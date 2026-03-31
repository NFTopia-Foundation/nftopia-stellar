# transaction_contract

Soroban smart contract for comprehensive transaction orchestration on the Stellar blockchain.  Part of the [NFTopia](https://github.com/NFTopia-Foundation/nftopia-stellar) monorepo.

## Overview

`transaction_contract` acts as the **central transaction coordinator** for all complex multi-step NFT workflows — minting, trading, bundling, and cross-contract calls — across the NFTopia ecosystem.  It provides:

- **Atomic multi-operation execution** — all steps succeed or all are rolled back automatically
- **Dependency-aware scheduling** — operations declare which prior ops must complete first
- **Gas estimation & ceiling enforcement** — pre-flight cost prediction with configurable hard limits
- **Full state machine lifecycle** — Draft → Pending → Executing → Completed / Failed / RolledBack / Cancelled
- **Signature collection & verification** — multi-signer support for critical operations
- **Batch create & execute** — process up to 10 transactions in a single call
- **Recovery strategies** — Retry, Rollback, Cancel on failed transactions
- **Immutable audit trail** — every state transition is recorded on-chain via `state_store`
- **Typed events** — `TransactionCreated`, `TransactionStateChanged`, `TransactionFailed`

## Module Structure

```
src/
├── lib.rs                       # Crate root, module declarations, re-exports
├── transaction_core.rs          # #[contract] entry point — all public functions
├── operation_manager.rs         # Operation validation and orchestration helpers
├── execution_engine.rs          # Dependency-safe operation execution helpers
├── state_machine.rs             # State transition validation rules
├── gas_optimizer.rs             # Gas estimation/reordering helpers
├── dependency_resolver.rs       # Operation dependency checks and ordering
├── signature_manager.rs         # Signature append/verification helpers
├── recovery_system.rs           # Recovery strategy application helpers
├── types.rs                     # #[contracttype] structs and enums
├── error.rs                     # #[contracterror] enum
├── events.rs                    # #[contractevent] structs + publish helpers
├── tx_storage.rs                # DataKey enum, save/load helpers, ID counter
├── security/
│   ├── mod.rs
│   ├── atomic_execution.rs      # All-or-nothing result resolution
│   ├── validation_engine.rs     # Pre-flight checks (state, uniqueness, deps)
│   ├── permission_checker.rs    # Creator / signer auth assertions
│   └── resource_guard.rs        # Operation count, param count, gas ceiling limits
├── storage/
│   ├── mod.rs
│   ├── transaction_store.rs     # Persistent map of Transaction by ID
│   ├── operation_store.rs       # Persistent map of Operation by (tx_id, op_id)
│   ├── state_store.rs           # Append-only state-transition history log
│   └── cache_store.rs           # Instance-scoped gas-estimate cache
├── utils/
│   ├── mod.rs
│   ├── gas_calculator.rs        # Deterministic gas cost model
│   ├── parameter_encoder.rs     # Encode/decode typed Parameter payloads
│   ├── time_manager.rs          # Timestamp helpers, expiry checks
│   └── error_handler.rs         # Error → human-readable String mapping
└── test.rs                      # Full unit + integration test suite
```

## Supported Operation Types

| Variant | Description |
|---|---|
| `NftMint` | Mint a new NFT |
| `NftTransfer` | Transfer ownership |
| `NftApprove` | Grant operator approval |
| `MarketplaceList` | Create a marketplace listing |
| `MarketplaceBid` | Place a bid |
| `SettlementEscrow` | Lock funds in escrow |
| `SettlementRelease` | Release escrowed funds |
| `PaymentTransfer` | Raw token payment |
| `RoyaltyDistribution` | Distribute royalties to creators |
| `MetadataUpdate` | Update NFT metadata |
| `VerificationCheck` | On-chain verification assertion |

## Key Contract Functions

```rust
// --- Transaction lifecycle ---
create_transaction(env, creator, metadata, initial_operations) -> u64
add_operation(env, transaction_id, operation) -> u64
execute_transaction(env, transaction_id, max_gas, optimization_config) -> ExecutionResult
cancel_transaction(env, transaction_id, reason)
recover_transaction(env, transaction_id, recovery_strategy) -> RecoveryResult
get_transaction_status(env, transaction_id) -> TransactionStatus

// --- Estimation & optimisation ---
estimate_transaction_gas(env, transaction_id) -> GasEstimate
optimize_transaction_flow(env, transaction_id, config) -> GasOptimizationConfig

// --- Signatures ---
add_signature(env, transaction_id, signer, signature_bytes)
verify_signatures(env, transaction_id) -> bool

// --- Batch ---
batch_create_transactions(env, blueprints) -> Vec<u64>
batch_execute_transactions(env, transaction_ids, optimization_config) -> BatchExecutionResult
```

## Build

```bash
# Compile to WASM
make build
# or
cargo build --target wasm32-unknown-unknown --release

# Unit tests (native)
make test

# Lint
make lint
```

## Deploy (Testnet)

```bash
soroban contract deploy \
  --wasm ../../target/wasm32-unknown-unknown/release/transaction_contract.wasm \
  --source $STELLAR_SECRET_KEY \
  --network testnet \
  --rpc-url $SOROBAN_RPC_URL
```

## Transaction States

```
Draft ──► Pending ──► Executing ──► Completed
                          │
                          ├──► Failed ──► RolledBack
                          │
                          └──► PartiallyComplete
             │
             └──► Cancelled   (any non-finalised state)
```

## Resource Limits

| Limit | Value |
|---|---|
| Max operations per transaction | 50 |
| Max parameters per operation | 20 |
| Max transactions per batch | 10 |
| Default gas ceiling | 100,000 |

## License

MIT — see root [`LICENSE`](../../LICENSE).
