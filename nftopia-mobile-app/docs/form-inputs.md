# Form input component library (`components/ui/TextField.tsx` and variants)

A shared base and set of variants for every text-style input in the app, replacing ad hoc, duplicated label/error/focus styling in `FormInput.tsx`, `SecureInput.tsx`, and `MnemonicInput.tsx` (#468).

## Variants

| Component | File | Use for |
| --- | --- | --- |
| `TextField` | `components/ui/TextField.tsx` | The shared base. Use directly for any new free-form text input. |
| `FormInput` | `screens/Auth/components/FormInput.tsx` | Auth-flow inputs (email, name, etc). |
| `SecureInput` | `components/wallet/SecureInput.tsx` | Secret entry with a show/hide toggle (private keys). |
| `MnemonicInput` | `components/wallet/MnemonicInput.tsx` | Recovery-phrase entry, paste or word-by-word. |
| `AmountField` | `components/ui/AmountField.tsx` | Numeric/decimal amounts (XLM, fiat). |
| `SelectField` | `components/ui/SelectField.tsx` | Dropdown/select from a fixed list of options. |
| `ValidationError` | `components/ui/ValidationError.tsx` | Standalone error message, e.g. a form-level (not field-level) error. Used internally by `TextField`. |

## `TextField`

```tsx
import TextField from '@/components/ui/TextField';

<TextField
  label="Display name"
  placeholder="Enter your name"
  value={name}
  onChangeText={setName}
  error={nameError}
  testID="display-name"
/>
```

Key props:
- `label`, `error`, `helperText` — `helperText` is hidden whenever `error` is set, so a field never shows two conflicting messages at once.
- `statusText` — always rendered, independent of error state (e.g. a running word/character count). See `MnemonicInput`'s paste mode.
- `rightAccessory` — rendered inside the bordered wrapper after the `TextInput` (e.g. `SecureInput`'s show/hide button).
- `containerStyle` / `inputStyle` — style overrides for the outer container / the `TextInput` itself, for variant-specific tweaks (e.g. `SecureInput`'s monospace font) without forking the component.
- Everything else (`value`, `onChangeText`, `keyboardType`, `multiline`, `secureTextEntry`, `autoCapitalize`, `returnKeyType`, `onSubmitEditing`, etc.) is a plain passthrough `TextInputProps`.
- `accessibilityLabel` defaults to `label`; `accessibilityHint` defaults to the error message when one is present.

Error text is rendered via the shared `ValidationError` component (alert role, polite live region, announced to screen readers on change) — every `TextField`-based input therefore displays and announces errors identically.

## Focus/blur/error colors

Border and background colors for every input state live in one place, `fieldColors` in `constants/theme.tsx`:

```ts
export const fieldColors = {
  border, borderFocused, borderError,
  background, backgroundFocused, backgroundError, backgroundDisabled,
};
```

`TextField` and `SelectField` both read from here. Don't hardcode a hex value for a border or background in a new input variant — add or reuse a token here instead, so a future palette change (or dark-mode pass) only touches this one place.

## `AmountField`

```tsx
import AmountField from '@/components/ui/AmountField';

<AmountField
  label="Amount (XLM)"
  value={amount}
  onChangeText={setAmount}
  maxDecimals={7} // default — Stellar's native asset precision
  error={amountError}
/>
```

Every keystroke is sanitized (`sanitizeAmountInput`, also exported for reuse/testing) before `onChangeText` is called: non-digit/non-`.` characters are stripped, only the first `.` is kept, and the fractional part is truncated to `maxDecimals`. The field can never hold a value `Number()` chokes on — range/affordability checks (e.g. SendScreen's minimum-reserve check) remain the caller's own business logic.

## `SelectField`

```tsx
import SelectField from '@/components/ui/SelectField';

<SelectField
  label="Language"
  placeholder="Select a language"
  value={language}
  onValueChange={setLanguage}
  options={[
    { label: 'English', value: 'en' },
    { label: 'French', value: 'fr' },
  ]}
/>
```

The trigger is a `TextField`-styled button; tapping it opens a `BottomSheet` (#469) listing the options. Screen-reader focus moves into the option list on open and restores to the trigger on close via `BottomSheet`'s own `restoreFocusRef` handling — `SelectField` doesn't re-implement focus trapping itself. Each option is its own accessible button (`accessibilityRole="menuitem"`, `accessibilityState={{ selected }}`), so both screen-reader swipe navigation and sequential/tab navigation (where the host supports it, e.g. a connected keyboard or react-native-web) reach every option in order.

## Migrating an existing raw `TextInput`

1. Swap the `View`/`Text`/`TextInput` trio for `TextField` (or a variant), passing the same `value`/`onChangeText`/`error`.
2. Move any custom border/background logic to read from `fieldColors` if it doesn't already fit one of `TextField`'s built-in states (focused/error/disabled).
3. If the input needs something `TextField` doesn't expose (e.g. an inline button), use `rightAccessory` rather than duplicating the wrapper.

`FormInput`, `SecureInput`, and `MnemonicInput`'s own prop APIs are unchanged by this refactor — no caller needed to change (see their existing usage in `EmailLoginScreen`, `EmailRegisterScreen`, `WalletImportScreen`, `WalletCreateScreen`).
