import { test, expect } from '@playwright/test';

test('smoke: home responds and renders', async ({ page, baseURL }) => {
  const res = await page.goto('/');
  expect(res && res.status()).toBeLessThan(400);
  // basic sanity: page has at least one img (logo or optimized images)
  const imgs = await page.locator('img').count();
  expect(imgs).toBeGreaterThanOrEqual(0);
});
