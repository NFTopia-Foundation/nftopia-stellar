#!/bin/bash
# Builds, deploys and initializes all NFTopia Stellar contracts, recording each
# deployment in deployments/manifest.json and verifying each initialization.
#
# Usage: NETWORK=testnet SOURCE=secret ./scripts/deploy_all.sh
#
# Initialization is configured per contract and per network through the
# environment; every value below has a working default so a plain testnet run
# needs no extra setup.
#
#   ADMIN_ADDRESS    identity used as admin; defaults to `soroban config
#                    identity address $SOURCE`
#   FEE_ASSET        token contract the factory charges fees in; defaults to
#                    the admin identity (safe while FactoryFee is 0, which is
#                    the value initialize() sets — see the warning below)
#   COLLECTION_NAME / COLLECTION_BASE_URI
#   COLLECTION_SYMBOL / COLLECTION_MAX_SUPPLY
#                    nft_contract CollectionConfig; max_supply must be
#                    1..=1000000 or initialize() rejects it with
#                    SupplyCapTooLow/TooHigh
#   MINT_PRICE       i128, or empty for None
#   PLATFORM_FEE_BPS marketplace_settlement fee; must be <= 10000
#   MINIMUM_FEE / MAXIMUM_FEE
#                    i128; when MAXIMUM_FEE > 0 it must exceed MINIMUM_FEE
#   FEE_RECIPIENT    address receiving settlement fees; defaults to admin
#
# Fails loudly: any failed initialization or verification aborts the run with a
# non-zero exit and a message naming the contract, contract ID and network.
# Builds and deploys all NFTopia Stellar contracts, wires the cross-contract
# dependencies (marketplace_settlement <--> nft_contract), verifies the wiring
# by reading the configured addresses back from the contracts, and records each
# deployment in deployments/manifest.json.
#
# Usage: NETWORK=testnet SOURCE=mykey ./scripts/deploy_all.sh
#
# The cross-contract dependency graph is documented in
# docs/deployment-wiring.md; the wiring step below registers the freshly
# deployed nft_contract address with marketplace_settlement so that settlement
# logic can resolve and transfer NFTs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC2046 # .env is expected to be simple KEY=VALUE pairs
    export $(grep -v '^#' .env | xargs)
    set +a
fi

NETWORK=${NETWORK:-testnet}
SOURCE=${SOURCE:-secret}

GIT_COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIMESTAMP=$(date -u +%s)
export GIT_COMMIT_HASH BUILD_TIMESTAMP
# --- Network configuration ----------------------------------------------------
# Default RPC endpoint / passphrase per network; override with RPC_URL and
# NETWORK_PASSPHRASE if you use a different provider.
case "$NETWORK" in
    testnet)
        DEFAULT_RPC_URL="https://soroban-testnet.stellar.org:443"
        DEFAULT_PASSPHRASE="Test SDF Network ; September 2015"
        ;;
    mainnet)
        DEFAULT_RPC_URL="https://soroban-rpc.stellar.org"
        DEFAULT_PASSPHRASE="Public Global Stellar Network ; September 2015"
        ;;
    *)
        echo "ERROR: unsupported NETWORK '$NETWORK' (expected testnet or mainnet)" >&2
        exit 1
        ;;
esac
RPC_URL=${RPC_URL:-$DEFAULT_RPC_URL}
NETWORK_PASSPHRASE=${NETWORK_PASSPHRASE:-$DEFAULT_PASSPHRASE}

# --- CLI detection ------------------------------------------------------------
# Official toolchain is stellar-cli (binary `stellar`); a legacy `soroban` CLI is
# supported as a fallback. See README.md -> Prerequisites.
if command -v stellar >/dev/null 2>&1; then
    CLI=stellar
elif command -v soroban >/dev/null 2>&1; then
    CLI=soroban
else
    echo "ERROR: no Stellar CLI found. Install stellar-cli: cargo install --locked stellar-cli" >&2
    exit 1
fi
echo "Using CLI: $CLI (network=$NETWORK, rpc=$RPC_URL, source=$SOURCE)"

