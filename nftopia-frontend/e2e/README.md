Playwright E2E tests

Quick start:

1. Install dev dependencies (on your machine):

```bash
cd nftopia-frontend
npm install --save-dev @playwright/test
npx playwright install --with-deps
```

2. Start the dev server (local):

```bash
npm run dev
```

3. Run E2E tests:

```bash
npm run e2e
```

Notes:
- The tests target `http://localhost:5000` by default. Use `PLAYWRIGHT_BASE_URL` to override.
- CI integrations should run `npm run e2e:install` once before `npm run e2e`.
