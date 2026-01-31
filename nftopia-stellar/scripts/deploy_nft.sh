#!/bin/bash
# Deploy NFT contract to Stellar network
# After deployment, call initialize(owner, config) with CollectionConfig

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Building NFT contract..."
cargo build --target wasm32-unknown-unknown --release --package nft_contract

if [ -f .env ]; then
    export $(cat .env | xargs)
fi

NETWORK=${NETWORK:-testnet}
SOURCE=${SOURCE:-secret}

echo "Installing WASM to $NETWORK..."
WASM_HASH=$(soroban contract install \
  --wasm target/wasm32-unknown-unknown/release/nft_contract.wasm \
  --source $SOURCE \
  --network $NETWORK)

echo "WASM Hash: $WASM_HASH"

echo "Deploying contract instance..."
CONTRACT_ID=$(soroban contract deploy \
  --wasm-hash $WASM_HASH \
  --source $SOURCE \
  --network $NETWORK)

echo "Deployment complete!"
echo "NFT Contract ID: $CONTRACT_ID"
echo ""
echo "Next: Initialize with initialize(owner, config)"
echo "  owner: Your admin address"
echo "  config: CollectionConfig { name, symbol, base_uri, max_supply, mint_price, is_revealed, royalty_default, metadata_is_frozen }"
