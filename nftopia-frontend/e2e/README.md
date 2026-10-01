# NFTopia Frontend – Playwright E2E Tests

## Quick start

```bash
# 1. Install Playwright browsers (once per machine / CI runner)
cd nftopia-frontend
npm run e2e:install          # or: npx playwright install --with-deps

# 2. Start the dev server in another terminal
npm run dev                  # listens on http://localhost:5000

# 3. Run the full e2e suite
npm run e2e

# Run a single spec
npx playwright test e2e/purchase-flow.spec.ts

# Run headed (useful for debugging)
npx playwright test --headed

# Override the target URL
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e
```

---

## Testnet wallet fixture strategy

All tests that exercise wallet-gated flows (buy, bid, list) use the helpers
in `e2e/fixtures/testnet-wallet.ts` rather than driving a real browser
extension.  This section documents the strategy so future tests can follow
the same pattern.

### How it works

#### 1 – Wallet state injection (`injectWalletState`)

The Zustand `stellar-wallet-store` key in `localStorage` is written before
the page navigates.  The app reads that store on mount and treats the wallet
as already connected, so no Freighter/Albedo extension popup is ever shown.

The injected state structure mirrors `stores/walletStore.ts`:

```ts
{
  state: {
    address: "GABC…",   // Stellar public key
    provider: "freighter",
    network: "testnet",
    connected: true,
    connecting: false,
    error: null,
  },
  version: 0,
}
```

#### 2 – GraphQL network interception

`page.route('**/graphql', …)` intercepts Apollo Client requests before they
leave the browser.  Each helper checks `operationName` and either fulfils the
request with a deterministic JSON payload or falls through to
`route.continue()` for operations the test does not care about.

Available interception helpers:

| Helper | Operation intercepted | Effect |
|---|---|---|
| `mockGetListings` | `GetListings` | Returns one predictable NFT listing |
| `mockBuyNFTSuccess` | `BuyNFT` | Returns `{ success: true }` |
| `mockBuyNFTInsufficientBalance` | `BuyNFT` | Returns a GraphQL error with code `INSUFFICIENT_BALANCE` |

All three are opt-in.  Remove them from a test to run against a live backend.

#### 3 – Custom `test` fixture

`testnet-wallet.ts` exports an extended Playwright `test` object with two
auto-wired fixtures:

```ts
import { test, expect } from './fixtures/testnet-wallet';

test('my flow', async ({ page, injectFundedWallet }) => {
  await injectFundedWallet(page);   // connected, funded wallet
  // … or: await injectEmptyWallet(page);  – disconnected wallet
});
```

---

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `E2E_WALLET_ADDRESS` | Stellar public key for the testnet account | Hardcoded throwaway key in fixture |
| `E2E_WALLET_SECRET` | Stellar secret key (never commit a real value) | – |
| `E2E_FUNDED` | Set to `"false"` to simulate an unfunded wallet | `"true"` |
| `PLAYWRIGHT_BASE_URL` | Override the base URL the tests target | `http://localhost:5000` |

---

### Funding a testnet account (CI and local)

The wallet address referenced by `E2E_WALLET_ADDRESS` must exist on Stellar
testnet before any test that requires a funded account.  Use Friendbot:

```bash
# One-shot fund via curl
curl "https://friendbot.stellar.org?addr=$E2E_WALLET_ADDRESS"

# Or with Node
node -e "
  const addr = process.env.E2E_WALLET_ADDRESS;
  fetch(\`https://friendbot.stellar.org?addr=\${addr}\`)
    .then(r => r.json()).then(console.log);
"
```

In CI the `e2e` workflow job runs a **Fund testnet wallet** step that calls
Friendbot automatically when `E2E_WALLET_ADDRESS` is set as a repository
secret (see `.github/workflows/nftopia-frontend.yml`).

---

## Test files

| File | Coverage |
|---|---|
| `smoke.spec.ts` | Home page loads and returns HTTP < 400 |
| `purchase-flow.spec.ts` | Browse marketplace → open modal → confirm buy → success state; insufficient-balance failure path; disconnected-wallet path |

---

## Writing a new test that requires a wallet

```ts
// e2e/my-new-flow.spec.ts
import { test, expect, mockGetListings } from './fixtures/testnet-wallet';

test.describe('My new flow', () => {
  test.beforeEach(async ({ page, injectFundedWallet }) => {
    await injectFundedWallet(page);
    await mockGetListings(page);          // optional: stub listings
    // add more stubs here as needed
  });

  test('does something', async ({ page }) => {
    await page.goto('/en/marketplace');
    // … assertions
  });
});
```

---

## CI

The `e2e` job in `.github/workflows/nftopia-frontend.yml`:

- runs on every PR and push that touches `nftopia-frontend/**`
- builds the Next.js app and starts it with `next start`
- funds the testnet wallet via Friendbot (requires `E2E_WALLET_ADDRESS` secret)
- runs `npm run e2e` against the built server
- uploads the Playwright HTML report as a workflow artifact on failure
