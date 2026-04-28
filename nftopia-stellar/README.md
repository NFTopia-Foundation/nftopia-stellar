# NFTopia Soroban Contracts
**Stellar Smart-Contract Workspace**

![Rust](https://img.shields.io/badge/Rust-Contracts-b7410e)
![Soroban](https://img.shields.io/badge/Soroban-SDK%2023-0f766e)
![WASM](https://img.shields.io/badge/WASM-Build%20Target-334155)
![Stellar](https://img.shields.io/badge/Stellar-Testnet%20%2F%20Mainnet-111827)

NFTopia Soroban Contracts is the on-chain workspace for collection creation, marketplace settlement, and transaction orchestration on Stellar. It is organized as a Cargo workspace with multiple contract packages under `contracts/`, plus helper scripts for deployment and verification.

## 🌟 Key Features

- **Multi-package workspace** using a shared Soroban SDK dependency
- **Collection factory contract** for creating and tracking NFT collections
- **Marketplace settlement package** with royalties, fees, disputes, and security helpers
- **Transaction contract package** for execution, recovery, validation, and storage flows
- **Deployment helper scripts** for installing and initializing the collection factory

## 📋 Table of Contents

1. [Workspace Architecture](#-workspace-architecture)
2. [Contract Packages](#-contract-packages)
3. [Prerequisites](#-prerequisites)
4. [Build and Test](#-build-and-test)
5. [Deploy and Verify](#-deploy-and-verify)
6. [Project Structure](#-project-structure)
7. [Security Notes](#-security-notes)
8. [Repository Notes](#-repository-notes)

## 🏗️ Workspace Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                    NFTopia Soroban Workspace                    │
├──────────────────────────────────────────────────────────────────┤
│ Cargo workspace root                                            │
│  resolver = "2"                                                 │
│  members = contracts/*                                          │
├──────────────────────────────────────────────────────────────────┤
│ Contract packages                                                │
│  collection_factory      marketplace_settlement                 │
│  transaction_contract    nft_contract                           │
├──────────────────────────────────────────────────────────────────┤
│ Scripts                                                          │
│  deploy_factory.sh        verify_contract.sh                    │
└──────────────────────────────────────────────────────────────────┘
```

## 🧩 Contract Packages

| Package | What it contains |
| --- | --- |
| `collection_factory` | Factory, collection module, storage, events, error and types modules for collection deployment and tracking |
| `marketplace_settlement` | Settlement core, atomic swap, auction engine, dispute resolution, royalty distribution, fee management, storage, utility, and security modules |
| `transaction_contract` | Transaction core, execution engine, dependency resolution, signature management, recovery, storage, and security helpers |
| `nft_contract` | Present in the workspace but currently scaffolded compared with the other packages |

## 🧰 Prerequisites

- Rust toolchain
- `wasm32-unknown-unknown` target
- Soroban CLI
- A configured Soroban identity for deployment

Typical setup:

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
```

## 🏗️ Build and Test

Build the full workspace:

```bash
cd nftopia-stellar
cargo build --workspace
```

Build a specific package for release WASM output:

```bash
cargo build --target wasm32-unknown-unknown --release --package collection_factory
```

Run tests:

```bash
cargo test --workspace
```

The workspace root also defines an optimized `release` profile and a `release-with-logs` profile for debugging.

## 🚀 Deploy and Verify

Helper scripts are provided for the collection factory package.

### Deploy the collection factory

```bash
cd nftopia-stellar
chmod +x scripts/deploy_factory.sh
NETWORK=testnet SOURCE=secret ./scripts/deploy_factory.sh
```

What the script does:

1. builds `collection_factory` for the WASM target
2. optionally loads values from `.env`
3. installs the WASM with Soroban CLI
4. deploys a contract instance
5. invokes `initialize` with the configured identity as admin

### Verify a deployed contract

```bash
chmod +x scripts/verify_contract.sh
NETWORK=testnet SOURCE=secret ./scripts/verify_contract.sh <CONTRACT_ID>
```

The verification script currently checks the deployed factory by invoking `get_collection_count`.

## 📁 Project Structure

```text
nftopia-stellar/
├── contracts/
│   ├── collection_factory/
│   │   └── src/               # factory, collection, storage, events, tests
│   ├── marketplace_settlement/
│   │   └── src/               # settlement, royalties, disputes, security
│   ├── transaction_contract/
│   │   └── src/               # transaction execution, storage, recovery
│   └── nft_contract/          # scaffold-level NFT package
├── scripts/
│   ├── deploy_factory.sh
│   └── verify_contract.sh
└── Cargo.toml                 # workspace root and shared release profiles
```

## 🔐 Security Notes

The contract workspace already includes several explicit security-oriented modules, especially inside `marketplace_settlement` and `transaction_contract`:

- reentrancy guard helpers
- front-running protection modules
- dispute resolution support
- fee and royalty distribution logic
- validation, resource guarding, and recovery helpers

Those modules are worth preserving as first-class documentation targets when the contracts mature further.

## 📌 Repository Notes

- `nft_contract` is not yet as developed as the other packages and should be documented as scaffolded.
- The helper scripts are currently centered on the collection factory flow, not the entire workspace.
- If you standardize deployment further, this README should be expanded with environment conventions and per-contract invocation examples.