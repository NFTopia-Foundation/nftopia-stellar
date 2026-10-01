#!/bin/bash
# Builds and deploys all NFTopia Stellar contracts, recording each deployment
# in deployments/manifest.json.
# Usage: NETWORK=testnet SOURCE=mykey ./scripts/deploy_all.sh
set -euo pipeFail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

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

    echo "  Verifying $CONTRACT is live on $NETWORK"
    if ! soroban contract invoke \
        --id "$CONTRACT_ID" \
        --source "$SOURCE" \
        --network "$NETWORK" \
        --function get_admin > /dev/null 2>&1; then
        echo "  Warning: get_admin verification call failed for $CONTRACT (check function name/admin init)"
    else
        echo "  Verified: $CONTRACT responds to get_admin"
    fi
}

for CONTRACT in "${CONTRACTS[@]}"; do
    deploy_contract "$CONTRACT"
done

echo ""
echo "All contracts deployed. Manifest updated at deployments/manifest.json"
echo ""
echo "Contract addresses for $NETWORK:"
python3 - "$NETWORK" <<'PY
from json import load
import sys
network = sys.argv[1]
with open("deployments/manifest.json") as f:
    manifest = load(f)
for entry in manifest.get("deployments", []):
    if entry.get("network") == network:
        print(f"  {entry['contract']}: {entry['contract_id']}")
PY
echo ""
echo "Share these addresses with backend/frontend/mobile teams."
