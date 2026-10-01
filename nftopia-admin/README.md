# NFTopia Admin
**Operations Dashboard Shell**

![React](https://img.shields.io/badge/React-19-149eca)
![Vite](https://img.shields.io/badge/Vite-8-646cff)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

NFTopia Admin is the internal dashboard workspace for platform operations. It is intended to host moderation tools, collection management workflows, marketplace controls, and operational analytics for the wider NFTopia ecosystem.

At the moment, this app is a clean React + Vite + Tailwind foundation rather than a fully wired admin product. The current UI confirms that the frontend shell, styling system, and build pipeline are in place and ready for actual admin modules.

## 🌟 Current Status

- **React 19 + Vite 8** project is configured and running.
- **Tailwind CSS v4** is integrated and verified in the main app shell.
- **TypeScript build pipeline** and **ESLint** are already set up.
- **Admin authentication** (email/password + optional 2FA) against `nftopia-backend`, gated on the `ADMIN` role claim. See [Authentication](#-authentication).
- No routing or admin-specific data modules have been implemented yet.

## 📋 Table of Contents

1. [Purpose](#-purpose)
2. [Current Implementation](#-current-implementation)
3. [Project Structure](#-project-structure)
4. [Quick Start](#-quick-start)
5. [Available Scripts](#-available-scripts)
6. [Authentication](#-authentication)
7. [Recommended Next Modules](#-recommended-next-modules)

## 🎯 Purpose

This workspace is the right place to build internal tools for:

- collection review and takedown workflows
- user moderation and support operations
- listing, bid, and order monitoring
- marketplace analytics dashboards
- feature flags and operational controls

## 🧱 Current Implementation

The current `src/App.tsx` renders a branded placeholder page that explicitly states the admin app is configured and ready for module development. That makes this workspace useful as a starting point, but not yet production-ready as an operations console.

## 📁 Project Structure

```text
nftopia-admin/
├── public/               # Static assets
├── src/
│   ├── App.tsx           # Dashboard shell, rendered only for authenticated admins
│   ├── auth/             # Auth API client, store, token storage, React provider
│   ├── pages/            # Login screen
│   ├── App.css           # App-level styling
│   ├── index.css         # Global styles and Tailwind layers
│   ├── main.tsx          # React bootstrap entry
│   └── assets/           # Local app assets
├── package.json          # Scripts and dependencies
├── vite.config.ts        # Vite configuration
└── eslint.config.js      # ESLint flat config
```

## 🚀 Quick Start

```bash
cd nftopia-admin
npm install
npm run dev
```

The Vite dev server will print the local URL in the terminal.

## 🛠️ Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run TypeScript build and create a production bundle |
| `npm run preview` | Preview the production bundle locally |
| `npm run lint` | Run ESLint against the workspace |
| `npm test` | Run the Vitest suite |

## 🔐 Authentication

The whole app sits behind a login screen. Operators sign in with their NFTopia email and password via `POST /auth/email/login`; accounts with 2FA enabled complete a second step via `POST /auth/2fa/challenge`.

**Configuration:** set `VITE_API_URL` to the backend API base (default `http://localhost:3000/api/v1`). The backend must list the admin origin in `CORS_ALLOWED_ORIGINS`.

**Admin role check:** the backend signs the user's `role` into the access token. Only tokens with `role: "ADMIN"` are accepted; any other account is rejected with a clear "no admin access" message and nothing is stored. The backend still enforces roles on every admin endpoint (`RolesGuard`), so the client check is for UX, not security.

**Token storage strategy:**

- Only the **access token** is persisted, in **`sessionStorage`** (key `nftopia-admin.access_token`). It is scoped to one tab and cleared when the tab or browser closes.
- The **refresh token is never stored**, so an admin session cannot silently outlive its access token. When it expires, the operator signs in again.
- `localStorage` is not used, so sessions are not shared across tabs or kept across browser restarts.
- The backend returns tokens in the response body rather than as `HttpOnly` cookies, so cookie storage isn't available without backend changes. For an internal tool, short-lived tab-scoped tokens are the trade-off chosen here.

**Session lifecycle:**

- **Logout** clears the stored token, the in-memory user and the expiry timer, then returns to the login screen.
- **Expiry:** a timer fires at the token's `exp`, and the token is re-checked whenever the tab becomes visible again. An expired, malformed or non-admin stored token is discarded, and the login screen shows "Your session has expired".
- **Invalid tokens:** API calls made through `createAuthorizedFetch` (in `src/auth/authorizedFetch.ts`) attach the bearer token. Any `401` response ends the session the same way.

## 🧭 Recommended Next Modules

Suggested first implementation targets for this workspace:

1. Admin authentication and role gating.
2. Collection moderation table with status filters.
3. Marketplace incident view for listings, bids, and disputes.
4. User and wallet lookup tied to backend admin endpoints.
5. Search and analytics panels backed by the NFTopia backend.

Until those are added, treat this app as a prepared UI shell.