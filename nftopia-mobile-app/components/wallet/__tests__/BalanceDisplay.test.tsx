import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import BalanceDisplay from '@/components/wallet/BalanceDisplay';

function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

function textContents(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Text as never).map((n) => {
    const children = (n.props as { children: unknown }).children;
    return Array.isArray(children) ? children.join('') : String(children);
  });
}

describe('BalanceDisplay (#470 fiat additions)', () => {
  it('renders only the raw XLM balance when no fiatPrice is given (unchanged default behavior)', () => {
    const renderer = render(
      <BalanceDisplay xlmBalance="100" tokenBalances={[]} isLoading={false} />,
    );
    const texts = textContents(renderer).join(' ');
    expect(texts).toContain('100.0000');
    expect(texts).not.toContain('$');
  });

  it('renders the fiat equivalent alongside the raw XLM balance when fiatPrice is given', () => {
    const renderer = render(
      <BalanceDisplay xlmBalance="100" tokenBalances={[]} isLoading={false} fiatPrice={0.12} />,
    );
    const texts = textContents(renderer).join(' ');
    expect(texts).toContain('100.0000');
    expect(texts).toContain('$12.00');
  });

  it('honors a non-default fiat currency', () => {
    const renderer = render(
      <BalanceDisplay
        xlmBalance="100"
        tokenBalances={[]}
        isLoading={false}
        fiatPrice={0.11}
        fiatCurrency="EUR"
      />,
    );
    const texts = textContents(renderer).join(' ');
    expect(texts).toContain('€11.00');
  });

  it('does not render a fiat line when the XLM balance itself is unknown', () => {
    const renderer = render(
      <BalanceDisplay xlmBalance={null} tokenBalances={[]} isLoading={false} fiatPrice={0.12} />,
    );
    expect(textContents(renderer).join(' ')).not.toContain('$');
  });

  it('shows a stale indicator only when fiatStale is true', () => {
    const stale = render(
      <BalanceDisplay
        xlmBalance="100"
        tokenBalances={[]}
        isLoading={false}
        fiatPrice={0.12}
        fiatStale
      />,
    );
    const fresh = render(
      <BalanceDisplay
        xlmBalance="100"
        tokenBalances={[]}
        isLoading={false}
        fiatPrice={0.12}
        fiatStale={false}
      />,
    );
    expect(stale.root.findAllByProps({ accessibilityLabel: 'Price may be outdated' })).toHaveLength(1);
    expect(fresh.root.findAllByProps({ accessibilityLabel: 'Price may be outdated' })).toHaveLength(0);
  });

  it('degrades gracefully: a null fiatPrice never breaks the raw balance render', () => {
    expect(() =>
      render(
        <BalanceDisplay xlmBalance="100" tokenBalances={[]} isLoading={false} fiatPrice={null} />,
      ),
    ).not.toThrow();
  });
});
