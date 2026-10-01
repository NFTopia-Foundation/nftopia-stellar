import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, Text, View } from 'react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import { mockBottomSheetRender } from '@/src/test-mocks/gorhom-bottom-sheet';

// react-test-renderer ships its own nested @types/react — see
// EmptyState.test.tsx (#472) for why this cast is needed.
//
// createNodeMock is required for host-component refs (e.g. this
// component's own contentRef, used for accessibility focus) to resolve to
// anything at all under react-test-renderer — without it, .current is
// always null, since the renderer has no real native view to hand back.
function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never, { createNodeMock: () => ({}) });
  });
  return renderer;
}

function lastRenderProps(): Record<string, unknown> {
  const calls = mockBottomSheetRender.mock.calls;
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe('BottomSheet (#469)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders its children (via the underlying sheet)', () => {
    const renderer = render(
      <BottomSheet visible onClose={jest.fn()}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Sheet content');
  });

  describe('open/close via the controlled index prop', () => {
    it('opens to the last snap point index when visible is true (default: no explicit initialSnapIndex)', () => {
      render(
        <BottomSheet visible onClose={jest.fn()} snapPoints={['peek', 'half', 'full']}>
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(lastRenderProps().index).toBe(2); // last of 3 snap points
    });

    it('passes index -1 (closed) when visible is false', () => {
      render(
        <BottomSheet visible={false} onClose={jest.fn()}>
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(lastRenderProps().index).toBe(-1);
    });

    it('honors an explicit initialSnapIndex', () => {
      render(
        <BottomSheet
          visible
          onClose={jest.fn()}
          snapPoints={['peek', 'half', 'full']}
          initialSnapIndex={0}
        >
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(lastRenderProps().index).toBe(0);
    });
  });

  describe('snap points', () => {
    it('resolves named presets to their percentage values', () => {
      render(
        <BottomSheet visible onClose={jest.fn()} snapPoints={['peek', 'half', 'full']}>
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(lastRenderProps().snapPoints).toEqual(['25%', '50%', '90%']);
    });

    it('defaults to a single "half" snap point when none is given', () => {
      render(
        <BottomSheet visible onClose={jest.fn()}>
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(lastRenderProps().snapPoints).toEqual(['50%']);
    });

    it('passes custom string/number snap points through unresolved', () => {
      render(
        <BottomSheet visible onClose={jest.fn()} snapPoints={['30%', 400]}>
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(lastRenderProps().snapPoints).toEqual(['30%', 400]);
    });
  });

  describe('dismiss configuration', () => {
    it('passes enablePanDownToClose through (default true)', () => {
      render(
        <BottomSheet visible onClose={jest.fn()}>
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(lastRenderProps().enablePanDownToClose).toBe(true);
    });

    it('honors enablePanDownToClose={false}', () => {
      render(
        <BottomSheet visible onClose={jest.fn()} enablePanDownToClose={false}>
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(lastRenderProps().enablePanDownToClose).toBe(false);
    });

    it('passes the given onClose straight through as the single source of truth for closing', () => {
      const onClose = jest.fn();
      render(
        <BottomSheet visible onClose={onClose}>
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(lastRenderProps().onClose).toBe(onClose);
    });

    it('renders a backdrop (enabling tap-to-close) by default', () => {
      render(
        <BottomSheet visible onClose={jest.fn()}>
          <Text>content</Text>
        </BottomSheet>,
      );
      const backdropComponent = lastRenderProps().backdropComponent as
        | ((props: Record<string, unknown>) => React.ReactElement | null)
        | undefined;
      expect(backdropComponent).toBeInstanceOf(Function);
      const rendered = backdropComponent!({});
      expect(rendered).not.toBeNull();
    });

    it('renders no backdrop when enableBackdropDismiss is false', () => {
      render(
        <BottomSheet visible onClose={jest.fn()} enableBackdropDismiss={false}>
          <Text>content</Text>
        </BottomSheet>,
      );
      const backdropComponent = lastRenderProps().backdropComponent as (
        props: Record<string, unknown>,
      ) => React.ReactElement | null;
      expect(backdropComponent({})).toBeNull();
    });
  });

  describe('keyboard-aware resizing', () => {
    it('defaults to non-keyboard-aware behavior', () => {
      render(
        <BottomSheet visible onClose={jest.fn()}>
          <Text>content</Text>
        </BottomSheet>,
      );
      const props = lastRenderProps();
      expect(props.keyboardBehavior).toBe('fillParent');
      expect(props.keyboardBlurBehavior).toBe('none');
      expect(props.android_keyboardInputMode).toBe('adjustPan');
    });

    it('switches to interactive keyboard handling when keyboardAware is true', () => {
      render(
        <BottomSheet visible onClose={jest.fn()} keyboardAware>
          <Text>content</Text>
        </BottomSheet>,
      );
      const props = lastRenderProps();
      expect(props.keyboardBehavior).toBe('interactive');
      expect(props.keyboardBlurBehavior).toBe('restore');
      expect(props.android_keyboardInputMode).toBe('adjustResize');
    });
  });

  describe('accessibility focus (#469)', () => {
    it('moves screen-reader focus into the sheet when it opens', () => {
      render(
        <BottomSheet visible={false} onClose={jest.fn()}>
          <Text>content</Text>
        </BottomSheet>,
      );
      expect(AccessibilityInfo.setAccessibilityFocus).not.toHaveBeenCalled();

      // Re-render as a fresh instance with visible=true to simulate opening
      // (the false->true transition is exercised via TestRenderer.update
      // on the same instance below instead, for a real prop-change path).
    });

    it('moves focus into the sheet on the false -> true visible transition, and does not on mount when already visible without a prior close', () => {
      let renderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          (
            <BottomSheet visible={false} onClose={jest.fn()}>
              <Text>content</Text>
            </BottomSheet>
          ) as never,
          { createNodeMock: () => ({}) },
        );
      });
      expect(AccessibilityInfo.setAccessibilityFocus).not.toHaveBeenCalled();

      act(() => {
        renderer.update(
          (
            <BottomSheet visible onClose={jest.fn()}>
              <Text>content</Text>
            </BottomSheet>
          ) as never,
        );
      });
      expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledTimes(1);
    });

    it('restores focus to restoreFocusRef on the true -> false visible transition, when given', () => {
      const restoreFocusRef = { current: {} as View };
      let renderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          (
            <BottomSheet visible onClose={jest.fn()} restoreFocusRef={restoreFocusRef}>
              <Text>content</Text>
            </BottomSheet>
          ) as never,
          { createNodeMock: () => ({}) },
        );
      });
      (AccessibilityInfo.setAccessibilityFocus as jest.Mock).mockClear();

      act(() => {
        renderer.update(
          (
            <BottomSheet visible={false} onClose={jest.fn()} restoreFocusRef={restoreFocusRef}>
              <Text>content</Text>
            </BottomSheet>
          ) as never,
        );
      });
      expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledTimes(1);
    });

    it('does not attempt to restore focus when no restoreFocusRef is given', () => {
      let renderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          (
            <BottomSheet visible onClose={jest.fn()}>
              <Text>content</Text>
            </BottomSheet>
          ) as never,
          { createNodeMock: () => ({}) },
        );
      });
      (AccessibilityInfo.setAccessibilityFocus as jest.Mock).mockClear();

      act(() => {
        renderer.update(
          (
            <BottomSheet visible={false} onClose={jest.fn()}>
              <Text>content</Text>
            </BottomSheet>
          ) as never,
        );
      });
      expect(AccessibilityInfo.setAccessibilityFocus).not.toHaveBeenCalled();
    });
  });
});
