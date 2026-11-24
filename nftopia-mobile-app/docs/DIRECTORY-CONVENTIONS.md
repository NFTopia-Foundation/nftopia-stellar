# Directory conventions (#549)

This app has accumulated both root-level directories (`components/`,
`screens/`, `stores/`) and an `src/`-prefixed tree (`src/components/`,
`src/stores/`, `src/screens/`) from an incremental, never-fully-completed
migration. Several concerns ended up duplicated between the two as a
result — `authStore.ts`, the Auth screens, and `Toast.tsx` were the three
found and resolved here.

## Going forward

**New files go under `src/`.** It's the more actively maintained tree —
`src/services`, `src/hooks`, `src/components`, `src/utils`, `src/theme`,
`src/analytics`, `src/errors` are all where current feature work lands.
Root-level `components/`, `screens/`, `navigation/`, and `stores/` remain in
place because they're still the live implementation for *specific*
concerns (see below) — they are not being actively deprecated wholesale,
just no longer where new code should be added.

## How each existing duplicate was resolved

When a concern existed in both trees, the deciding question was **which
one is actually reachable from the app's real entry point** — not the
directory prefix. Checking just the prefix would have gotten two of these
three backwards:

- **`authStore.ts`** — only `stores/authStore.ts` exists; the `src/stores/`
  copy this issue was filed against had already been removed by the time
  of this consolidation. Every consumer (`navigation/AppNavigator.tsx`,
  `hooks/useAuth.ts`, and the rest) already imports the single remaining
  file.
- **Auth screens** — `screens/Auth/` is canonical: `navigation/AuthNavigator.tsx`
  imports every screen (`OnboardingScreen`, `WalletSelectionScreen`,
  `WalletCreateScreen`, `WalletImportScreen`, `EmailLoginScreen`,
  `EmailRegisterScreen`) from there, and it's the complete set. `src/screens/auth/`
  held only two of those six screens, as a different, never-wired
  implementation (a standalone `onComplete`-callback API rather than a
  React Navigation screen) with its own local subcomponents
  (`MnemonicConfirmation`, `MnemonicDisplay`, `SecretKeyInput`). Nothing in
  the app rendered it. Deleted rather than merged — the two
  implementations solved the same problem differently enough that there
  was nothing to merge, and the live version is the complete, tested,
  actually-reachable one.
- **`Toast.tsx`** — here the `src/`-prefixed copy is canonical, the
  opposite of the two cases above. `src/components/Toast.tsx` renders from
  `stores/toastStore.ts` via `src/hooks/useToast.ts`, which real screens
  call (`screens/Auth/AppLockScreen.tsx`, `screens/Wallet/TransactionHistoryScreen.tsx`,
  `src/components/SessionManager.tsx`, `src/components/NetworkStatusManager.tsx`,
  and others). The root-level `components/Toast.tsx` was a separate,
  self-contained React Context provider (its own `ToastProvider`/`useToast`,
  unrelated to the store-backed one) that `App.tsx` mounted as a sibling of
  the navigator — but nothing anywhere ever called its `useToast()` to
  actually show a toast. It was dead weight, not a working duplicate: removed,
  along with the mount in `App.tsx` (the canonical `ToastContainer` is
  already rendered by `app/_layout.tsx`'s `AppLayout`, which `App.tsx` wraps
  everything in regardless).

**The rule, stated plainly:** before deleting one side of a duplicate,
grep for its actual consumers (navigator imports, hook call sites) rather
than assuming the newer-looking or `src/`-prefixed copy is the live one.
Actually being wired up beats directory naming convention every time.