# resolve the deployer/admin account address
if [ "$CLI" = "stellar" ]; then
    ADMIN_ADDR=$("$CLI" keys public-key "$SOURCE" 2>/dev/null) || {
        echo "ERROR: identity '$SOURCE' not found. Add it with: stellar keys add $SOURCE" >&2
        exit 1
    }
else
    ADMIN_ADDR=$("$CLI" config identity address "$SOURCE" 2>/dev/null) || {
        echo "ERROR: identity '$SOURCE' not found." >&2
        exit 1
    }
fi
echo "Admin/deployer address: $ADMIN_ADDR"

export GIT_COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
export BUILD_TIMESTAMP=$(date -u +%s)

CONTRACTS=(collection_factory nft_contract marketplace_settlement transaction_contract)

die() {
    echo "" >&2
    echo "ERROR: $*" >&2
    exit 1
}

# require_int <name> <value> [min] [max]
# Rejects anything the contract or the shell arithmetic would choke on, before
# a single WASM is built, so a typo cannot abort a run halfway through.
require_int() {
    local NAME="$1" VALUE="$2" MIN="${3:-}" MAX="${4:-}"
    local DIGITS="${VALUE#-}"     # i128 fields may be negative

    case "$DIGITS" in
        ''|*[!0-9]*) die "$NAME must be an integer, got '$VALUE'" ;;
    esac
    if [ -n "$MIN" ] && [ "$VALUE" -lt "$MIN" ] 2>/dev/null; then
        die "$NAME must be >= $MIN, got '$VALUE'"
    fi
    if [ -n "$MAX" ] && [ "$VALUE" -gt "$MAX" ] 2>/dev/null; then
        die "$NAME must be <= $MAX, got '$VALUE'"
    fi
}

for REQUIRED in soroban cargo; do
    command -v "$REQUIRED" >/dev/null 2>&1 \
        || die "required command '$REQUIRED' not found on PATH"
done

# Resolve the admin identity once, before anything is deployed. A bad identity
# should stop the run here rather than after contracts are already on-chain.
ADMIN_ADDRESS=${ADMIN_ADDRESS:-$(soroban config identity address "$SOURCE" 2>/dev/null || true)}
[ -n "$ADMIN_ADDRESS" ] \
    || die "could not resolve an admin address for identity '$SOURCE'.
       Create one with 'soroban keys new <name>' or set ADMIN_ADDRESS."

# ---------------------------------------------------------------------------
# Per-contract initialization parameters
# ---------------------------------------------------------------------------

# collection_factory stores fee_asset and uses it as a token client whenever a
# fee is charged. initialize() sets FactoryFee to 0, so nothing touches this
# address during deployment — but fees will break until it points at a real
# token contract, so say so out loud rather than silently.
if [ -z "${FEE_ASSET:-}" ]; then
    FEE_ASSET="$ADMIN_ADDRESS"
    echo "WARNING: FEE_ASSET is not set; defaulting it to the admin identity."
    echo "         Fine for a testnet deploy (FactoryFee starts at 0), but set"
    echo "         FEE_ASSET to a real token contract before enabling fees."
fi

