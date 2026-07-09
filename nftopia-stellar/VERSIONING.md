# Contract Versioning Strategy

Every NFTopia Stellar contract embeds its version into the compiled WASM at build time. This makes it possible to determine exactly which code is deployed on-chain without relying on external records.

## Version format

```
<semver>+<git-short-hash>
```

Example: `0.1.0+d9a4232`

The full build metadata string follows the pattern:

```
version=0.1.0;git=d9a4232;ts=1719532800;rustc=rustc 1.80.0
```

## How it works

### 1. Build script (`build.rs`)

Each contract has a `build.rs` in its package root. At compile time it:

- Runs `git rev-parse --short HEAD` to capture the current commit hash.
- Reads `SystemTime::now()` for a Unix build timestamp.
- Runs `rustc --version` for the compiler version.
- Emits each value as a `cargo:rustc-env` variable so `env!()` can read it in the contract source.

CI can override any value by exporting the environment variable before invoking `cargo build`.

### 2. Version module (`src/version.rs`)

Each contract has a `version` module that exposes:

| Symbol | Type | Value |
|--------|------|-------|
| `VERSION` | `&str` | `"0.1.0"` |
| `GIT_COMMIT_HASH` | `&str` | `"d9a4232"` |
| `BUILD_TIMESTAMP` | `&str` | `"1719532800"` |
| `RUSTC_VERSION` | `&str` | `"rustc 1.80.0"` |
| `VERSION_FULL` | `&str` | `"0.1.0+d9a4232"` |
| `BUILD_METADATA` | `&str` | full metadata string |

All constants are computed at compile time using `env!()` and `concat!()`, so they are embedded directly in the WASM binary with zero runtime cost.

### 3. Contract functions

Each contract exposes two public functions:

```rust
// Returns "0.1.0+d9a4232"
pub fn version(env: Env) -> String

// Returns "version=0.1.0;git=d9a4232;ts=1719532800;rustc=rustc 1.80.0"
pub fn get_version(env: Env) -> String
```

Call them on-chain via the Soroban CLI:

```bash
stellar contract invoke --id <CONTRACT_ID> --network testnet -- version
stellar contract invoke --id <CONTRACT_ID> --network testnet -- get_version
```

## Bumping versions

1. Update `version` in the contract's `Cargo.toml`.
2. The build script picks up the new value automatically.
3. Tag the release commit: `git tag -a v0.2.0 -m "release 0.2.0"`.

## CI/CD

The GitHub Actions workflow (`nftopia-stellar.yml`) sets `GIT_COMMIT_HASH`, `BUILD_TIMESTAMP`, and `RUSTC_VERSION` as environment variables before the build step, ensuring reproducible version metadata in every CI artefact.

## Deployment manifest

`deployments/manifest.json` records every deployment:

```json
{
  "deployments": [
    {
      "contract":      "collection_factory",
      "contract_id":   "CXXX...",
      "wasm_hash":     "abc123...",
      "network":       "testnet",
      "version":       "0.1.0",
      "git_commit":    "d9a4232",
      "deployed_at":   "2024-06-28T12:00:00Z",
      "rustc_version": "rustc 1.80.0"
    }
  ]
}
```

The manifest is updated automatically by `scripts/deployment_manifest.sh`, which is called at the end of `scripts/deploy_factory.sh` and `scripts/deploy_all.sh`.

## Incident response checklist

1. Retrieve the on-chain version: `stellar contract invoke ... -- get_version`
2. Parse the `git=` field to identify the exact commit.
3. Cross-reference with `deployments/manifest.json` for the deployment timestamp and network.
4. Check out the commit: `git checkout <hash>` to inspect the code.
