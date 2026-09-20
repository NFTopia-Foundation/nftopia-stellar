jest.mock('react-native', () => require('@/src/test-mocks/react-native').default);

import React from 'react';
import renderer from 'react-test-renderer';
import { AccessibilityInfo, ActivityIndicator } from 'react-native';
import ErrorState from '@/components/ui/ErrorState';

const render = (props: Record<string, unknown>): any =>
  renderer.create(React.createElement(ErrorState, props as any) as any);

describe('ErrorState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders error defaults with an assertive alert region', () => {
    const tree = render({ testID: 'error', onRetry: jest.fn() });
    const container = tree.root.findByType('View');
    expect(container.props.accessibilityRole).toBe('alert');
    expect(container.props.accessibilityLiveRegion).toBe('assertive');

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Something went wrong');
    expect(json).toContain('⚠️');
  });

  it('renders a distinct offline variant', () => {
    const tree = render({ testID: 'error', variant: 'offline', onRetry: jest.fn() });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('You are offline');
    expect(json).toContain('📶');
    expect(json).not.toContain('⚠️');
  });

  it('re-triggers the failed fetch through onRetry', () => {
    const onRetry = jest.fn();
    const tree = render({ testID: 'error', onRetry });
    tree.root.findByProps({ testID: 'error-retry' }).props.onPress();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not surface a rejected retry promise', () => {
    const onRetry = jest.fn().mockRejectedValue(new Error('nope'));
    const tree = render({ testID: 'error', onRetry });
    expect(() =>
      tree.root.findByProps({ testID: 'error-retry' }).props.onPress(),
    ).not.toThrow();
  });

  it('disables the retry button and shows a spinner while retrying', () => {
    const onRetry = jest.fn();
    const tree = render({ testID: 'error', onRetry, isRetrying: true });
    const button = tree.root.findByProps({ testID: 'error-retry' });
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(1);
  });

  it('announces the failure to screen readers', () => {
    render({ testID: 'error', onRetry: jest.fn() });
    jest.runAllTimers();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Something went wrong. We could not load this list. Please try again.',
    );
  });
});
