import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator, Text, TextInput, TouchableOpacity } from 'react-native';
import TransactionFeeSummary from '@/components/wallet/TransactionFeeSummary';
import type { FeeEstimate } from '@/src/services/stellar/wallet.service';

function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

/** `<Text>{a} literal</Text>` renders `children` as an array of parts, not
 * one concatenated string — flatten each Text node's children into a
 * single string so assertions can do plain substring checks. */
function textContents(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Text as never).map((n) => {
    const children = (n.props as { children: unknown }).children;
    return Array.isArray(children) ? children.join('') : String(children);
  });
}

function makeEstimate(overrides: Partial<FeeEstimate> = {}): FeeEstimate {
  return {
    operationCount: 1,
    feePerOperationStroops: '100',
    totalFeeStroops: '100',
    totalFeeXlm: '0.00001',
    tiers: {
      low: { tier: 'low', feePerOperationStroops: '100' },
      medium: { tier: 'medium', feePerOperationStroops: '100' },
      high: { tier: 'high', feePerOperationStroops: '2000' },
    },
    breakdown: [{ label: 'Send Payment', feeStroops: '100', feeXlm: '0.00001' }],
    isSurge: false,
    degraded: false,
    ...overrides,
  };
}

const noop = () => {};

describe('TransactionFeeSummary (#471)', () => {
  it('shows a loading indicator instead of a total while the estimate is still loading', () => {
    const renderer = render(
      <TransactionFeeSummary
        estimate={null}
        loading
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
      />,
    );
    expect(renderer.root.findAllByType(ActivityIndicator as never)).toHaveLength(1);
  });

  it('renders the total fee in XLM once the estimate resolves', () => {
    const renderer = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
      />,
    );
    const texts = textContents(renderer);
    expect(texts).toContain('0.00001 XLM');
  });

  it('renders an optional fiat line only when a fiatFormatter is given', () => {
    const withFiat = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
        fiatFormatter={() => '$0.01'}
      />,
    );
    const withoutFiat = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
      />,
    );
    const withFiatTexts = textContents(withFiat);
    const withoutFiatTexts = textContents(withoutFiat);
    expect(withFiatTexts.join(' ')).toContain('$0.01');
    expect(withoutFiatTexts.join(' ')).not.toContain('$0.01');
  });

  it('shows a surge-pricing badge only when the estimate flags surge pricing', () => {
    const surging = render(
      <TransactionFeeSummary
        estimate={makeEstimate({ isSurge: true })}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
      />,
    );
    const normal = render(
      <TransactionFeeSummary
        estimate={makeEstimate({ isSurge: false })}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
      />,
    );
    const surgingTexts = textContents(surging);
    const normalTexts = textContents(normal);
    expect(surgingTexts.some((t) => t.includes('congestion'))).toBe(true);
    expect(normalTexts.some((t) => t.includes('congestion'))).toBe(false);
  });

  it('shows a degraded-estimate note only when the estimate is degraded', () => {
    const renderer = render(
      <TransactionFeeSummary
        estimate={makeEstimate({ degraded: true })}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
      />,
    );
    const texts = textContents(renderer);
    expect(texts.some((t) => t.includes('unavailable'))).toBe(true);
  });

  it('renders a per-operation breakdown only for multi-operation transactions', () => {
    const single = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
        testID="fee"
      />,
    );
    const multi = render(
      <TransactionFeeSummary
        estimate={makeEstimate({
          operationCount: 2,
          totalFeeStroops: '200',
          totalFeeXlm: '0.00002',
          breakdown: [
            { label: 'Add Trustline', feeStroops: '100', feeXlm: '0.00001' },
            { label: 'Send Payment', feeStroops: '100', feeXlm: '0.00001' },
          ],
        })}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
        testID="fee"
      />,
    );
    expect(single.root.findAllByProps({ testID: 'fee-breakdown' })).toHaveLength(0);
    expect(multi.root.findAllByProps({ testID: 'fee-breakdown' })).toHaveLength(1);
    const multiTexts = textContents(multi);
    expect(multiTexts).toContain('Add Trustline');
    expect(multiTexts).toContain('Send Payment');
  });

  it('fires onSelectTier when a tier button is pressed', () => {
    const onSelectTier = jest.fn();
    const renderer = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={onSelectTier}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
      />,
    );
    const highButton = renderer.root.findByProps({ accessibilityLabel: 'Priority fee' });
    act(() => {
      (highButton.props as { onPress: () => void }).onPress();
    });
    expect(onSelectTier).toHaveBeenCalledWith('high');
  });

  it('hides the tier selector and shows a custom fee input in advanced mode', () => {
    const renderer = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee
        onToggleCustomFee={noop}
        customFeeStroops="500"
        onCustomFeeChange={noop}
      />,
    );
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Priority fee' })).toHaveLength(0);
    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.value).toBe('500');
  });

  it('fires onToggleCustomFee when the advanced toggle is pressed', () => {
    const onToggleCustomFee = jest.fn();
    const renderer = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={onToggleCustomFee}
        customFeeStroops=""
        onCustomFeeChange={noop}
      />,
    );
    const toggle = renderer.root.findByProps({
      accessibilityLabel: 'Set a custom fee',
    }) as unknown as TestRenderer.ReactTestInstance;
    act(() => {
      (toggle.props as { onPress: () => void }).onPress();
    });
    expect(onToggleCustomFee).toHaveBeenCalledWith(true);
  });

  it('renders a custom fee validation error when given', () => {
    const renderer = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee
        onToggleCustomFee={noop}
        customFeeStroops="1"
        onCustomFeeChange={noop}
        customFeeError="Must be at least 100 stroops"
      />,
    );
    const texts = textContents(renderer);
    expect(texts).toContain('Must be at least 100 stroops');
  });

  it('renders a reserve warning as an alert when given, and does not render one otherwise', () => {
    const withWarning = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
        reserveWarning="This would leave your account below the minimum reserve."
      />,
    );
    const withoutWarning = render(
      <TransactionFeeSummary
        estimate={makeEstimate()}
        loading={false}
        selectedTier="medium"
        onSelectTier={noop}
        useCustomFee={false}
        onToggleCustomFee={noop}
        customFeeStroops=""
        onCustomFeeChange={noop}
      />,
    );
    expect(withWarning.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
    expect(withoutWarning.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0);
  });
});
