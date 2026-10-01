import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Text, TouchableOpacity } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';

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

describe('EmptyState (#472)', () => {
  beforeEach(() => {
    (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
  });

  it('renders the title and subtitle', () => {
    const renderer = render(
      <EmptyState title="No NFTs yet" subtitle="Listings will show up here." />,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('No NFTs yet');
    expect(texts).toContain('Listings will show up here.');
  });

  it('renders no action button when none is given', () => {
    const renderer = render(<EmptyState title="No NFTs yet" />);
    expect(renderer.root.findAllByType(TouchableOpacity as never)).toHaveLength(0);
  });

  it('renders and fires the action callback when one is given', () => {
    const onPress = jest.fn();
    const renderer = render(
      <EmptyState
        title="No favorites yet"
        action={{ label: 'Browse Marketplace', onPress }}
      />,
    );
    const button = renderer.root.findByType(TouchableOpacity as never);
    expect(button.props.accessibilityLabel).toBe('Browse Marketplace');

    act(() => {
      (button.props as { onPress: () => void }).onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes accessibilityRole and a live region for screen readers', () => {
    const renderer = render(<EmptyState title="No NFTs yet" />);
    const container = renderer.root.findByProps({ accessibilityRole: 'text' });
    expect(container.props.accessibilityLiveRegion).toBe('polite');
    expect(container.props.accessible).toBe(true);
  });

  it('announces the title and subtitle to screen readers on mount', () => {
    render(<EmptyState title="No NFTs yet" subtitle="Check back soon." />);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'No NFTs yet. Check back soon.',
    );
  });

  describe('no-data vs. filtered variants render visually distinct messaging', () => {
    it('"no-data" (default) and "filtered" use different default icons', () => {
      const noData = render(<EmptyState title="No NFTs yet" />);
      const filtered = render(
        <EmptyState variant="filtered" title="No matches" />,
      );

      const noDataIcon = noData.root.findAllByType(Text as never)[0].props.children;
      const filteredIcon = filtered.root.findAllByType(Text as never)[0].props.children;
      expect(noDataIcon).not.toBe(filteredIcon);
    });

    it('renders whatever distinct title/subtitle each variant is given', () => {
      const noData = render(
        <EmptyState title="No NFTs yet" subtitle="Nothing has been listed." />,
      );
      const filtered = render(
        <EmptyState
          variant="filtered"
          title="No results found"
          subtitle="Try different keywords or filters."
        />,
      );

      const noDataTexts = noData.root
        .findAllByType(Text as never)
        .map((n) => n.props.children);
      const filteredTexts = filtered.root
        .findAllByType(Text as never)
        .map((n) => n.props.children);

      expect(noDataTexts).toContain('No NFTs yet');
      expect(filteredTexts).toContain('No results found');
      expect(noDataTexts).not.toEqual(filteredTexts);
    });
  });
});