# nft_contract: CollectionConfig is mandatory — every field is required by the
# contract, and max_supply is validated against 1..=1000000.
COLLECTION_NAME=${COLLECTION_NAME:-NFTopia}
COLLECTION_SYMBOL=${COLLECTION_SYMBOL:-NFTP}
COLLECTION_BASE_URI=${COLLECTION_BASE_URI:-ipfs://}
COLLECTION_MAX_SUPPLY=${COLLECTION_MAX_SUPPLY:-10000}
require_int COLLECTION_MAX_SUPPLY "$COLLECTION_MAX_SUPPLY" 1 1000000

# marketplace_settlement: FeeConfig validation rejects bps above 10000 and a
# minimum_fee that is not below maximum_fee whenever maximum_fee is positive.
PLATFORM_FEE_BPS=${PLATFORM_FEE_BPS:-250}
MINIMUM_FEE=${MINIMUM_FEE:-0}
MAXIMUM_FEE=${MAXIMUM_FEE:-0}
FEE_RECIPIENT=${FEE_RECIPIENT:-$ADMIN_ADDRESS}

require_int PLATFORM_FEE_BPS "$PLATFORM_FEE_BPS" 0 10000
require_int MINIMUM_FEE "$MINIMUM_FEE"
require_int MAXIMUM_FEE "$MAXIMUM_FEE"

if [ "$MAXIMUM_FEE" -gt 0 ] && [ "$MINIMUM_FEE" -ge "$MAXIMUM_FEE" ]; then
    die "MINIMUM_FEE ($MINIMUM_FEE) must be below MAXIMUM_FEE ($MAXIMUM_FEE)"
fi

# Optional i128 mint price; empty means None.
MINT_PRICE_JSON=null
if [ -n "${MINT_PRICE:-}" ]; then
    require_int MINT_PRICE "$MINT_PRICE"
    MINT_PRICE_JSON="$MINT_PRICE"
fi

collection_config_json() {
    printf '{"name":"%s","symbol":"%s","base_uri":"%s","max_supply":%s,"mint_price":%s,"is_revealed":false,"metadata_is_frozen":false}' \
        "$COLLECTION_NAME" "$COLLECTION_SYMBOL" "$COLLECTION_BASE_URI" \
        "$COLLECTION_MAX_SUPPLY" "$MINT_PRICE_JSON"
}

fee_config_json() {
    printf '{"platform_fee_bps":%s,"minimum_fee":%s,"maximum_fee":%s,"fee_recipient":"%s","dynamic_fee_enabled":false,"volume_discounts":[],"vip_exemptions":[]}' \
        "$PLATFORM_FEE_BPS" "$MINIMUM_FEE" "$MAXIMUM_FEE" "$FEE_RECIPIENT"
}

# ---------------------------------------------------------------------------
# Deploy, initialize, verify
# ---------------------------------------------------------------------------

# Prints the entry point that reports $1's post-deploy state, or nothing when
# the contract has no usable one. Verification is only as strong as the entry
# point allows:
#
#   * genuine  - the getter reads state initialize() wrote and errors
#                (NotFound) when that state is absent, so a successful call
#                proves initialization.
#   * liveness - every view on this contract falls back to unwrap_or(default),
#                so it answers identically before and after initialize(). The
#                call still proves the instance is deployed and answering;
#                initialization itself is proven by initialize() returning 0,
#                which the contract's AlreadyInitialized guard makes a one-shot
#                event. A read-only get_admin() would close this gap - see PR.
#   * n/a      - the contract has no initialize() entry point at all.
initializer_for() {
    case "$1" in
        # initialize(admin, fee_asset) writes FactoryAdmin + counters. No view
        # reads FactoryAdmin back: get_collection_count()/get_max_collections()
        # both unwrap_or() the very values initialize() writes.
        collection_factory)     echo "get_collection_count liveness" ;;

        # initialize() writes CollectionConfig; get_max_supply() reads it with
        # .ok_or(ContractError::NotFound), so it fails until initialized.
        nft_contract)           echo "get_max_supply genuine" ;;

        # initialize() writes SWAP_TIMEOUT_CFG, but timeout_config() reads it
        # with unwrap_or_else(defaults) - and we pass null, i.e. defaults.
        marketplace_settlement) echo "get_swap_timeout_config liveness" ;;

        # No initialize() entry point exists on this contract (confirmed
        # against its WASM spec: 0 initialize functions). get_version()
        # proves it is live.
        transaction_contract)   echo "get_version n/a" ;;
    esac
}

initialize_contract() {
    local CONTRACT="$1"
    local CONTRACT_ID="$2"
    local -a invoke_args

    case "$CONTRACT" in
        collection_factory)
            invoke_args=(initialize --admin "$ADMIN_ADDRESS" --fee_asset "$FEE_ASSET") ;;
        nft_contract)
            invoke_args=(initialize
                --admin "$ADMIN_ADDRESS"
                --config "$(collection_config_json)"
                --default_royalty null) ;;
        marketplace_settlement)
            invoke_args=(initialize
                --admin "$ADMIN_ADDRESS"
                --fee_config "$(fee_config_json)"
                --swap_timeout_config null) ;;
        transaction_contract)
            echo "  Skipping initialize: $CONTRACT exposes no initialize entry point."
            return 0 ;;
        *)
            die "no initialize mapping for contract '$CONTRACT' — update this script" ;;
    esac

    echo "  Initializing $CONTRACT..."
    if ! soroban contract invoke \
        --id "$CONTRACT_ID" \
        --source "$SOURCE" \
        --network "$NETWORK" \
        -- "${invoke_args[@]}"; then
        echo "" >&2
        echo "ERROR: initialize failed for $CONTRACT ($CONTRACT_ID on $NETWORK)." >&2
        echo "       The contract is deployed but NOT usable. Nothing further was run." >&2
        return 1
    fi
    echo "  Initialized: $CONTRACT"
}

