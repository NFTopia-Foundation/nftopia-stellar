import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Text } from 'react-native';
import ValidationError from '@/components/ui/ValidationError';

function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

describe('ValidationError (#468 — moved from screens/Auth/components)', () => {
  beforeEach(() => {
    (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
  });

  it('renders nothing when message is null/undefined', () => {
    expect(render(<ValidationError message={null} />).toJSON()).toBeNull();
    expect(render(<ValidationError message={undefined} />).toJSON()).toBeNull();
  });

  it('renders the message text when given', () => {
    const renderer = render(<ValidationError message="Invalid email" />);
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Invalid email');
  });

  it('announces the message to screen readers on mount', () => {
    render(<ValidationError message="Invalid email" />);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Invalid email');
  });

  it('exposes an alert role with a polite live region', () => {
    const renderer = render(<ValidationError message="Invalid email" testID="err" />);
    const container = renderer.root
      .findAllByProps({ testID: 'err' })
      .find((n) => n.props.accessibilityRole === 'alert')!;
    expect(container.props.accessibilityRole).toBe('alert');
    expect(container.props.accessibilityLiveRegion).toBe('polite');
  });
});
