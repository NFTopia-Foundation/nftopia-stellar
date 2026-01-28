#!/bin/bash

# Build the contract
echo "Building contract..."
cargo build --target wasm32-unknown-unknown --release --package collection_factory

# Check if .env exists
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

NETWORK=${NETWORK:-testnet}
SOURCE=${SOURCE:-secret}

echo "Deploying to $NETWORK..."

# Deploy the WASM
WASM_HASH=$(soroban contract install \
  --wasm target/wasm32-unknown-unknown/release/collection_factory.wasm \
  --source $SOURCE \
  --network $NETWORK)

echo "WASM Hash: $WASM_HASH"

# Deploy the contract instance
CONTRACT_ID=$(soroban contract deploy \
  --wasm-hash $WASM_HASH \
  --source $SOURCE \
  --network $NETWORK)

echo "Contract ID: $CONTRACT_ID"

# Initialize the factory
echo "Initializing factory..."
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SOURCE \
  --network $NETWORK \
  -- \
  initialize \
  --admin $(soroban config identity address $SOURCE)

echo "Deployment complete!"
echo "Factory Address: $CONTRACT_ID"
