# NFTopia Mobile App
**Expo Mobile Client for Wallet and Marketplace Flows**

![Expo](https://img.shields.io/badge/Expo-53-1b1f23)
![React%20Native](https://img.shields.io/badge/React%20Native-0.79-149eca)
![Stellar](https://img.shields.io/badge/Stellar-Mobile%20Wallets-111827)
![Zustand](https://img.shields.io/badge/Zustand-State-4338ca)
![Jest](https://img.shields.io/badge/Jest-Tested-c21325)

NFTopia Mobile App is the React Native surface for onboarding users, creating or importing Stellar wallets, and navigating a mobile-native NFT experience. The current implementation focuses on authentication flow, secure local persistence, navigation structure, and core Stellar wallet services that the broader marketplace UX can build on.

## 🌟 Key Features

- **Expo-based cross-platform app** for iOS and Android
- **Conditional authentication navigation** with splash, auth, and main navigators
- **Stellar wallet create/import flows** backed by `stellar-sdk` and `stellar-hd-wallet`
- **Secure local persistence** using Expo Secure Store and token storage helpers
- **Zustand auth state** with initialization and logout flows
- **Unit tests** around auth store and wallet services

## 📋 Table of Contents

1. [Architecture](#-architecture)
2. [Current Screen Map](#-current-screen-map)
3. [Quick Start](#-quick-start)
4. [Available Scripts](#-available-scripts)
5. [Project Structure](#-project-structure)
6. [Authentication and Wallet Layer](#-authentication-and-wallet-layer)
7. [Testing](#-testing)
8. [Repository Notes](#-repository-notes)

## 🏗️ Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                       NFTopia Mobile App                          │
├────────────────────────────────────────────────────────────────────┤
│ App.tsx                                                           │
│   └── AppNavigator                                                │
│       ├── SplashScreen when auth is initializing                  │
│       ├── AuthNavigator when signed out                           │
│       └── MainNavigator when signed in                            │
├────────────────────────────────────────────────────────────────────┤
│ State and Services                                                │
│  stores/authStore.ts                                              │
│  src/services/auth/*                                              │
│  src/services/stellar/*                                           │
├────────────────────────────────────────────────────────────────────┤
│ Persistence                                                       │
│  expo-secure-store + token storage helpers                        │
└────────────────────────────────────────────────────────────────────┘
```

## 🗺️ Current Screen Map

The workspace currently organizes UI and flow code around these groups:

- `screens/Auth` for onboarding, wallet selection, wallet creation, wallet import, and email auth screens
- `screens/Home`, `screens/Marketplace`, and `screens/Profile` for primary app areas
- `navigation/AppNavigator.tsx` for auth-aware routing
- `navigation/AuthNavigator.tsx` and `navigation/MainNavigator.tsx` for stack separation

## 🚀 Quick Start

```bash
cd nftopia-mobile-app
npm install
npm start
```

Run on a specific platform:

```bash
npm run android
npm run ios
npm run web
```

At the moment, the codebase does not consume any explicit `EXPO_PUBLIC_*` variables, so there is no required env template for local startup.

## 🛠️ Available Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the Expo development server |
| `npm run android` | Start the app on Android |
| `npm run ios` | Start the app on iOS |
| `npm run web` | Start the app in web mode |
| `npm test` | Run Jest tests |

## 📁 Project Structure

```text
nftopia-mobile-app/
├── components/                 # Shared UI pieces including SplashScreen
├── navigation/                 # AppNavigator, AuthNavigator, MainNavigator
├── screens/                    # Auth, Home, Marketplace, Profile screens
├── src/
│   ├── services/
│   │   ├── auth/               # Auth services and token storage
│   │   └── stellar/            # Wallet generation, import, validation
│   └── stores/                 # Store-related logic and tests
├── stores/                     # Zustand auth store
├── types/                      # Auth and app types
├── __tests__/                  # Workspace tests
├── ARCHITECTURE-DIAGRAM.md
├── NAVIGATION-README.md
└── AUTH-NAVIGATION-SETUP.md
```

## 🔐 Authentication and Wallet Layer

The current mobile foundation centers on local auth and Stellar wallet setup:

- `navigation/AppNavigator.tsx` decides between auth and main stacks based on Zustand state.
- `stores/authStore.ts` initializes auth state and persists session-related information.
- `src/services/stellar/wallet.service.ts` and related validation helpers manage Stellar wallet creation, import, and key handling.
- `src/services/auth/tokenStorage.ts` handles persisted token/session storage.

This means the app is well-positioned for backend integration, but still best described as a mobile foundation plus auth flow rather than a fully completed marketplace client.

## 🧪 Testing

```bash
npm test
```

There are tests for wallet services, auth services, and auth store behavior in the repository.

## 📌 Repository Notes

- Older docs in this workspace mention ArgentX, Braavos, or Starknet terminology. The active wallet service code is built around Stellar.
- The navigation and auth documentation files remain useful references for the current implementation:
  - `ARCHITECTURE-DIAGRAM.md`
  - `NAVIGATION-README.md`
  - `AUTH-NAVIGATION-SETUP.md`
  - `QUICK-NAV-REFERENCE.md`