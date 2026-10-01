import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import AmountField, { sanitizeAmountInput } from '@/components/ui/AmountField';

function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

describe('sanitizeAmountInput (#468)', () => {
  it('strips non-numeric characters', () => {
    expect(sanitizeAmountInput('12a3b.4c')).toBe('123.4');
  });

  it('keeps a single decimal point, dropping later ones', () => {
    expect(sanitizeAmountInput('1.2.3.4')).toBe('1.234');
  });

  it('truncates the fractional part to maxDecimals (default 7)', () => {
    expect(sanitizeAmountInput('1.123456789')).toBe('1.1234567');
  });

  it('honors a custom maxDecimals', () => {
    expect(sanitizeAmountInput('1.123456789', 2)).toBe('1.12');
  });

  it('drops the decimal point entirely when maxDecimals is 0', () => {
    expect(sanitizeAmountInput('1.5', 0)).toBe('15');
  });

  it('passes a plain integer through unchanged', () => {
    expect(sanitizeAmountInput('42')).toBe('42');
  });

  it('handles an empty string', () => {
    expect(sanitizeAmountInput('')).toBe('');
  });

  it('preserves a trailing decimal point while typing', () => {
    expect(sanitizeAmountInput('1.')).toBe('1.');
  });
});

describe('AmountField (#468)', () => {
  it('uses a decimal-pad keyboard', () => {
    const renderer = render(<AmountField value="" onChangeText={jest.fn()} />);
    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.keyboardType).toBe('decimal-pad');
  });

  it('sanitizes input before calling onChangeText', () => {
    const onChangeText = jest.fn();
    const renderer = render(<AmountField value="" onChangeText={onChangeText} />);
    const input = renderer.root.findByType(TextInput as never);

    act(() => {
      (input.props as { onChangeText: (t: string) => void }).onChangeText('12abc.34.56');
    });
    expect(onChangeText).toHaveBeenCalledWith('12.3456');
  });

  it('applies a custom maxDecimals to live input', () => {
    const onChangeText = jest.fn();
    const renderer = render(<AmountField value="" onChangeText={onChangeText} maxDecimals={2} />);
    const input = renderer.root.findByType(TextInput as never);

    act(() => {
      (input.props as { onChangeText: (t: string) => void }).onChangeText('9.999');
    });
    expect(onChangeText).toHaveBeenCalledWith('9.99');
  });

  it('forwards label/error/testID like any other TextField', () => {
    const renderer = render(
      <AmountField label="Amount" value="10" onChangeText={jest.fn()} error="Too low" testID="amount" />,
    );
    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.testID).toBe('amount');
    expect(input.props.value).toBe('10');
  });
});
