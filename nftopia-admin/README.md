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
- No backend integration, routing, auth, or admin-specific data modules have been implemented yet.

## 📋 Table of Contents

1. [Purpose](#-purpose)
2. [Current Implementation](#-current-implementation)
3. [Project Structure](#-project-structure)
4. [Quick Start](#-quick-start)
5. [Available Scripts](#-available-scripts)
6. [Recommended Next Modules](#-recommended-next-modules)

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
│   ├── App.tsx           # Current placeholder dashboard shell
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

## 🧭 Recommended Next Modules

Suggested first implementation targets for this workspace:

1. Admin authentication and role gating.
2. Collection moderation table with status filters.
3. Marketplace incident view for listings, bids, and disputes.
4. User and wallet lookup tied to backend admin endpoints.
5. Search and analytics panels backed by the NFTopia backend.

Until those are added, treat this app as a prepared UI shell.