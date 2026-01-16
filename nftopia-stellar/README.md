# NFTopia Soroban Contracts

NFTopia Soroban Contracts is the on-chain backbone of the NFTopia decentralized platform, powering secure NFT minting, management, and marketplace interactions on the Stellar blockchain. Built with Rust and Soroban smart contracts, it handles core logic like token issuance, ownership transfers, royalties, and escrow for auctions—all leveraging Stellar's sub-second settlements and low fees for efficient, tamper-proof operations. This standalone repository focuses exclusively on the blockchain layer, integrating seamlessly with NFTopia's frontend, backend, and mobile apps via the Stellar SDK.

Targeted at blockchain developers, Solidity/Rust migrants, and Web3 contributors, this repo enables rapid iteration on NFT standards (e.g., compliant with SIP-XXX for Stellar NFTs). It supports testnet experimentation and mainnet deployment, emphasizing auditability, upgradability, and composability with other Soroban protocols for a robust, scalable NFT ecosystem.

## Features

### Core Contracts
- **NFT Minting Contract**: Issues unique NFTs with customizable metadata, royalties, and attributes; supports batch minting.
- **NFT Management Contract**: Handles transfers, burns, approvals, and metadata updates with access controls.
- **Marketplace Escrow Contract**: Securely locks assets during auctions/bids, with automated settlements and dispute resolution.
- **Royalties & Analytics Hooks**: Enforces creator royalties on secondary sales; emits events for off-chain indexing.

### Advanced
- **Upgradability**: Proxy patterns for seamless contract upgrades without disrupting user state.
- **Cross-Contract Calls**: Integrates with Stellar assets (e.g., USDC payments) and external oracles for dynamic pricing.
- **Testing Suite**: Comprehensive unit and integration tests with Soroban CLI for local RPC simulation.

