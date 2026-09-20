jest.mock('react-native', () => require('@/src/test-mocks/react-native').default);

import React from 'react';
import renderer from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import EmptyState from '@/components/ui/EmptyState';

const render = (props: Record<string, unknown>): any =>
  renderer.create(React.createElement(EmptyState, props as any) as any);

describe('EmptyState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders no-data defaults inside a polite live region', () => {
    const tree = render({ testID: 'empty' });
    const container = tree.root.findByType('View');
    expect(container.props.accessibilityLiveRegion).toBe('polite');

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Nothing here yet');
    expect(json).toContain('✨');
  });

  it('renders a visually distinct filtered variant', () => {
    const noData = JSON.stringify(render({ testID: 'a' }).toJSON());
    const filtered = render({ testID: 'b', variant: 'filtered' });
    const json = JSON.stringify(filtered.toJSON());

    expect(json).toContain('No results found');
    expect(json).toContain('🔍');
    expect(json).not.toContain('✨');
    expect(json).not.toBe(noData);
  });

  it('invokes the primary CTA callback', () => {
    const onCta = jest.fn();
    const tree = render({ testID: 'empty', ctaLabel: 'Browse', onCta });
    tree.root.findByProps({ testID: 'empty-action-0' }).props.onPress();
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('falls back to onRetry when no CTA is provided', () => {
    const onRetry = jest.fn();
    const tree = render({ testID: 'empty', onRetry });
    tree.root.findByProps({ testID: 'empty-action-0' }).props.onPress();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses onClearFilters for the filtered variant', () => {
    const onClearFilters = jest.fn();
    const tree = render({
      testID: 'empty',
      variant: 'filtered',
      clearFiltersLabel: 'Clear filters',
      onClearFilters,
    });
    tree.root.findByProps({ testID: 'empty-action-0' }).props.onPress();
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('supports a secondary CTA slot', () => {
    const onSecondaryCta = jest.fn();
    const tree = render({
      testID: 'empty',
      ctaLabel: 'Primary',
      onCta: jest.fn(),
      secondaryCtaLabel: 'Secondary',
      onSecondaryCta,
    });
    tree.root.findByProps({ testID: 'empty-action-1' }).props.onPress();
    expect(onSecondaryCta).toHaveBeenCalledTimes(1);
  });

  it('announces the state change to screen readers', () => {
    render({ testID: 'empty' });
    jest.runAllTimers();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Nothing here yet. New items will show up here once they are available.',
    );
  });

  it('lets consumers override the copy', () => {
    const tree = render({ testID: 'empty', title: 'No favorites', message: 'Save something first.' });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('No favorites');
    expect(json).toContain('Save something first.');
  });
});
