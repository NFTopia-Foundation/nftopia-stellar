# Soroban TypeScript Bindings

The `nft-contract-client` package is generated from the `nft_contract` WASM
contract specification with the official JavaScript Stellar SDK CLI.

## Regenerate

From the `nftopia-stellar` Rust workspace root:

```sh
cargo build -p nft_contract --target wasm32-unknown-unknown --release
npx --yes @stellar/stellar-sdk generate \
  --wasm target/wasm32-unknown-unknown/release/nft_contract.wasm \
  --output-dir bindings/nft-contract-client \
  --contract-name @nftopia/nft-contract-client \
  --overwrite
```

The generated `src/types.ts` currently emits `ContractError` as a runtime lookup
object but does not emit the structural type required by the SDK's `Result<T, E>`.
After regeneration, add this declaration after the `ContractError` object:

```ts
export interface ContractError {
  message: string;
}
```

The package metadata and README in the generated directory are NFTopia-owned;
keep the npm scope, `files`/`prepack` settings, and consumer instructions if the
generator replaces them. Build and publish the package from its directory:

```sh
cd bindings/nft-contract-client
npm install
npm pack --dry-run
npm publish --access public
```

The backend consumes the package through a local file dependency. Frontend
consumers can install the published `@nftopia/nft-contract-client` package.
