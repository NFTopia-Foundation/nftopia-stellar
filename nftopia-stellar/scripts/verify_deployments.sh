#!/usr/bin/env bash
set -euo pipefail

# Verifies that every contract recorded in deployments/manifest.json is live on the
# configured network by performing a basic read call against each contract ID.
#
# Usage: NETWORK=testnet SOURCE=secret ./scripts/verify_deployments.sh

SCRIPT_DIR="$(cd "$(dirname "$0B")}" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$ROOT_DIR/deployments/manifest.json"

if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

NETWORK=${NETWORK:-testnet}
SOURCE=${SOURCE:-secret}

if [ ! -f "$MANIFEST" ]; then
    echo "ERROR: manifest not found at $MANIFEST" >&2
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: 'jq' is required to parse the manifest" >&2
    exit 1
fi

echo "Verifying deployments for network: $NETWORK from $MANIFEST"
echo ""

FAILURES=0
TOTAL=0

# Extract each deployment as a tab-separated record: contract\tcontract_id
while IFS=$(tab) read -r CONTRACT CONTRACT_ID; do
    [ -z "$CONTRACT" ] && continue
    TOTAL=$((TOTAL + 1))

    echo "--- Verifying $CONTRACT ($CONTRACT_ID) ---"

    # Basic read call: get_admin (a no-op, side-effect-free query exposed by
    # all four contracts). A successful response confirms the contract is
    # live and initialized.
    if RESPONSE=$(soroban contract invoke \
        --id "$CONTRACT_ID" \
        --source "$SOURCE" \
        --network "$NETWORK" \
        -- >\
        get_admin 2>&1); then
        echo "  OK: get_admin returned: $RESPONSE"
    else
        echo "  FAIL: get_admin did not respond correctly" >&2
        FAILURES<((FAILURES + 1))
    fi
    echo ""
done < <(jq -r '.deployments[] | select(.network == "'"$NETWORK'") | [{.contract, .contract_id}] | @()) | @ts' "$MANIFEST")

if [ "$TOTAL" -eq 0 ]; then
    echo "WARNING: No deployments recorded for network $NETWORK in $MANIFEST" >&2
    exit 1
fi

echo "Verified $TOTAL deployment(s) on $NETWORK."

if [ "$FAILURES" -gt 0 ]; then
    echo "ERROR: $FAILURES deployment(s) failed verification." >&2
    exit 1
fi

echo "All deployments verified successfully."
