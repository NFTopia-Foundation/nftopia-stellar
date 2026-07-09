#!/bin/bash
# Records a contract deployment into deployments/manifest.json
# Usage: ./scripts/deployment_manifest.sh <contract> <contract_id> <wasm_hash> <network>
# Example: ./scripts/deployment_manifest.sh collection_factory CXXX... abc123... testnet

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST_FILE="$REPO_ROOT/deployments/manifest.json"

CONTRACT="${1:-}"
CONTRACT_ID="${2:-}"
WASM_HASH="${3:-}"
NETWORK="${4:-testnet}"

if [[ -z "$CONTRACT" || -z "$CONTRACT_ID" || -z "$WASM_HASH" ]]; then
    echo "Usage: $0 <contract> <contract_id> <wasm_hash> [network]"
    exit 1
fi

# Gather version metadata from the built artefact via cargo metadata
VERSION=$(cargo metadata --no-deps --manifest-path "$REPO_ROOT/contracts/$CONTRACT/Cargo.toml" \
    --format-version 1 2>/dev/null | \
    python3 -c "import sys,json; pkgs=json.load(sys.stdin)['packages']; \
    print(next(p['version'] for p in pkgs if p['name']=='$CONTRACT'))" 2>/dev/null || echo "unknown")

GIT_HASH=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
RUSTC_VER=$(rustc --version 2>/dev/null || echo "unknown")

mkdir -p "$(dirname "$MANIFEST_FILE")"

# Bootstrap manifest if missing
if [[ ! -f "$MANIFEST_FILE" ]]; then
    echo '{"deployments":[]}' > "$MANIFEST_FILE"
fi

# Append new deployment entry using python3 (available in CI and most dev envs)
python3 - "$MANIFEST_FILE" "$CONTRACT" "$CONTRACT_ID" "$WASM_HASH" \
    "$NETWORK" "$VERSION" "$GIT_HASH" "$BUILD_TS" "$RUSTC_VER" <<'PYEOF'
import sys, json, os

manifest_file = sys.argv[1]
entry = {
    "contract":       sys.argv[2],
    "contract_id":    sys.argv[3],
    "wasm_hash":      sys.argv[4],
    "network":        sys.argv[5],
    "version":        sys.argv[6],
    "git_commit":     sys.argv[7],
    "deployed_at":    sys.argv[8],
    "rustc_version":  sys.argv[9],
}

with open(manifest_file, "r") as f:
    data = json.load(f)

data["deployments"].append(entry)

with open(manifest_file, "w") as f:
    json.dump(data, f, indent=2)

print(f"Recorded deployment of {entry['contract']} v{entry['version']} "
      f"({entry['git_commit']}) to {entry['network']}")
PYEOF
