# Bottom Sheet

`components/ui/BottomSheet.tsx` is the shared bottom-sheet primitive for the
mobile app. It wraps [`@gorhom/bottom-sheet`](https://github.com/gorhom/react-native-bottom-sheet)
with the app's theming and adds the behaviour every feature was previously
re-implementing: snap points, swipe/backdrop dismissal, keyboard handling and
screen-reader focus management.

Use it for **marketplace filters, wallet actions and share sheets** instead of
building another `Modal`.

## Setup

The sheet needs the gesture-handler root view and the modal portal host. Both
are already installed in `App.tsx`:

```tsx
import 'react-native-gesture-handler'; // first import in index.ts
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetProvider } from './components/ui/BottomSheet';

<GestureHandlerRootView style={{ flex: 1 }}>
  <BottomSheetProvider>{/* app */}</BottomSheetProvider>
</GestureHandlerRootView>
```

`BottomSheetProvider` also tracks open sheets so `useBottomSheetAccessibility()`
can hide the rest of the tree from screen readers while a sheet is visible.

## Basic usage

Controlled (recommended when the trigger already owns state):

```tsx
import BottomSheet from '@/components/ui/BottomSheet';

const [visible, setVisible] = useState(false);

<BottomSheet
  visible={visible}
  onClose={() => setVisible(false)}
  title="Share"
  snapPoints={['peek', 'half']}
  footer={
    <Button title="Copy link" onPress={copyLink} />
  }
>
  <Text>Share this listing</Text>
</BottomSheet>;
```

Imperative (avoids threading state through several components):

```tsx
const sheetRef = useRef<BottomSheetRef>(null);

<Button title="Filters" onPress={() => sheetRef.current?.present()} />

<BottomSheet ref={sheetRef} onClose={close} title="Filters" snapPoints={['half', 'full']}>
  {/* filter controls */}
</BottomSheet>;
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `visible` | `boolean` | – | Omit to drive imperatively with the ref. |
| `onClose` | `() => void` | – | Fires for backdrop, swipe, back button and ref dismissal. |
| `onOpen` | `() => void` | – | Fires once the sheet is presented. |
| `snapPoints` | `('peek' \| 'half' \| 'full' \| string \| number)[]` | `['half']` | Presets map to 35% / 55% / 90%. Custom `'70%'` or pixel values pass through. |
| `initialSnapIndex` | `number` | `0` | Which snap point to open at. |
| `title` | `string` | – | Renders an accessible header. |
| `footer` | `ReactNode` | – | Pinned below the body. |
| `scrollable` | `boolean` | `false` | Wraps the body in `BottomSheetScrollView`. |
| `enablePanDownToClose` | `boolean` | `true` | Swipe-down dismissal. |
| `closeOnBackdropPress` | `boolean` | `true` | Backdrop tap dismissal. |
| `keyboardBehavior` | `'interactive' \| 'extend' \| 'fillParent'` | `'interactive'` | `interactive` lifts the sheet by the keyboard height. |
| `androidKeyboardInputMode` | `'adjustPan' \| 'adjustResize'` | `'adjustResize'` | Keeps inputs visible on Android. |
| `initialFocusRef` | `RefObject<any>` | – | Screen-reader entry point; falls back to the title/container. |
| `restoreFocusRef` | `RefObject<any>` | – | Focus returns here on close. |
| `testID` | `string` | – | Root id; `-close` and `-scroll` are derived. |

### Ref API

`present()`, `dismiss()`, `close()`, `snapToIndex(index)`, `expand()`,
`collapse()`.

## Keyboard-aware sheets

Sheets containing inputs are keyboard-aware out of the box. Import
`BottomSheetTextInput` from the same module so the library can track focus and
scroll correctly:

```tsx
import BottomSheet, { BottomSheetTextInput } from '@/components/ui/BottomSheet';

<BottomSheet scrollable title="Price filter" snapPoints={['half', 'full']}>
  <BottomSheetTextInput keyboardType="decimal-pad" placeholder="Min price" />
  <BottomSheetTextInput keyboardType="decimal-pad" placeholder="Max price" />
</BottomSheet>;
```

## Accessibility

- On open, focus moves into the sheet (`initialFocusRef` → title → container).
- On close, focus is restored to `restoreFocusRef` when provided.
- `accessibilityViewIsModal` keeps iOS VoiceOver inside the sheet, and
  `useBottomSheetAccessibility()` lets the app root mark the background
  `no-hide-descendants` for Android TalkBack.
- The backdrop is hidden from screen readers; the header title is a `header`.

## Migration notes

`components/wallet/ConfirmationDialog.tsx` now uses this component and keeps its
public props and callbacks unchanged. `components/ui/FilterSheet.tsx` still owns
its own modal and can be migrated the same way (replace the `Modal` +
`KeyboardAvoidingView` wrapper with `BottomSheet`, move actions into `footer`,
and pass price inputs through `BottomSheetTextInput`).