## Tech Stack
- **Language**: Rust (via soroban-sdk for contract development).
- **Framework**: Soroban (Stellar's smart contract platform for WASM-based execution).
- **Testing**: Cargo test framework with Soroban test utils.
- **Deployment**: Soroban CLI for building, deploying, and invoking contracts.
- **Integration**: Stellar SDK (JS/TS) for off-chain clients; compatible with Freighter/Lobstr wallets.

## Repository Structure
This repo follows the standard Soroban project layout for easy onboarding and scalability. Contracts are isolated in subdirectories under `contracts/`, allowing multiple independent modules while sharing workspace dependencies.

```
nftopia-soroban/
├── contracts/
│   ├── nftopia-nft/              # Core NFT minting and management
│   │   ├── src/
│   │   │   ├── lib.rs            # Contract entrypoint and functions
│   │   │   └── test.rs           # Unit/integration tests
│   │   └── Cargo.toml            # Contract-specific dependencies
│   ├── nftopia-marketplace/      # Escrow and auction logic
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   └── test.rs
│   │   └── Cargo.toml
│   └── Cargo.toml                # Example: Additional contracts here
├── Cargo.toml                    # Workspace root: Shared deps (e.g., soroban-sdk)
├── README.md                     # This file
└── .env.example                  # Deployment env vars
```

- Add new contracts in `contracts/<name>/` with their own `src/lib.rs` and `Cargo.toml`.
- Workspace `Cargo.toml` manages common crates like `soroban-sdk` and `ed25519-dalek`.
- Tests run per-contract; use `--test` for full suite.

## Setup Instructions

### Prerequisites
Ensure you have:
- Rust 1.75+ (install via [rustup.rs](https://rustup.rs); enable WASM target: `rustup target add wasm32-unknown-unknown`).
- Soroban CLI (install: `cargo install --locked --git https://github.com/stellar/rs-soroban-cli`).
- Stellar testnet wallet (e.g., Freighter; fund at [laboratory.stellar.org](https://laboratory.stellar.org)).
- Git (for cloning).

### Installation
1. Clone the repository:
   ```
   git clone https://github.com/your-username/nftopia-soroban.git
   cd nftopia-soroban
   ```

2. Build the workspace:
   ```
   cargo build --target wasm32-unknown-unknown --release
   ```

### Environment Setup
1. Copy `.env.example` to `.env`:
   ```
   STELLAR_NETWORK=testnet  # Or 'mainnet'
   SOROBAN_RPC_URL=http://localhost:8000/soroban/rpc  # Local RPC
   WALLET_SECRET_SEED=your_wallet_secret_seed  # Base64-encoded for deployment
   ```
2. For testnet: Fund your wallet via Friendbot (URL in env).
3. For mainnet: Replace RPC with public endpoint (e.g., `https://soroban-api.stellar.org`).

### Running Locally
1. Start a local Soroban RPC for testing:
   ```
   soroban rpc serve --network testnet --hostname 127.0.0.1 --port 8000
   ```
2. Build and deploy a contract (e.g., NFT):
   ```
   cd contracts/nftopia-nft
   cargo build --target wasm32-unknown-unknown --release
   soroban contract deploy \
     --wasm target/wasm32-unknown-unknown/release/nftopia_nft.wasm \
     --source WALLET_SECRET_SEED \
     --network testnet \
     --rpc-url $SOROBAN_RPC_URL
   ```
3. Invoke/test:
   ```
   soroban contract invoke \
     --source WALLET_SECRET_SEED \
     --network testnet \
     --wasm-id <CONTRACT_ID> \
     -- initialize  # Example function call
   ```

Connect via Stellar SDK in your app to interact (e.g., mint NFTs).

### Testing
1. Run unit tests for a contract:
   ```
   cd contracts/nftopia-nft
   cargo test
   ```
2. Full workspace tests:
   ```
   cargo test --all
   ```
3. Simulate deployments:
   ```
   soroban contract test \
     --wasm target/wasm32-unknown-unknown/release/nftopia_nft.wasm
   ```
Tests include edge cases like invalid mints and royalty enforcement; requires testnet RPC.

### Deployment
1. **Testnet**: Use the `soroban contract deploy` command above; verify on [Stellar Laboratory](https://laboratory.stellar.org/#network?network=testnet).
2. **Mainnet**:
   - Update `.env` to `STELLAR_NETWORK=mainnet`.
   - Optimize WASM: `soroban contract optimize --wasm target/wasm32-unknown-unknown/release/nftopia_nft.wasm`.
   - Deploy via CI/CD (e.g., GitHub Actions with Soroban CLI).
3. Post-Deploy: Register contract IDs in NFTopia's backend config; audit via tools like Slither-for-Rust.

For production, conduct formal audits and use upgradable proxies. See `DEPLOYMENT.md` for CI scripts.

## Usage
1. **Mint NFT**: Call `mint` with metadata URI, royalties; returns token ID.
2. **Transfer**: Invoke `transfer` with recipient; emits Transfer event.
3. **Auction Setup**: Use marketplace contract to lock NFT in escrow with bid params.
4. **Off-Chain Integration**: Query via Horizon API; invoke via Stellar SDK (e.g., `contract.mint({to: user, uri: ipfsHash})`).

Example Rust snippet in `src/lib.rs` for minting:
```rust
#[contractimpl]
impl NftopiaNft for Self {
    fn mint(env: Env, to: Address, uri: String) -> u32 {
        // Mint logic here
        env.events().emit((to.clone(), token_id), LogEvent::Mint);
        token_id
    }
}
```

Figma for app integration: [View here](https://www.figma.com/file/YOUR-FIGMA-LINK).

## Contributing
Contributions to NFTopia's on-chain layer are key to its evolution! Focus on secure, gas-efficient Rust code.

- **Report Issues**: GitHub Issues with repro steps, contract ID, and tx hash.
- **Propose Features**: Discussions for new contracts (e.g., fractional NFTs).
- **Submit PRs**:
  1. Fork and branch: `git checkout -b feat/new-contract`.
  2. Add contract in `contracts/<name>/`; update workspace `Cargo.toml`.
  3. Test thoroughly: `cargo test --all`.
  4. Commit: "feat: add fractional ownership contract".
  5. PR to `main`; include benchmarks.
- **Best Practices**:
  - Follow Rust/Soroban idioms; use `#[contractimpl]` for exports.
  - Benchmark storage/CPU limits; aim <1M units.
  - Audit changes with `cargo clippy`.

Adhere to [Code of Conduct](CODE_OF_CONDUCT.md); DCO sign-off required.

## License
MIT License. See [LICENSE](LICENSE) for details.

## Support & Community
- NFTopia Discord: [discord.gg/nftopia](https://discord.gg/nftopia) (#soroban channel).
- Questions? Ping @Oluwaseyi89 or @Cedarich in issues.

Built with ❤️ by the NFTopia team. Powered by Stellar & Soroban. 🚀
