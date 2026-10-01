/**
 * Testnet Wallet Fixture Strategy
 * ================================
 * This module provides a reusable pattern for injecting a funded Stellar
 * testnet wallet into Playwright e2e tests without going through a real
 * browser-extension popup flow.
 *
 * ## How it works
 *
 * 1. A static testnet keypair is held in environment variables (or the
 *    fallback values below). The secret key should ONLY be a throwaway
 *    Stellar testnet account – never a mainnet key.
 *
 * 2. `injectWalletState` writes the serialised wallet state directly into
 *    `localStorage` (matching the Zustand `stellar-wallet-store` key used
 *    by `stores/walletStore.ts`) before the page loads.  This bypasses the
 *    extension signing popup while keeping the rest of the buy flow real.
 *
 * 3. `mockBuyNFTSuccess` / `mockBuyNFTInsufficientBalance` intercept the
 *    GraphQL `buyNFT` mutation so the test stays deterministic and never
 *    touches an actual contract on-chain.  The interception is opt-in –
 *    remove it to run against a live testnet back-end.
 *
 * ## Reusing this fixture in new tests
 *
 *   import { test } from './fixtures/testnet-wallet';
 *
 *   test('my new flow', async ({ page, injectFundedWallet }) => {
 *     await injectFundedWallet(page);
 *     // … your test steps
 *   });
 *
 * ## Environment variables
 *
 *   E2E_WALLET_ADDRESS   – Stellar public key for the funded testnet account
 *   E2E_WALLET_SECRET    – Stellar secret key (never commit a real value)
 *   E2E_FUNDED           – Set to "false" to simulate an unfunded wallet
 *
 * ## Funded testnet account setup (CI / local)
 *
 *   The account referenced by E2E_WALLET_ADDRESS must have been funded with
 *   Friendbot before running tests that hit the live network.
 *
 *   npx ts-node -e "
 *     const addr = process.env.E2E_WALLET_ADDRESS;
 *     fetch(\`https://friendbot.stellar.org?addr=\${addr}\`)
 *       .then(r => r.json()).then(console.log);
 *   "
 *
 *   In CI this is handled by the `Fund testnet wallet` step added to the
 *   GitHub Actions workflow.
 */

import { test as baseTest, Page, Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Wallet address used by default.  Override via E2E_WALLET_ADDRESS. */
export const DEFAULT_TESTNET_ADDRESS =
  process.env.E2E_WALLET_ADDRESS ||
  'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV5EU9PGVGA';

/** Stellar network the tests target. */
export const E2E_NETWORK = 'testnet' as const;

/** localStorage key used by the Zustand wallet store. */
const WALLET_STORE_KEY = 'stellar-wallet-store';

// ---------------------------------------------------------------------------
// Wallet state injection
// ---------------------------------------------------------------------------

/**
 * Write a connected wallet state into localStorage so the app thinks a
 * Freighter wallet is already connected, without triggering any browser
 * extension popup.
 *
 * Call this before navigating to any page that requires a connected wallet.
 */
export async function injectWalletState(
  page: Page,
  options: {
    address?: string;
    connected?: boolean;
    provider?: string;
  } = {},
): Promise<void> {
  const {
    address = DEFAULT_TESTNET_ADDRESS,
    connected = true,
    provider = 'freighter',
  } = options;

  const walletState = {
    state: {
      address: connected ? address : null,
      provider: connected ? provider : null,
      network: E2E_NETWORK,
      connected,
      connecting: false,
      error: null,
    },
    version: 0,
  };

  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: WALLET_STORE_KEY, value: JSON.stringify(walletState) },
  );
}

// ---------------------------------------------------------------------------
// GraphQL network interception helpers
// ---------------------------------------------------------------------------

/**
 * Intercept the `buyNFT` GraphQL mutation and respond with a success payload.
 * The listing is resolved deterministically without hitting the real backend.
 */
export async function mockBuyNFTSuccess(
  page: Page,
  options: { listingId?: string; buyerId?: string } = {},
): Promise<void> {
  const { listingId = 'test-listing-1', buyerId = DEFAULT_TESTNET_ADDRESS } =
    options;

  await page.route('**/graphql', async (route: Route) => {
    const request = route.request();
    const body = request.postDataJSON?.() as { operationName?: string } | null;

    if (body?.operationName === 'BuyNFT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            buyNFT: {
              success: true,
              listingId,
              buyerId,
            },
          },
        }),
      });
      return;
    }
    await route.continue();
  });
}

/**
 * Intercept the `buyNFT` mutation and return an insufficient-balance error.
 * Use this to exercise the failure-path branch of the purchase modal.
 */
export async function mockBuyNFTInsufficientBalance(page: Page): Promise<void> {
  await page.route('**/graphql', async (route: Route) => {
    const request = route.request();
    const body = request.postDataJSON?.() as { operationName?: string } | null;

    if (body?.operationName === 'BuyNFT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          errors: [
            {
              message: 'Insufficient balance to complete this purchase.',
              extensions: { code: 'INSUFFICIENT_BALANCE' },
            },
          ],
        }),
      });
      return;
    }
    await route.continue();
  });
}

/**
 * Intercept the `GetListings` GraphQL query and return a predictable set of
 * NFT listings so the marketplace page always has content regardless of
 * back-end state.
 */
export async function mockGetListings(page: Page): Promise<void> {
  await page.route('**/graphql', async (route: Route) => {
    const request = route.request();
    const body = request.postDataJSON?.() as { operationName?: string } | null;

    if (body?.operationName === 'GetListings') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            listings: {
              edges: [
                {
                  node: {
                    id: 'test-listing-1',
                    price: '10',
                    currency: 'XLM',
                    status: 'ACTIVE',
                    listingType: 'FIXED_PRICE',
                    nft: {
                      id: 'test-nft-1',
                      name: 'E2E Test NFT',
                      image: null,
                      tokenId: 'TOKEN-001',
                    },
                    seller: {
                      id: 'seller-1',
                      username: 'e2e_seller',
                      walletAddress: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBZGZG7E3J2P5HA7MFFK5',
                    },
                  },
                  cursor: 'cursor-1',
                },
              ],
              pageInfo: {
                hasNextPage: false,
                startCursor: 'cursor-1',
                endCursor: 'cursor-1',
              },
              totalCount: 1,
            },
          },
        }),
      });
      return;
    }
    await route.continue();
  });
}

// ---------------------------------------------------------------------------
// Custom Playwright test fixture
// ---------------------------------------------------------------------------

type WalletFixtures = {
  /** Call this inside a test to inject a connected funded wallet state. */
  injectFundedWallet: (page: Page) => Promise<void>;
  /** Call this to inject a wallet state with zero balance (disconnected). */
  injectEmptyWallet: (page: Page) => Promise<void>;
};

/**
 * Extended `test` object that pre-wires the wallet fixtures.
 * Import this instead of `@playwright/test` in any test that needs a wallet.
 *
 * @example
 *   import { test, expect } from '../fixtures/testnet-wallet';
 */
export const test = baseTest.extend<WalletFixtures>({
  injectFundedWallet: async ({}, use) => {
    await use((page: Page) =>
      injectWalletState(page, { connected: true }),
    );
  },

  injectEmptyWallet: async ({}, use) => {
    await use((page: Page) =>
      injectWalletState(page, {
        connected: false,
        address: undefined,
      }),
    );
  },
});

export { expect } from '@playwright/test';
