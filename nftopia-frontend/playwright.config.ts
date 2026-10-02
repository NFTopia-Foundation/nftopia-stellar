import { defineConfig, devices } from '@playwright/test';

/**
 * By default the suite runs against whatever `PLAYWRIGHT_BASE_URL` points at
 * (or a developer's own `next dev` on :5000).
 *
 * Set `E2E_MOCK_BACKEND=1` to make Playwright boot the app itself against the
 * deterministic auction fixture backend in `e2e/mock-backend.mjs`. That is how
 * the auction bid flow is exercised in CI: the auction route is server
 * rendered from GraphQL, so the fixture backend has to be in place before
 * `next dev` serves a request.
 */
const mockBackend = process.env.E2E_MOCK_BACKEND === '1';
const startApp = mockBackend && !process.env.PLAYWRIGHT_BASE_URL;

const mockApiPort = Number(process.env.E2E_MOCK_API_PORT || 4321);
const appPort = Number(process.env.E2E_APP_PORT || 5000);

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${appPort}`,
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 5000,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: startApp
    ? [
        {
          command: 'node e2e/mock-backend.mjs',
          url: `http://127.0.0.1:${mockApiPort}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 30 * 1000,
        },
        {
          command: 'npm run dev',
          url: `http://127.0.0.1:${appPort}`,
          reuseExistingServer: !process.env.CI,
          timeout: 180 * 1000,
          env: {
            NEXT_PUBLIC_API_URL: `http://127.0.0.1:${mockApiPort}`,
            NEXT_PUBLIC_GRAPHQL_URL: `http://127.0.0.1:${mockApiPort}/graphql`,
            NEXT_PUBLIC_GRAPHQL_WS_URL: `ws://127.0.0.1:${mockApiPort}/graphql`,
          },
        },
      ]
    : undefined,
});
