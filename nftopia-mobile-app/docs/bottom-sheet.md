# BottomSheet (`components/ui/BottomSheet.tsx`)

Shared bottom sheet primitive (#469) wrapping [`@gorhom/bottom-sheet`](https://gorhom.dev/react-native-bottom-sheet/) with app-consistent styling and a declarative `visible`/`onClose` API, so any screen can open a sheet the same way it already opens a dialog — no prop drilling, no per-consumer sheet wiring.

## Setup requirement: `GestureHandlerRootView`

`@gorhom/bottom-sheet` is built on `react-native-gesture-handler` v2, whose gesture recognizers require a `GestureHandlerRootView` wrapping the entire gesture-responding tree. This is already wired in `App.tsx` at the app root — no per-screen setup needed. If you ever see gestures (swipe-to-dismiss, drag handles) fail to respond in a new native entry point (e.g. a separate native module or a second root), check that it's wrapped too.

## Version pin

Installed at `@gorhom/bottom-sheet@^4.6.4`, not the latest v5.x — v5 bumped its `react-native-reanimated`/`react-native-gesture-handler` peer-dependency floors past what this repo has installed (reanimated 3.6.3, gesture-handler 2.14.1). v4.6.4 is the latest version compatible with those. Revisit this pin if/when reanimated and gesture-handler are upgraded.

## Basic usage

```tsx
import { useState } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';

function MyScreen() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      {/* trigger */}
      <BottomSheet visible={visible} onClose={() => setVisible(false)}>
        <Text>Sheet content</Text>
      </BottomSheet>
    </>
  );
}
```

The sheet is fully controlled by `visible`: each consumer owns its own boolean state exactly as it would for a `Modal`, so there's nothing extra to register at the app root and no shared instance to fight over between screens.

`onClose` fires for every way the sheet can close — swipe-down, backdrop tap, or `visible` being set to `false` externally — so it's the single place to sync your own `visible` state back to `false`. Don't also branch on gesture callbacks to detect a close.

## Snap points

```tsx
<BottomSheet snapPoints={['peek', 'half', 'full']} initialSnapIndex={1} ...>
```

Named presets resolve to fixed percentages of screen height:

| Preset | Height | Use for |
| --- | --- | --- |
| `peek` | 25% | A couple of quick actions |
| `half` | 50% | The common case — most sheets |
| `full` | 90% | Long lists, forms; leaves a gap so it still reads as a sheet, not a new screen |

Custom string (`'30%'`) or number (`400`, meaning 400dp) snap points are also accepted and passed straight through, unresolved, for cases the presets don't fit.

`initialSnapIndex` picks which snap point the sheet opens to (defaults to the last/largest one). Order `snapPoints` smallest to largest, as `@gorhom/bottom-sheet` requires.

## Dismiss behavior

- **Swipe-to-dismiss**: on by default; disable with `enablePanDownToClose={false}`.
- **Backdrop-tap-to-close**: on by default (renders a dimmed backdrop below the sheet); disable with `enableBackdropDismiss={false}` for a sheet that must be dismissed via an explicit action instead of an accidental outside tap.

## Keyboard-aware sheets

For a sheet containing a text input, set `keyboardAware`:

```tsx
<BottomSheet keyboardAware ...>
  <BottomSheetTextInput ... />
</BottomSheet>
```

This switches the sheet to resize itself above the keyboard (`keyboardBehavior: 'interactive'`, `keyboardBlurBehavior: 'restore'`, and `android_keyboardInputMode: 'adjustResize'` on Android) instead of the keyboard simply covering the bottom of the sheet.

Use `@gorhom/bottom-sheet`'s own `BottomSheetTextInput` for any input inside the sheet, not the plain React Native `TextInput` — the sheet's own pan gesture and the input's touch handling can otherwise fight each other over touches.

## Accessibility: focus management

React Native has no DOM-style focus trap, so this is handled imperatively:

- **On open**, screen-reader focus moves onto the sheet's content container automatically (`AccessibilityInfo.setAccessibilityFocus`, deferred via `InteractionManager.runAfterInteractions` so it runs after the open animation/interaction settles).
- **On close**, if a `restoreFocusRef` was given, focus moves back onto that element — typically the button that opened the sheet:

```tsx
const openButtonRef = useRef<View>(null);

<TouchableOpacity ref={openButtonRef} onPress={() => setVisible(true)}>
  <Text>Open</Text>
</TouchableOpacity>

<BottomSheet visible={visible} onClose={() => setVisible(false)} restoreFocusRef={openButtonRef} ...>
```

`accessibilityLabel` sets the label announced for the sheet's content region; pass a short description of the sheet's purpose (e.g. a dialog's title). The content container also sets `accessibilityViewIsModal` (iOS-only) so screen-reader swipe navigation stays inside the sheet while it's open.

All of this is best-effort and defensive — a focus-management failure is caught and swallowed rather than ever blocking the sheet itself from opening or closing.

## Performance

Animations (open/close, drag-to-dismiss, backdrop fade) are driven by `react-native-reanimated` worklets running on the UI thread inside `@gorhom/bottom-sheet` itself, not JS-thread `Animated` — so they aren't blocked by JS-thread work and shouldn't drop frames on mid-tier devices under normal use.

## Existing usage: `ConfirmationDialog`

`components/wallet/ConfirmationDialog.tsx` was migrated from a centered `Modal` to this component (#469). Its own props API (`visible`, `title`, `message`, `onConfirm`, `onCancel`, etc.) is unchanged for every caller — only the presentation changed, from a fade-in centered card to a sheet sliding up from the bottom.

## Future consumers

This component is intended for any actions/filters/share-style sheet, for example:

- **Marketplace filters** — a `half` or `full` sheet with filter controls, `enableBackdropDismiss` left on so tapping outside discards in-progress filter changes.
- **Wallet actions** — a `peek` sheet listing 2-3 quick actions for a wallet row.
- **Share sheet** — a `peek`/`half` sheet listing share targets.

Each consumer manages its own `visible` boolean locally; there's no shared/global sheet state to coordinate.