verify_initialized() {
    local CONTRACT="$1"
    local CONTRACT_ID="$2"
    local ENTRY FN KIND RESPONSE

    ENTRY=$(initializer_for "$CONTRACT")
    [ -n "$ENTRY" ] || die "no verification entry point mapped for '$CONTRACT'"
    FN="${ENTRY%% *}"
    KIND="${ENTRY##* }"

    case "$KIND" in
        genuine) echo "  Verifying $CONTRACT is initialized via $FN..." ;;
        n/a)     echo "  Checking $CONTRACT is live via $FN (no initialize entry point)..." ;;
        *)       echo "  Checking $CONTRACT is live via $FN (liveness only; initialize() already proved init)" ;;
    esac

    if ! RESPONSE=$(soroban contract invoke \
        --id "$CONTRACT_ID" \
        --source "$SOURCE" \
        --network "$NETWORK" \
        -- "$FN" 2>&1); then
        echo "" >&2
        echo "ERROR: post-initialization verification failed for $CONTRACT" >&2
        echo "       ($CONTRACT_ID on $NETWORK, call: $FN)" >&2
        echo "       $RESPONSE" >&2
        return 1
    fi
    echo "  Verified: $FN -> $RESPONSE"
# invoke_contract <contract_id> <function> [arg value ...]
invoke_contract() {
    local ID="$1" FN="$2"
    shift 2
    if [ "$CLI" = "stellar" ]; then
        "$CLI" contract invoke --id "$ID" --source-account "$SOURCE" \
            --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" -- "$FN" "$@"
    else
        "$CLI" contract invoke --id "$ID" --source "$SOURCE" --network "$NETWORK" -- "$FN" "$@"
    fi
}

