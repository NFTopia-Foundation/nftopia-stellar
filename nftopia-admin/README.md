# NFTopia Admin
**Operations Dashboard**

![React](https://img.shields.io/badge/React-19-149eca)
![Vite](https://img.shields.io/badge/Vite-8-646cff)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

NFTopia Admin is the internal operations console: moderation (collection
verification, content flags, user bans), settlement operations (the
transaction-retry/DLQ screen), and a platform metrics dashboard, all backed
by real `nftopia-backend` endpoints.

## 🌟 Current Status

This README previously described the app as an unwired shell with "no
routing or admin-specific data modules... implemented yet." That stopped
being true some time ago — several issues closed on GitHub as done
actually landed the real screens, but this file was never updated to say
so, so it kept contradicting the live app. This rewrite reflects what's
actually in `src/` today; see [Available Screens](#-available-screens)
for the honest per-screen status instead of a blanket claim.

- **Routing & auth**: a real router with per-route protection — see
  [Routing & Authentication](#-routing--authentication).
- **Six working screens** (Dashboard, Users, Collections, Content Flags,
  Transaction Retry, and the Users detail view) consuming live backend
  data, plus **one remaining stub** (Settings).
- **Shared `DataTable` component** (sorting, pagination, loading/error/empty
  states) used by at least one screen, with a documented
  [testing convention](#-testing-convention) for adding more.

## 📋 Table of Contents

1. [Purpose](#-purpose)
2. [Routing & Authentication](#-routing--authentication)
3. [Available Screens](#-available-screens)
4. [Project Structure](#-project-structure)
5. [Quick Start](#-quick-start)
6. [Available Scripts](#-available-scripts)
7. [API Client & Data Fetching](#-api-client--data-fetching)
8. [Transaction Retries (DLQ)](#-transaction-retries-dlq)
9. [Testing Convention](#-testing-convention)
10. [Known Gaps](#-known-gaps)

## 🎯 Purpose

This workspace hosts internal tools for:

- collection review and takedown workflows
- user moderation and support operations
- AI-moderation content-flag review
- settlement/transaction-retry (DLQ) operations
- platform metrics and analytics

## 🧭 Routing & Authentication

`src/App.tsx` mounts a real `react-router-dom` `BrowserRouter` with one
route per screen, plus a dedicated `/login` route. Each protected route is
wrapped individually by `ProtectedRoute` (`src/components/ProtectedRoute.tsx`,
#698) rather than the whole router depending on a single top-level check:

- **Unauthenticated**: visiting any protected URL redirects to `/login`.
  `/login` itself isn't wrapped by `ProtectedRoute` (that would bounce
  right back) — once `state.status` becomes `'authenticated'`, `/login`'s
  own route redirects *away* to `/dashboard`, so a stale bookmark or
  back-navigation to `/login` can't strand a signed-in user on the login
  form.
- **`ProtectedRoute` takes an optional `requireRole` prop** reserved for a
  future narrower-than-"authenticated" gate (e.g. a super-admin-only
  route). It's typed and accepted today but not enforced — nothing passes
  it yet, and no such role exists in the auth system.
- **The Transaction Retry nav item and route** are additionally gated on
  `canManageDlq(role)` (`src/dlq/access.ts`), independent of the general
  auth gate — see [Transaction Retries](#-transaction-retries-dlq).

**Sign-in**: operators authenticate with email/password via
`POST /auth/email/login`; accounts with 2FA complete a second step via
`POST /auth/2fa/challenge`. Only a token with `role: "ADMIN"` is accepted
client-side — the backend's `RolesGuard` enforces this for real on every
admin endpoint, so the client check is a UX nicety, not the security
boundary.

**Configuration**: set `VITE_API_URL` to the backend API base (default
`http://localhost:3000/api/v1`); the backend must list the admin origin in
`CORS_ALLOWED_ORIGINS`.

**Token storage**: only the access token is kept, in `sessionStorage`
(`nftopia-admin.access_token`) — scoped to one tab, cleared on tab/browser
close. The refresh token is never stored, so a session can't silently
outlive its access token; when it expires, the operator signs in again.
`localStorage` is deliberately unused.

**Session lifecycle**: logout clears the stored token, in-memory user, and
expiry timer, then returns to `/login`. A timer fires at the token's
`exp`, re-checked whenever the tab regains visibility; an expired,
malformed, or non-admin stored token is discarded with a "Your session
has expired" notice. Any `401` from `createAuthorizedFetch`
(`src/auth/authorizedFetch.ts`) ends the session the same way.

## ✅ Available Screens

| Screen | Route | Status | Notes |
| --- | --- | --- | --- |
| Dashboard | `/dashboard` | **Working** | Real aggregate platform metrics (users, listings, volume, active auctions) via `src/metrics/platformMetricsApi.ts`, with a time-range selector and loading/error states. |
| Users | `/users` | **Working** | Search (debounced) + status filter, built on the shared `DataTable`. Row click opens `UserDetailModal` (profile / Stellar wallets with live balance / activity summary / moderation audit trail), with ban (required reason + confirmation) and unban (confirmation) wired to the real backend endpoints. |
| Collections | `/collections` | **Working** | Collection verification queue: metadata/artwork preview per item, a time-pending indicator flagging anything over the 48h SLA, and approve/reject (reject requires a reason) each behind their own confirm step. |
| Content Flags | `/content-flags` | **Working** | AI-moderation review queue: resolve (mark reviewed / dismiss) behind a confirm step, bulk resolve. |
| Transaction Retry (DLQ) | `/transaction-retry` | **Working, role-gated** | See [Transaction Retries](#-transaction-retries-dlq). Only registered as a route/nav item for `DLQ_ROLES`. |
| Settings | `/settings` | **Stub** | Renders a "Settings module — coming soon" placeholder (`src/pages/SettingsPage.tsx`). Not part of this round of work; tracked as a gap below, not claimed as done. |

## 📁 Project Structure

```text
nftopia-admin/
├── public/                 # Static assets
├── src/
│   ├── App.tsx             # Router: /login + ProtectedRoute-wrapped AppShell routes
│   ├── main.tsx             # React bootstrap: QueryClientProvider > AuthProvider > App
│   ├── auth/                # Auth API client, store, token storage, React provider/hook
│   ├── components/          # AppShell, DataTable, dialogs, DLQ/metrics panels, ProtectedRoute
│   ├── pages/                # One file per screen (see the table above)
│   ├── dlq/                  # DLQ API client, access control, stats helpers
│   ├── metrics/               # Platform metrics API client + formatters
│   ├── lib/                    # Shared QueryClient + the authorized API client/query hooks
│   ├── utils/                   # Small pure helpers (explorerUrl, time-pending formatting, …)
│   ├── locales/                  # en/es i18n resource files
│   ├── __tests__/                 # See Testing Convention below
│   ├── i18n.ts, App.css, index.css
│   └── assets/
├── package.json
├── vite.config.ts
└── eslint.config.js
```

## 🚀 Quick Start

```bash
cd nftopia-admin
npm install
npm run dev
```

The Vite dev server prints the local URL in the terminal.

## 🛠️ Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run TypeScript build and create a production bundle |
| `npm run preview` | Preview the production bundle locally |
| `npm run lint` | Run ESLint against the workspace |
| `npm test` | Run the Vitest suite |

## 🔌 API Client & Data Fetching

Every screen should fetch data through the shared layer in `src/lib/api/`
rather than hand-rolling `fetch` calls, so auth-header attachment and
401-handling are never reimplemented per screen:

- **`useApiClient()`** returns the authorized `fetch` instance
  (`createAuthorizedFetch` bound to the current auth store) — use this
  directly for a one-off request or a mutation.
- **`useAuthorizedQuery<T>(queryKey, path, options?)`** wraps that client in
  a [TanStack Query](https://tanstack.com/query) `useQuery` call: `path` is
  relative to `VITE_API_URL`, a non-2xx response throws `ApiRequestError`
  (with `.status`), and a `401` has already ended the session (same as any
  other authorized call) by the time the error surfaces — callers don't
  need to special-case it.
- The shared `QueryClient` (`src/lib/queryClient.ts`) is mounted once in
  `src/main.tsx`; new screens don't need their own provider.

```ts
const { data, isLoading, error } = useAuthorizedQuery<{ users: User[] }>(
  ['users', page],
  `/admin/users?limit=15&offset=${(page - 1) * 15}`,
)
```

`UsersPage.tsx` and most other screens predate this layer and still manage
their own fetch/loading state directly via `createAuthorizedFetch` — a
reasonable reference for the response-unwrapping pattern (the backend
wraps payloads as `{ data: {...} }` or `{ data: { success, data } }`), but
new screens should build on `useAuthorizedQuery` instead of copying the
manual `useState`/`useEffect` approach.

Tests: `src/__tests__/useAuthorizedQuery.test.tsx`.

## 🔁 Transaction Retries (DLQ)

`/transaction-retry` is the operations screen for failed settlements, built
on the `transaction-retry` routes in
`nftopia-backend/src/modules/transaction/transaction-retry.controller.ts`.

- **Metrics**: counts from `GET metrics` (DLQ size, retries in flight, failure rate), rendered by `DlqMetricsPanel`. The 7-day trend and recent activity come from the newest 100 entries of `GET dlq`, because the metrics route only returns current counts.
- **List**: `GET dlq`, 20 per page, newest first, with status and attempt count (`DlqTable`).
- **Retry**: `POST dlq/:retryId/retry`, with an optional reason. The row stays on screen as `pending` until the next refresh.
- **Cancel**: `DELETE :retryId`. Offered only for a re-queued (`pending`/`processing`) row; the backend refuses to cancel an entry that is still in the DLQ.
- **Bulk retry**: `POST dlq/bulk-retry` with a `limit` (1–100). The backend re-queues the newest `limit` entries, not a selection. The operator must type `RETRY <count>` to confirm.
- **Clean up**: `DELETE cleanup/:days`. The operator must type `CLEANUP <days>` to confirm, and the screen shows the server's reply as-is. At the time of writing, the backend route is a placeholder and does not delete anything yet.

Access: the route and nav item exist only for roles in `DLQ_ROLES` (`src/dlq/access.ts`), currently `ADMIN`. It's kept separate from general admin-console access so widening who can open the console never widens who can touch the DLQ. When the auth system gets a narrower ops role, change it there and in the backend `@Roles` together.

Tests: `src/__tests__/transactionRetry.test.ts`, `src/__tests__/transactionRetrySingleAction.test.tsx`.

## 🧪 Testing Convention

Tools: [Vitest](https://vitest.dev) + [React Testing Library](https://testing-library.com/react).

- **Location**: every test lives flat in `src/__tests__/`, not next to the
  file it covers — that's the existing convention across this workspace,
  keep following it rather than introducing colocated tests.
- **Naming**: `<thingUnderTest>.test.ts` for a pure module (e.g.
  `dashboard.test.ts`), `<thingUnderTest>.test.tsx` for anything that
  renders a component. Name the file after the screen/component, not the
  issue or feature that added it.
- **jsdom**: component tests need the `// @vitest-environment jsdom`
  docblock as the file's first line — the project's default Vitest
  environment is `node`. A pure-logic test file (no rendering) doesn't
  need it.
- **Pattern — render, interact, assert**: mock `useAuth` (and wrap in a
  real `AuthContext.Provider` if the component reads the context directly
  instead of through the hook — some do, see `routes.test.tsx`'s comment
  on this), stub `fetch` with `vi.stubGlobal`, render with Testing
  Library, then `fireEvent`/`waitFor` through the real UI rather than
  calling internal functions directly. `src/__tests__/contentFlagsQueue.test.tsx`
  and `src/__tests__/collectionsPage.test.tsx` are the clearest screen-level
  examples to copy from; `src/__tests__/dataTable.test.tsx` is the example
  for a shared component tested in isolation, independent of any one screen.
- **No jest-dom**: this project does not have `@testing-library/jest-dom`
  installed. Use plain DOM assertions (`element.getAttribute(...)`,
  `element.disabled`) instead of `toHaveAttribute`/`toBeDisabled` — those
  matchers don't exist here and fail with "Invalid Chai property."
- Run the whole suite with `npm test`, or a single file with
  `npx vitest run src/__tests__/<file>`.

A new contributor adding a screen can copy `collectionsPage.test.tsx` (or
`contentFlagsQueue.test.tsx`) wholesale as a starting point and swap in the
new screen's component, mock data, and assertions.

## 🚧 Known Gaps

- **Settings (`/settings`) is a stub** — see [Available Screens](#-available-screens). Not addressed in this round; a future issue should scope what belongs there.
- **DLQ cleanup** (`DELETE cleanup/:days`) is wired on the frontend but the backend route itself is a placeholder — see [Transaction Retries](#-transaction-retries-dlq).
- **`UsersPage.tsx`'s own fetch pattern predates `useAuthorizedQuery`** — see [API Client & Data Fetching](#-api-client--data-fetching). Not a bug, just not yet migrated.
