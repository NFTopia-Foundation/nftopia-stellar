# Deployment & Cross-Contract Wiring

This document describes how the four NFTopia Stellar contracts depend on each
other at runtime, and how `scripts/deploy_all.sh` wires those dependencies after
deployment.

## Dependency graph

```text
                        +-----------------------------+
                        |   collection_factory        |
                        |   (deploys NFT collections) |
                        +--------------+--------------+
                                       |
               create_collection passes the nft_contract WASM hash
               per call and invokes the deployed collection's `init`
                                       |
                                       v
                        +-----------------------------+
                        |   nft_contract              |
                        |   (reference implementation)|
                        +--------------+--------------+
                                       ^
             owner_of / transfer / allowlist (is_nft_allowed)
                                       |
                        +--------------+--------------+
                        |   marketplace_settlement   |
                        |   (settlement core)         |
                        +--------------+--------------+
                                       |
               balance / transfer / decimals (SEP-41 SACs)
                                       v
                        +-----------------------------+
                        |   token / XLM SACs          |
                        |   (external, not deployed   |
                        |    by this script)          |
                        +-----------------------------+

                        +-----------------------------+
                        |   transaction_contract      |
                        |   (standalone: no cross-    |
                        |    contract calls)          |
                        +-----------------------------+
```

| Contract | Cross-contract references | Configured by |
| --- | --- | --- |
| `marketplace_settlement` | `nft_contract` (`owner_of`, `transfer`, ownership/allowlist checks via `AllowlistStore`); SEP-41 token SACs (`balance`, `transfer`, `decimals`); native XLM SAC for XLM settlement | `add_allowed_nft_contract`, `add_supported_asset`, `set_native_xlm_sac` (all admin-only) |
| `collection_factory` | Deploys and initializes NFT collections (nft_contract instances); the collection WASM hash is passed **per call** to `create_collection` and is not stored | `initialize(admin, fee_asset)` |
| `nft_contract` | None (reference implementation; the factory deploys collection instances) | `initialize(admin, config, royalty)` |
| `transaction_contract` | None (standalone) | — |

Only `marketplace_settlement` keeps configured cross-contract **addresses** in
storage after deployment. It is the single contract that must be wired with the
freshly deployed `nft_contract` address.

## What `deploy_all.sh` does

1. **Build** all four contracts for `wasm32-unknown-unknown --release`.
2. **Deploy** each contract (install/upload WASM → deploy → record in
   `deployments/manifest.json`).
3. **Initialize** the contracts that require it before wiring:
   - `collection_factory.initialize(admin, fee_asset)` — requires `FEE_ASSET`
     (the token SAC the factory collects overflow fees in, e.g. the network's
     XLM SAC). Skipped with a notice when `FEE_ASSET` is unset.
   - `marketplace_settlement.initialize(admin, fee_config, None)` — required
     because every admin-guarded wiring call depends on `admin_cfg`, which is
     only created by `initialize`. Configure the fee policy with
     `FEE_CONFIG_JSON` (a JSON `FeeConfig`); a sane default is used otherwise.
4. **Wire** `marketplace_settlement` → `nft_contract` by calling
   `add_allowed_nft_contract(admin, <nft_contract_address>)`. This call is
   idempotent, so re-running the script is safe.
   - Optional: `WIRE_FEE_ASSET` (and `WIRE_FEE_ASSET_SYMBOL`) registers a token
     SAC via `add_supported_asset`; `WIRE_XLM_SAC` configures the native XLM
     SAC via `set_native_xlm_sac`.
5. **Verify** the wiring by reading it back and asserting it matches the
   deployed address:
   - `marketplace_settlement.is_nft_allowed(nft_contract_address)` must return
     `true`;
   - `get_supported_assets()` must contain `WIRE_FEE_ASSET` (when set);
   - `get_native_xlm_sac()` must return `WIRE_XLM_SAC` (when set).
   The script exits non-zero if any read-back does not match.

## Usage

```bash
cd nftopia-stellar
chmod +x scripts/deploy_all.sh

# Minimal run: deploys + wires marketplace_settlement <-> nft_contract
NETWORK=testnet SOURCE=mykey ./scripts/deploy_all.sh

# Full run including fee asset + XLM SAC wiring
NETWORK=testnet SOURCE=mykey \
  FEE_ASSET=<xlm-sac-or-token-sac> \
  WIRE_XLM_SAC=<xlm-sac-address> \
  WIRE_FEE_ASSET=<extra-token-sac> \
  ./scripts/deploy_all.sh
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NETWORK` | `testnet` | `testnet` or `mainnet` (selects default RPC/passphrase) |
| `SOURCE` | `secret` | Stellar identity used as deployer **and** contract admin |
| `RPC_URL` | per network | RPC endpoint |
| `NETWORK_PASSPHRASE` | per network | Network passphrase |
| `FEE_ASSET` | unset | Token SAC the factory collects fees in (required to initialize `collection_factory`) |
| `FEE_CONFIG_JSON` | conservative defaults | JSON `FeeConfig` for `marketplace_settlement.initialize` |
| `WIRE_FEE_ASSET` | unset | Extra token SAC registered via `add_supported_asset` |
| `WIRE_FEE_ASSET_SYMBOL` | `XLM` | SEP-41 symbol for `WIRE_FEE_ASSET` |
| `WIRE_XLM_SAC` | unset | Native XLM SAC configured via `set_native_xlm_sac` |

## Troubleshooting

- **`add_allowed_nft_contract` fails with `Unauthorized`** — the marketplace was
  not initialized (or `admin_cfg` is missing). Run with `FEE_CONFIG_JSON` set,
  or check that `SOURCE` matches the admin the contract was initialized with.
- **`collection_factory` never initializes** — expected when `FEE_ASSET` is
  unset. `create_collection` will fail until it is set.
- **Re-runs are safe** — `initialize` reports "already initialized" and
  continues; `add_allowed_nft_contract` re-sets the flag; verification
  re-checks the full state.
- **`is_nft_allowed` returns `false` after a successful wiring call** — check
  that the contract id passed to the view matches the id that was wired
  (addresses are case-sensitive).