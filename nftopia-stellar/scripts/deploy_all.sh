#!/bin/bash
# Builds and deploys all NFTopia Stellar contracts, recording each deployment
# in deployments/manifest.json.
# Usage: NETWORK=testnet SOURCE=mykey ./scripts/deploy_all.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

NETWORK=${NETWORK:-testnet}
SOURCE=${SOURCE:-secret}

export GIT_COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
export BUILD_TIMESTAMP=$(date -u +%s)

CONTRACTS=(collection_factory nft_contract marketplace_settlement transaction_contract)

echo "Building all contracts (git=$GIT_COMMIT_HASH, ts=$BUILD_TIMESTAMP, network=$NETWORK)..."
for CONTRACT in "${CONTRACTS[@]}"; do
    cargo build --target wasm32-unknown-unknown --release --package "$CONTRACT"
done

deploy_contract() {
    local CONTRACT="$1"
    local WASM="target/wasm32-unknown-unknown/release/${CONTRACT}.wasm"

    echo ""
    echo "--- Deploying $CONTRACT ---"

    WASM_HASH=$(soroban contract install \
        --wasm "$WASM" \
        --source "$SOURCE" \
        --network "$NETWORK")
    echo "  WASM Hash: $WASM_HASH"

    CONTRACT_ID=$(soroban contract deploy \
        --wasm-hash "$WASM_HASH" \
        --source "$SOURCE" \
        --network "$NETWORK")
    echo "  Contract ID: $CONTRACT_ID"

    "$SCRIPT_DIR/deployment_manifest.sh" "$CONTRACT" "$CONTRACT_ID" "$WASM_HASH" "$NETWORK"
}

for CONTRACT in "${CONTRACTS[@]}"; do
    deploy_contract "$CONTRACT"
done

echo ""
echo "All contracts deployed. Manifest updated at deployments/manifest.json"
