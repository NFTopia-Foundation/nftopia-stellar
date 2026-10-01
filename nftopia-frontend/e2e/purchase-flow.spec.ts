/**
 * E2E: Marketplace Purchase Flow
 * ================================
 * Covers the core revenue-generating journey:
 *   browse marketplace → open purchase modal → confirm buy → success state
 *
 * A secondary case exercises the insufficient-balance failure path.
 *
 * All network calls are intercepted via the testnet-wallet fixture so the
 * suite is deterministic and never touches a live backend or Soroban
 * contract.  See e2e/fixtures/testnet-wallet.ts for the interception helpers
 * and the documented strategy for swapping in a live testnet backend.
 */

import {
  test,
  expect,
  mockGetListings,
  mockBuyNFTSuccess,
  mockBuyNFTInsufficientBalance,
} from './fixtures/testnet-wallet';

// ---------------------------------------------------------------------------
// Shared locale prefix – the app uses locale-based routing (/en/marketplace)
// ---------------------------------------------------------------------------
const LOCALE = 'en';
const MARKETPLACE_URL = `/${LOCALE}/marketplace`;

// ---------------------------------------------------------------------------
// Happy path: browse → buy → success
// ---------------------------------------------------------------------------

test.describe('Purchase flow – happy path', () => {
  test.beforeEach(async ({ page, injectFundedWallet }) => {
    // 1. Inject the funded testnet wallet state into localStorage before any
    //    navigation so the app considers the wallet already connected.
    await injectFundedWallet(page);

    // 2. Stub the GraphQL layer so the test does not depend on a running
    //    backend.  Both stubs must be registered before the first navigation.
    await mockGetListings(page);
    await mockBuyNFTSuccess(page, { listingId: 'test-listing-1' });
  });

  test('marketplace renders at least one NFT card', async ({ page }) => {
    await page.goto(MARKETPLACE_URL);

    // Wait for the listings grid to appear (TodaysPicks section)
    const firstCard = page.locator('[data-testid="nft-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Buy Now opens the purchase modal with correct NFT details', async ({
    page,
  }) => {
    await page.goto(MARKETPLACE_URL);

    // Wait for NFT cards
    await page
      .locator('[data-testid="nft-card"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    // Click the first "Buy Now" button
    const buyNowBtn = page
      .locator('[data-testid="buy-now-btn"]')
      .first();
    await buyNowBtn.click();

    // Modal should be visible
    const modal = page.locator('[data-testid="purchase-modal"]');
    await expect(modal).toBeVisible();

    // Modal heading
    await expect(modal.getByRole('heading', { name: /complete purchase/i })).toBeVisible();

    // NFT name and price should appear inside the modal
    await expect(modal.getByText('E2E Test NFT')).toBeVisible();
    await expect(modal.getByText(/10.*XLM/i)).toBeVisible();
  });

  test('confirming the purchase shows the success state', async ({ page }) => {
    await page.goto(MARKETPLACE_URL);

    await page
      .locator('[data-testid="nft-card"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await page.locator('[data-testid="buy-now-btn"]').first().click();

    const modal = page.locator('[data-testid="purchase-modal"]');
    await expect(modal).toBeVisible();

    // Click the confirm button
    await modal.locator('[data-testid="confirm-purchase-btn"]').click();

    // Success state
    await expect(
      modal.getByText(/purchase successful/i),
    ).toBeVisible({ timeout: 8_000 });

    await expect(
      modal.getByText(/you now own e2e test nft/i),
    ).toBeVisible();

    // Redirect notice
    await expect(
      modal.getByText(/redirecting to your collection/i),
    ).toBeVisible();
  });

  test('cancelling the modal closes it without submitting', async ({ page }) => {
    await page.goto(MARKETPLACE_URL);

    await page
      .locator('[data-testid="nft-card"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await page.locator('[data-testid="buy-now-btn"]').first().click();

    const modal = page.locator('[data-testid="purchase-modal"]');
    await expect(modal).toBeVisible();

    await modal.locator('[data-testid="cancel-purchase-btn"]').click();

    // Modal should be gone
    await expect(modal).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Failure path: insufficient balance
// ---------------------------------------------------------------------------

test.describe('Purchase flow – insufficient balance', () => {
  test.beforeEach(async ({ page, injectFundedWallet }) => {
    await injectFundedWallet(page);
    await mockGetListings(page);
    // Override the buy mutation to return an insufficient-balance error
    await mockBuyNFTInsufficientBalance(page);
  });

  test('shows an error message when the wallet has insufficient balance', async ({
    page,
  }) => {
    await page.goto(MARKETPLACE_URL);

    await page
      .locator('[data-testid="nft-card"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await page.locator('[data-testid="buy-now-btn"]').first().click();

    const modal = page.locator('[data-testid="purchase-modal"]');
    await expect(modal).toBeVisible();

    await modal.locator('[data-testid="confirm-purchase-btn"]').click();

    // Error banner should appear
    await expect(
      modal.getByText(/insufficient balance/i),
    ).toBeVisible({ timeout: 8_000 });

    // Modal must remain open so the user can act
    await expect(modal).toBeVisible();

    // Success state must NOT appear
    await expect(modal.getByText(/purchase successful/i)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Disconnected-wallet path
// ---------------------------------------------------------------------------

test.describe('Purchase flow – wallet not connected', () => {
  test.beforeEach(async ({ page, injectEmptyWallet }) => {
    // Inject a disconnected wallet so the modal shows "Connect Wallet First"
    await injectEmptyWallet(page);
    await mockGetListings(page);
  });

  test('shows Connect Wallet button when wallet is disconnected', async ({
    page,
  }) => {
    await page.goto(MARKETPLACE_URL);

    await page
      .locator('[data-testid="nft-card"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 });

    await page.locator('[data-testid="buy-now-btn"]').first().click();

    const modal = page.locator('[data-testid="purchase-modal"]');
    await expect(modal).toBeVisible();

    // Should see the wallet-connection CTA, not the confirm button
    await expect(
      modal.getByRole('button', { name: /connect wallet first/i }),
    ).toBeVisible();

    await expect(
      modal.locator('[data-testid="confirm-purchase-btn"]'),
    ).not.toBeVisible();
  });
});
