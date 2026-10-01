# Haptic feedback (`lib/haptics.ts`)

Centralized haptic utility (#467) wrapping `expo-haptics`' impact/notification/selection patterns behind named, semantic presets — so the same kind of interaction always feels the same everywhere it happens, and no component reaches into `expo-haptics` directly.

## Usage

```ts
import { haptics } from '@/lib/haptics';

haptics.tap();      // a light press
haptics.success();  // an action completed
```

Every call is a no-op, synchronously, when:
- the platform has no haptic engine (web), or
- the user has turned on **Settings → Accessibility → Reduce haptics**.

A haptic call also never throws or rejects, even on a device whose vibration hardware fails — a haptic is always best-effort, decorative feedback, never load-bearing. Callers don't need their own `try/catch` around it.

## Pattern-to-interaction mapping

| Preset | Underlying call | Use for |
| --- | --- | --- |
| `haptics.tap()` | Light impact | A light, low-commitment press — secondary buttons, list items, Cancel. |
| `haptics.tapStrong()` | Medium impact | A more deliberate press — primary CTAs, a dialog's Confirm button. |
| `haptics.heavy()` | Heavy impact | A destructive or heavy-commitment action — e.g. long-press to delete. |
| `haptics.toggleOn()` | Medium impact | Enabling a switch or favoriting something. |
| `haptics.toggleOff()` | Light impact | Disabling a switch or unfavoriting something — lighter, since turning something off is lower-stakes than turning it on. |
| `haptics.select()` | Selection | One discrete step through a picker/selector list. |
| `haptics.success()` | Success notification | An action's *outcome*: a transaction, mint, or bid completed. |
| `haptics.warning()` | Warning notification | A recoverable problem worth noticing but not a hard failure. |
| `haptics.error()` | Error notification | A validation failure, or a failed transaction/mint/bid. |

`success`/`warning`/`error` describe an *outcome*, not a tap — fire them where the result of an operation becomes known (a promise resolving/rejecting), not on the button press that started it. `tap`/`tapStrong`/`heavy`/`toggleOn`/`toggleOff`/`select` describe the *press itself*.

For a one-off case that doesn't fit a named preset, `haptics.impact('light' | 'medium' | 'heavy')`, `haptics.notification('success' | 'warning' | 'error')`, and `haptics.selection()` are the lower-level primitives every preset above is built from. `haptics.trigger(style)` dispatches a single style name (`'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'`) to whichever of the two it belongs to — used by `useTouchFeedback`, which exposes that exact union to its own callers.

## Where it's wired in

- **`ConfirmationDialog`** — `tapStrong()` on Confirm, `tap()` on Cancel. `onConfirm` may return a `Promise`; if it rejects, `error()` fires (a fallback for callers that don't already show their own failure UI — see below).
- **Send / mint / bid flows** (`SendScreen`, `MintNFTScreen`, `AuctionDetailScreen`) — `success()` right before their own "Sent"/"Success"/"Bid placed" alert, `error()` in their own catch block alongside their own failure alert. These fire independently of `ConfirmationDialog`'s own tap feedback, since only the screen that owns the async operation knows its real outcome.
- **`ValidationError`** (`components/ui/ValidationError.tsx`) — `error()` whenever a message appears, alongside its existing screen-reader announcement. Every input built on `TextField` (#468) — `FormInput`, `SecureInput`, `MnemonicInput`, `AmountField`, `SelectField` — gets this for free, plus any screen using `ValidationError` directly for a form-level error (`WalletImportScreen`, `WalletCreateScreen`).
- **Toggles** — `FavoriteButton` and the Settings screen's `Toggle`/`Switch` helper both fire `toggleOn()`/`toggleOff()` based on the new value.
- **Generic press feedback** — `InteractiveButton`, `InteractiveCard`, `InteractiveListItem`, `AuthButton`, and the `useTouchFeedback`/`usePullToRefresh` hooks all route through `haptics` instead of calling `expo-haptics` directly (previously duplicated, ad hoc `Haptics.impactAsync(...)` calls in each file).

## The "Reduce haptics" preference

`stores/preferencesStore.ts` holds `reduceHaptics: boolean` (default `false`), exposed in **Settings → Accessibility**. `lib/haptics.ts` reads it via `usePreferencesStore.getState().reduceHaptics` on every call (not a React hook — haptic calls happen from event handlers, not render), so toggling it takes effect immediately without needing to re-mount anything.

## Adding haptics to a new flow

1. `import { haptics } from '@/lib/haptics';`
2. Pick a preset from the table above by what kind of interaction it is (a press vs. an outcome), not by what it happens to feel like.
3. Don't wrap the call in your own `try/catch` or platform check — `lib/haptics.ts` already guards both.