deploy_contract() {
    local CONTRACT="$1"
    local WASM="target/wasm32-unknown-unknown/release/${CONTRACT}.wasm"

    echo ""
    echo "--- Deploying $CONTRACT ---"

    if [ "$CLI" = "stellar" ]; then
        WASM_HASH=$("$CLI" contract upload --wasm "$WASM" --source-account "$SOURCE" \
            --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE")
    else
        WASM_HASH=$("$CLI" contract install --wasm "$WASM" --source "$SOURCE" --network "$NETWORK")
    fi
    echo "  WASM Hash: $WASM_HASH"

    if [ "$CLI" = "stellar" ]; then
        CONTRACT_ID=$("$CLI" contract deploy --wasm-hash "$WASM_HASH" --source-account "$SOURCE" \
            --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE")
    else
        CONTRACT_ID=$("$CLI" contract deploy --wasm-hash "$WASM_HASH" --source "$SOURCE" --network "$NETWORK")
    fi
    echo "  Contract ID: $CONTRACT_ID"

    # Order matters: initialize before recording, and verify after both, so the
    # manifest only ever describes a contract that has initialized cleanly.
    initialize_contract "$CONTRACT" "$CONTRACT_ID"
    verify_initialized "$CONTRACT" "$CONTRACT_ID"

    "$SCRIPT_DIR/deployment_manifest.sh" "$CONTRACT" "$CONTRACT_ID" "$WASM_HASH" "$NETWORK"
    echo "  Verifying $CONTRACT is live on $NETWORK"
    if ! invoke_contract "$CONTRACT_ID" get_admin > /dev/null 2>&1; then
        echo "  Warning: get_admin verification call failed for $CONTRACT (check function name/admin init)"
    else
        echo "  Verified: $CONTRACT responds to get_admin"
    fi
}

echo "Building all contracts (git=$GIT_COMMIT_HASH, ts=$BUILD_TIMESTAMP, network=$NETWORK)..."
for CONTRACT in "${CONTRACTS[@]}"; do
    cargo build --target wasm32-unknown-unknown --release --package "$CONTRACT"
done

echo ""
echo "Initializing as admin $ADMIN_ADDRESS on $NETWORK"

for CONTRACT in "${CONTRACTS[@]}"; do
    deploy_contract "$CONTRACT"
done

# manifest_id <contract> -> the contract_id recorded for $NETWORK
manifest_id() {
    python3 - "$NETWORK" "$1" <<'PY'
from json import load
import sys
network, contract = sys.argv[1], sys.argv[2]
with open("deployments/manifest.json") as f:
    manifest = load(f)
for entry in manifest.get("deployments", []):
    if entry.get("network") == network and entry.get("contract") == contract:
        print(entry["contract_id"])
        break
PY
}

NFT_CONTRACT_ID=$(manifest_id nft_contract)
COLLECTION_FACTORY_ID=$(manifest_id collection_factory)
MARKETPLACE_ID=$(manifest_id marketplace_settlement)
TRANSACTION_CONTRACT_ID=$(manifest_id transaction_contract)

echo ""
echo "=== Cross-contract wiring ==="
echo "  marketplace_settlement: $MARKETPLACE_ID"
echo "  nft_contract:           $NFT_CONTRACT_ID"
echo "  collection_factory:     $COLLECTION_FACTORY_ID"
echo "  transaction_contract:   $TRANSACTION_CONTRACT_ID"
echo "  (dependency graph: see docs/deployment-wiring.md)"

# ---------------------------------------------------------------------------
# Step 1: Initialize contracts that require it before they can be wired.
# The admin-guarded wiring calls below depend on `admin_cfg`, which is only
# created by `initialize`, so this must happen first. Both calls are
# idempotent-friendly: re-running on an already-initialized contract is
# detected and reported instead of failing the script.
# ---------------------------------------------------------------------------

echo ""
echo "--- Initializing contracts ---"

# collection_factory.initialize(admin, fee_asset)
if [ -n "${FEE_ASSET:-}" ]; then
    echo "  Initializing collection_factory (fee_asset=$FEE_ASSET)..."
    if INIT_OUT=$(invoke_contract "$COLLECTION_FACTORY_ID" initialize --admin "$ADMIN_ADDR" --fee_asset "$FEE_ASSET" 2>&1); then
        echo "    collection_factory initialized"
    elif printf '%s' "$INIT_OUT" | grep -qi "already.initialized"; then
        echo "    collection_factory already initialized (continuing)"
    else
        echo "$INIT_OUT"
        echo "ERROR: collection_factory.initialize failed. Set FEE_ASSET to the token SAC the" >&2
        echo "       factory collects overflow fees in (e.g. the network XLM SAC)." >&2
        exit 1
    fi
else
    echo "  Skipping collection_factory init (set FEE_ASSET to the token SAC address, e.g. the"
    echo "  network XLM SAC, to initialize it)."
fi

# marketplace_settlement.initialize(admin, fee_config, swap_timeout_config=None)
FEE_CONFIG_JSON=${FEE_CONFIG_JSON:-"{\"platform_fee_bps\":250,\"minimum_fee\":1000,\"maximum_fee\":1000000,\"fee_recipient\":\"$ADMIN_ADDR\",\"dynamic_fee_enabled\":false,\"volume_discounts\":[],\"vip_exemptions\":[]}"}
echo "  Initializing marketplace_settlement..."
if INIT_OUT=$(invoke_contract "$MARKETPLACE_ID" initialize --admin "$ADMIN_ADDR" --fee_config "$FEE_CONFIG_JSON" 2>&1); then
    echo "    marketplace_settlement initialized"
elif printf '%s' "$INIT_OUT" | grep -qi "already.initialized"; then
    echo "    marketplace_settlement already initialized (continuing)"
else
    echo "$INIT_OUT"
    echo "ERROR: marketplace_settlement.initialize failed; cross-contract wiring is impossible" >&2
    echo "       without an initialized admin config. Fix the fee config and re-run." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Step 2: Wire marketplace_settlement -> nft_contract.
# Registers the freshly deployed nft_contract address as an allowed NFT
# contract. The call is idempotent (it simply re-sets the flag to true), so
# this step is safe to re-run.
# ---------------------------------------------------------------------------

echo ""
echo "--- Wiring marketplace_settlement -> nft_contract ---"
if invoke_contract "$MARKETPLACE_ID" add_allowed_nft_contract --admin "$ADMIN_ADDR" --contract "$NFT_CONTRACT_ID"; then
    echo "  Registered NFT contract $NFT_CONTRACT_ID with marketplace_settlement"
else
    echo "ERROR: add_allowed_nft_contract call failed." >&2
    exit 1
fi

# Optional additional wiring for settlement assets (external SACs, not part of
# this deploy): WIRE_FEE_ASSET registers a token via add_supported_asset and
# WIRE_XLM_SAC configures the native XLM Stellar Asset Contract.
if [ -n "${WIRE_FEE_ASSET:-}" ]; then
    SYMBOL=${WIRE_FEE_ASSET_SYMBOL:-XLM}
    echo "  Registering fee asset $WIRE_FEE_ASSET ($SYMBOL) via add_supported_asset..."
    invoke_contract "$MARKETPLACE_ID" add_supported_asset --admin "$ADMIN_ADDR" \
        --asset "{\"Token\":{\"contract\":\"$WIRE_FEE_ASSET\",\"symbol\":\"$SYMBOL\"}}"
fi

if [ -n "${WIRE_XLM_SAC:-}" ]; then
    echo "  Configuring native XLM SAC $WIRE_XLM_SAC..."
    invoke_contract "$MARKETPLACE_ID" set_native_xlm_sac --admin "$ADMIN_ADDR" --native_xlm_sac "$WIRE_XLM_SAC"
fi

# ---------------------------------------------------------------------------
# Step 3: Verification — read the configured addresses back from the contracts
# and assert they match what was just deployed.
# ---------------------------------------------------------------------------

echo ""
echo "--- Verifying wiring ---"

ALLOWED=$(invoke_contract "$MARKETPLACE_ID" is_nft_allowed --contract "$NFT_CONTRACT_ID")
echo "  marketplace_settlement.is_nft_allowed($NFT_CONTRACT_ID) = $ALLOWED"
if [ "$ALLOWED" != "true" ]; then
    echo "ERROR: wiring verification failed — nft_contract is NOT allowlisted." >&2
    exit 1
fi

if [ -n "${WIRE_FEE_ASSET:-}" ]; then
    SUPPORTED=$(invoke_contract "$MARKETPLACE_ID" get_supported_assets)
    echo "  marketplace_settlement.get_supported_assets() = $SUPPORTED"
    if ! printf '%s' "$SUPPORTED" | grep -q "$WIRE_FEE_ASSET"; then
        echo "ERROR: verification failed — $WIRE_FEE_ASSET is not in the supported assets." >&2
        exit 1
    fi
fi

if [ -n "${WIRE_XLM_SAC:-}" ]; then
    CONFIGURED_SAC=$(invoke_contract "$MARKETPLACE_ID" get_native_xlm_sac)
    echo "  marketplace_settlement.get_native_xlm_sac() = $CONFIGURED_SAC"
    if ! printf '%s' "$CONFIGURED_SAC" | grep -q "$WIRE_XLM_SAC"; then
        echo "ERROR: verification failed — native XLM SAC not configured." >&2
        exit 1
    fi
fi

echo ""
echo "All contracts deployed, initialized and verified."
echo "Manifest updated at deployments/manifest.json"
echo "All contracts deployed and wired. Manifest updated at deployments/manifest.json"
echo ""
echo "Contract addresses for $NETWORK:"
python3 - "$NETWORK" <<'PY'
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
echo "Wiring summary: marketplace_settlement ($MARKETPLACE_ID) is configured with"
echo "nft_contract ($NFT_CONTRACT_ID). Share these addresses with backend/frontend/mobile teams."