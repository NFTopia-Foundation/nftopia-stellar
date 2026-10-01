# Transaction architecture decision

## Decision

Keep `transaction_contract` and the backend transaction module as separate
components, but do not describe the Soroban contract as the platform's
transaction executor. The backend remains the system of record and execution
orchestrator for marketplace transactions. The contract is an on-chain
lifecycle/audit coordinator for workflows that explicitly need a public,
contract-addressable state record.

This clarifies the boundary; it does not migrate transaction execution.
Existing backend calls to the contract remain in place until a separately
reviewed change defines their compatibility and failure behavior.

## Responsibilities today

| Concern | Backend (`nftopia-backend`) | Soroban `transaction_contract` |
| --- | --- | --- |
| API validation, user/session authorization, and request lifecycle | Owns | Not responsible |
| PostgreSQL transaction records, marketplace entities, retries, and recovery work | Owns | Not responsible |
| Stellar transaction construction, signing, RPC submission, and confirmation | Owns through the Stellar service | Does not submit Stellar transactions |
| Workflow metadata, operation list, lifecycle state, and contract events | Calls `TransactionContractClient` and persists backend records | Stores and validates its own on-chain record, state transitions, signatures, estimates, and events |
| Atomic execution of listed marketplace operations | Not atomic across PostgreSQL and Soroban | **Not implemented**: `execute_transaction` validates dependencies/resource limits and records successful operation results; it does not dispatch those operations to other contracts |

The backend client is used by `TransactionService` when creating and executing
marketplace transactions. It invokes contract methods through `SorobanService`;
it is an active integration, not a frontend SDK requirement. The backend
remains authoritative for whether a marketplace operation was actually built,
submitted, confirmed, or retried. A successful contract lifecycle state must
not be treated as proof of external operation execution.

## Client guidance

Clients should call the backend transaction APIs for marketplace workflows.
They should not call `transaction_contract` directly to create or execute
marketplace operations. Direct contract interaction is appropriate only for
tools that inspect its on-chain record/events and understand that those records
are not the backend's source of truth.

## Follow-up work to track separately

1. Decide whether `TransactionContractClient` is mandatory, best-effort, or
   enabled only for selected workflows; specify behavior when Soroban is
   unavailable and add failure-path tests before changing current behavior.
2. Either implement real operation dispatch/authorization in the contract or
   rename/restrict its execute API and documentation so simulated completion
   cannot be mistaken for on-chain execution.
3. Add reconciliation tests for backend state versus contract state, including
   submission failure, retry, and partial workflow recovery.

These items are intentionally not bundled into this documentation change:
each affects runtime behavior or contract compatibility and needs its own
design, tests, and migration review.

## Source references

- Backend integration: `nftopia-backend/src/modules/stellar/transaction-contract.client.ts`
- Backend orchestration: `nftopia-backend/src/modules/transaction/transaction.service.ts`
- Contract entry points: `nftopia-stellar/contracts/transaction_contract/src/transaction_core.rs`
- Contract overview: `nftopia-stellar/contracts/transaction_contract/README.md`
