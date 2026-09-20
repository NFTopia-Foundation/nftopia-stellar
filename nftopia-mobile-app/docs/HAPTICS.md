# Haptics

All tactile feedback in the app flows through a single module: [`lib/haptics.ts`](../lib/haptics.ts).
Do **not** import `expo-haptics` directly in components — use the presets below so
feedback stays consistent across similar interactions and so the user's
preference and platform support are always respected.

## Pattern-to-interaction mapping

| Preset      | Native pattern            | Use for                                                                 |
| ----------- | ------------------------- | ----------------------------------------------------------------------- |
| `press`     | `impact` light            | Primary/secondary button press, card tap, list row tap                  |
| `longPress` | `impact` heavy            | Long-press gestures (context menu, hold-to-act)                         |
| `toggle`    | selection changed         | Favorites/like toggle, switch flip, selection-style toggles             |
| `select`    | selection changed         | Radio/segmented choices, picker selections, tab changes                 |
| `confirm`   | `impact` medium           | Confirming a transaction/action (non-destructive)                       |
| `cancel`    | `impact` light            | Dismissing a confirmation dialog / cancelling an action                 |
| `success`   | `notification` success    | Completed transaction, successful send/mint/bid, async confirm resolved |
| `warning`   | `notification` warning    | Destructive confirmation prompt, risky action acknowledgement           |
| `error`     | `notification` error      | Form validation failure, rejected transaction, failed async action      |

## Usage

```ts
import { haptics } from '@/lib/haptics';

haptics.press();        // light tap
haptics.toggle();       // favorite / switch flip
haptics.success();      // transaction succeeded
haptics.error();        // validation failed
haptics.trigger('warning'); // preset by name
```

Every helper returns a promise but is safe to call fire-and-forget: errors from
devices without a haptic engine are swallowed and never surface as warnings or
crashes.

## Guards

Two guards run before any native call:

1. **Platform capability** — `isHapticsSupported()` returns `true` only on
   `ios` and `android`. Web and any other platform no-op safely.
2. **User preference** — when the **Reduce haptics** toggle in Settings is on
   (`usePreferencesStore.reduceHaptics === true`), every call is suppressed.

Use the lower-level `haptics.impact`, `haptics.notification`, and
`haptics.selection` only when a preset genuinely does not fit.

## Adding new interactions

1. Pick the closest existing preset. Reuse it rather than adding a new one.
2. Only if no preset fits, add a named preset to `HapticPreset` and the `PRESETS`
   table in `lib/haptics.ts`, and document it in the mapping above.
3. Wire it through the shared module — never call `expo-haptics` in a component.
