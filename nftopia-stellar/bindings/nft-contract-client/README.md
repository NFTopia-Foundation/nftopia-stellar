# @nftopia/nft-contract-client

Generated TypeScript client for NFTopia's `nft_contract` Soroban contract.

## Installation

```bash
npm install @nftopia/nft-contract-client
```

## Build

```bash
npm run build
```

## Usage

```typescript
import { Client } from '@nftopia/nft-contract-client';

const client = new Client({
  contractId: "YOUR_CONTRACT_ID",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});

const { result } = await client.owner_of({ token_id: 1n });
const owner = result.unwrap();
```

See [`../README.md`](../README.md) for regeneration instructions. The `prepack`
script builds the generated JavaScript and declaration files before npm packs the
publishable package.