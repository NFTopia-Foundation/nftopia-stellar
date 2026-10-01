import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Text, TouchableOpacity } from 'react-native';
import { ErrorState } from '@/components/ui/ErrorState';

// react-test-renderer ships its own nested @types/react (independent of
// the project's root one), so its ReactElement type is structurally
// incompatible with the one JSX here resolves to — `as never` sidesteps
// that duplicate-types clash without weakening anything this test asserts.
function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

describe('ErrorState (#472)', () => {
  beforeEach(() => {
    (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
  });

  it('renders default title and subtitle when none are given', () => {
    const renderer = render(<ErrorState />);
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Something went wrong');
  });

  it('renders custom title and subtitle when given', () => {
    const renderer = render(
      <ErrorState title="Failed to load NFTs" subtitle="Check your connection." />,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Failed to load NFTs');
    expect(texts).toContain('Check your connection.');
  });

  it('renders no retry button when onRetry is omitted', () => {
    const renderer = render(<ErrorState />);
    expect(renderer.root.findAllByType(TouchableOpacity as never)).toHaveLength(0);
  });

  it('renders a retry button that calls onRetry when pressed', () => {
    const onRetry = jest.fn();
    const renderer = render(<ErrorState onRetry={onRetry} />);

    const button = renderer.root.findByType(TouchableOpacity as never);
    expect(button.props.accessibilityLabel).toBe('Retry');

    act(() => {
      (button.props as { onPress: () => void }).onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('honors a custom retryLabel', () => {
    const renderer = render(<ErrorState onRetry={jest.fn()} retryLabel="Try again" />);
    const button = renderer.root.findByType(TouchableOpacity as never);
    expect(button.props.accessibilityLabel).toBe('Try again');
  });

  it('exposes an alert role and an assertive live region for screen readers', () => {
    const renderer = render(<ErrorState onRetry={jest.fn()} />);
    const container = renderer.root.findByProps({ accessibilityRole: 'alert' });
    expect(container.props.accessibilityLiveRegion).toBe('assertive');
  });

  it('announces the title and subtitle to screen readers on mount', () => {
    render(<ErrorState title="Failed to load" subtitle="Try again later." />);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Failed to load. Try again later.',
    );
  });

  it('switches to offline-specific default copy for the offline variant', () => {
    const renderer = render(<ErrorState variant="offline" />);
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain("You're offline");
  });

  it('uses a visually distinct icon for offline vs. generic error', () => {
    const error = render(<ErrorState />);
    const offline = render(<ErrorState variant="offline" />);

    const errorIcon = error.root.findAllByType(Text as never)[0].props.children;
    const offlineIcon = offline.root.findAllByType(Text as never)[0].props.children;
    expect(errorIcon).not.toBe(offlineIcon);
  });
});
