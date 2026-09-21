/**
 * Shared form-input component library.
 *
 * All variants compose the same base (`TextField`) and resolve their colours
 * from the centralised input tokens in `constants/theme.tsx`, so focus/blur,
 * error and helper styling is identical everywhere.
 *
 * Available variants
 * ------------------
 * - `TextField`   – base input: label, error, helper text, focus/blur frame,
 *                   accessibility wiring, optional left/right accessories and
 *                   a `compact` size for dense layouts.
 * - `AmountField` – numeric/decimal input. Sanitises every change (single
 *                   separator, fraction/integer limits) and can render a
 *                   trailing currency ticker.
 * - `SelectField` – dropdown/select. Keyboard (Arrow/Home/End/Enter/Escape)
 *                   and screen-reader navigable, with `radio` options and
 *                   expanded/selected state exposed.
 * - `ValidationError` – the canonical inline error message used by all of the
 *                   above.
 *
 * Usage
 * -----
 * ```tsx
 * import { TextField, AmountField, SelectField } from '@/components/ui';
 *
 * <TextField label="Email" value={email} onChangeText={setEmail} error={emailError} />
 * <AmountField label="Amount" value={amount} onChangeText={setAmount} currency="XLM" />
 * <SelectField
 *   label="Currency"
 *   value={currency}
 *   onChange={(value) => setCurrency(value)}
 *   options={[{ label: 'XLM', value: 'XLM' }, { label: 'USDC', value: 'USDC' }]}
 * />
 * ```
 *
 * The legacy Auth/wallet inputs (`FormInput`, `SecureInput`, `MnemonicInput`)
 * are thin adapters over `TextField` kept for backwards compatibility; prefer
 * the primitives here for new screens.
 */

export { default as TextField } from './TextField';
export type { TextFieldProps, TextFieldSize } from './TextField';

export { default as AmountField } from './AmountField';
export type { AmountFieldProps } from './AmountField';

export { default as SelectField } from './SelectField';
export type { SelectFieldProps, SelectOption } from './SelectField';

export { default as ValidationError } from './ValidationError';
export type { ValidationErrorProps } from './ValidationError';

export {
  sanitizeAmountInput,
  isValidAmount,
  getNextHighlightIndex,
  type AmountInputOptions,
  type SelectNavigateKey,
} from './inputUtils';
