# NFTopia NFT Contract

A comprehensive, standards-compliant NFT contract using the Soroban SDK for the Stellar blockchain. Implements an ERC-721 equivalent with Stellar optimizations, supporting token minting, transfers, ownership management, metadata storage, and royalty enforcement.

## Features

- **Token Management**: Mint, burn, transfer, safe transfer, and batch operations
- **Ownership & Approvals**: owner_of, balance_of, approve, set_approval_for_all, get_approved, is_approved_for_all
- **Metadata**: token_uri, token_metadata, set_token_uri, set_base_uri, freeze_metadata
- **Royalties**: EIP-2981 equivalent with get_royalty_info, set_default_royalty, set_royalty_info
- **Access Control**: Role-based (Owner, Admin, Minter, Burner, MetadataUpdater), pausable, whitelist
- **Interfaces**: ERC-165 equivalent for interface detection

## Build

```bash
cargo build --release --target wasm32-unknown-unknown
```

## Test

```bash
cargo test
```

## Deploy

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/nft_contract.wasm \
  --source <SOURCE_ACCOUNT> \
  --network testnet
```

## Initialize

After deployment, call `initialize(owner, config)` with:
- `owner`: Contract owner address
- `config`: CollectionConfig with name, symbol, base_uri, max_supply, royalty_default, etc.

## Key Functions

| Function | Description |
|----------|-------------|
| `initialize` | Initialize the contract |
| `mint` | Mint new NFT |
| `burn` | Burn NFT (requires confirm=true) |
| `transfer` | Transfer NFT |
| `safe_transfer_from` | Safe transfer with optional receiver callback |
| `batch_transfer` | Transfer multiple tokens |
| `batch_mint` | Mint multiple NFTs |
| `owner_of` | Get token owner |
| `balance_of` | Get balance for address |
| `approve` | Approve address for token |
| `set_approval_for_all` | Approve operator for all tokens |
| `token_uri` | Get token metadata URI |
| `token_metadata` | Get full on-chain metadata |
| `get_royalty_info` | Get royalty for sale price |
