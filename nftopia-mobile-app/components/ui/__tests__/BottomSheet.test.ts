// Written without JSX so it matches the project's jest testMatch (*.test.ts).
// ── Mocks (hoisted) ──────────────────────────────────────────────────────────
const mockModalInstances: Array<{ instance: any; props: any }> = [];

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const makeComponent = (name: string) =>
    React.forwardRef((props: Record<string, any>, ref: unknown) => {
      const instance = {
        present: jest.fn(),
        dismiss: jest.fn(),
        close: jest.fn(),
        forceClose: jest.fn(),
        snapToIndex: jest.fn(),
        snapToPosition: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
      };
      React.useImperativeHandle(ref, () => instance);
      if (name === 'BottomSheetModal') {
        mockModalInstances.push({ instance, props });
      }
      return React.createElement(
        'RCTMocked',
        { ...props, __component: name, __instance: instance },
        props.children
      );
    });

  return {
    __esModule: true,
    default: makeComponent('BottomSheet'),
    BottomSheetModal: makeComponent('BottomSheetModal'),
    BottomSheetModalProvider: ({ children }: Record<string, any>) =>
      React.createElement(
        'RCTMocked',
        { __component: 'BottomSheetModalProvider' },
        children
      ),
    BottomSheetBackdrop: makeComponent('BottomSheetBackdrop'),
    BottomSheetView: makeComponent('BottomSheetView'),
    BottomSheetScrollView: makeComponent('BottomSheetScrollView'),
    BottomSheetTextInput: makeComponent('BottomSheetTextInput'),
    useBottomSheetSpringConfigs: (config: unknown) => config,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const mock = (name: string) =>
    React.forwardRef((props: Record<string, unknown>, _ref: unknown) =>
      React.createElement(
        'RCTMocked',
        { ...props, __component: name },
        (props as { children?: unknown }).children
      )
    );
  return {
    Platform: { OS: 'ios', select: (options: any) => options.ios },
    StyleSheet: {
      create: (obj: Record<string, unknown>) => obj,
      flatten: (value: unknown) => value,
      absoluteFill: {},
    },
    View: mock('View'),
    Text: mock('Text'),
    TouchableOpacity: mock('TouchableOpacity'),
    Animated: {
      Value: class AnimatedValue {
        constructor(public initial: number) {}
      },
      spring: jest.fn(() => ({ start: jest.fn() })),
      View: mock('Animated.View'),
    },
    AccessibilityInfo: {
      setAccessibilityFocus: jest.fn(),
      announceForAccessibility: jest.fn(),
    },
    findNodeHandle: jest.fn(() => 1),
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    UIManager: {},
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import React from 'react';
import * as TestRenderer from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import BottomSheet, {
  BottomSheetProvider,
  SNAP_POINT_PRESETS,
  useBottomSheetAccessibility,
  type BottomSheetRef,
} from '@/components/ui/BottomSheet';
import ConfirmationDialog from '@/components/wallet/ConfirmationDialog';

function render(element: React.ReactElement<any>) {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element as any);
  });
  return renderer;
}

function latestModal() {
  return mockModalInstances[mockModalInstances.length - 1];
}

describe('BottomSheet snap points', () => {
  beforeEach(() => {
    mockModalInstances.length = 0;
    jest.clearAllMocks();
  });

  it('resolves named presets and passes custom points through', () => {
    render(
      React.createElement(
        BottomSheet,
        { visible: true, onClose: jest.fn(), snapPoints: ['peek', 'full', 300, '70%'] },
        React.createElement(React.Fragment)
      )
    );
    expect(latestModal().props.snapPoints).toEqual([
      SNAP_POINT_PRESETS.peek,
      SNAP_POINT_PRESETS.full,
      300,
      '70%',
    ]);
  });

  it('defaults to the half snap point', () => {
    render(
      React.createElement(
        BottomSheet,
        { visible: true, onClose: jest.fn() },
        React.createElement(React.Fragment)
      )
    );
    expect(latestModal().props.snapPoints).toEqual([SNAP_POINT_PRESETS.half]);
  });
});

describe('BottomSheet dismissal', () => {
  beforeEach(() => {
    mockModalInstances.length = 0;
    jest.clearAllMocks();
  });

  it('enables swipe-down by default', () => {
    render(
      React.createElement(
        BottomSheet,
        { visible: true, onClose: jest.fn() },
        React.createElement(React.Fragment)
      )
    );
    expect(latestModal().props.enablePanDownToClose).toBe(true);
  });

  it('configures the backdrop to close on press by default', () => {
    render(
      React.createElement(
        BottomSheet,
        { visible: true, onClose: jest.fn() },
        React.createElement(React.Fragment)
      )
    );
    const backdrop = latestModal().props.backdropComponent({
      animatedIndex: { value: 0 },
      animatedPosition: { value: 0 },
    });
    expect(backdrop.props.pressBehavior).toBe('close');
  });

  it('disables backdrop dismissal when requested', () => {
    render(
      React.createElement(
        BottomSheet,
        { visible: true, onClose: jest.fn(), closeOnBackdropPress: false },
        React.createElement(React.Fragment)
      )
    );
    const backdrop = latestModal().props.backdropComponent({
      animatedIndex: { value: 0 },
      animatedPosition: { value: 0 },
    });
    expect(backdrop.props.pressBehavior).toBe('none');
  });

  it('calls onClose and restores focus when dismissed', () => {
    const onClose = jest.fn();
    const restoreFocusRef = { current: {} as any };
    render(
      React.createElement(
        BottomSheet,
        { visible: true, onClose, restoreFocusRef },
        React.createElement(React.Fragment)
      )
    );

    TestRenderer.act(() => {
      latestModal().props.onDismiss();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(1);
  });
});

describe('BottomSheet focus management', () => {
  beforeEach(() => {
    mockModalInstances.length = 0;
    jest.clearAllMocks();
  });

  it('moves screen-reader focus into the sheet once it opens', () => {
    const initialFocusRef = { current: {} as any };
    render(
      React.createElement(
        BottomSheet,
        { visible: true, onClose: jest.fn(), initialFocusRef },
        React.createElement(React.Fragment)
      )
    );

    TestRenderer.act(() => {
      latestModal().props.onChange(0);
    });

    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(1);
  });
});

describe('BottomSheet imperative API', () => {
  beforeEach(() => {
    mockModalInstances.length = 0;
    jest.clearAllMocks();
  });

  it('presents and dismisses through the ref without a visible prop', () => {
    const ref = React.createRef<BottomSheetRef>();
    render(
      React.createElement(
        BottomSheet,
        { ref, onClose: jest.fn() },
        React.createElement(React.Fragment)
      )
    );

    expect(latestModal().instance.present).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      ref.current?.present();
    });
    expect(latestModal().instance.present).toHaveBeenCalledTimes(1);

    TestRenderer.act(() => {
      ref.current?.dismiss();
    });
    expect(latestModal().instance.dismiss).toHaveBeenCalledTimes(1);
  });
});

describe('BottomSheetProvider accessibility state', () => {
  beforeEach(() => {
    mockModalInstances.length = 0;
    jest.clearAllMocks();
  });

  it('reports when a sheet is open so the background can be hidden', () => {
    const Probe = () => {
      const { isAnySheetOpen } = useBottomSheetAccessibility();
      return React.createElement('RCTMocked', {
        __component: 'Probe',
        open: isAnySheetOpen,
      });
    };

    const renderer = render(
      React.createElement(
        BottomSheetProvider,
        null,
        React.createElement(Probe),
        React.createElement(
          BottomSheet,
          { visible: true, onClose: jest.fn() },
          React.createElement(React.Fragment)
        )
      )
    );

    const probe = renderer.root.findByProps({ __component: 'Probe' });
    expect(probe.props.open).toBe(true);
  });
});

describe('ConfirmationDialog on the shared bottom sheet', () => {
  beforeEach(() => {
    mockModalInstances.length = 0;
    jest.clearAllMocks();
  });

  it('keeps its public contract: confirm and cancel callbacks fire', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const renderer = render(
      React.createElement(ConfirmationDialog, {
        visible: true,
        title: 'Remove Wallet',
        message: 'Are you sure?',
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
        destructive: true,
        onConfirm,
        onCancel,
      })
    );

    TestRenderer.act(() => {
      renderer.root
        .findByProps({ testID: 'confirmation-dialog-confirm' })
        .props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    TestRenderer.act(() => {
      renderer.root
        .findByProps({ testID: 'confirmation-dialog-cancel' })
        .props.onPress();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss on swipe or backdrop press, matching the old modal', () => {
    render(
      React.createElement(ConfirmationDialog, {
        visible: true,
        title: 'Remove Wallet',
        message: 'Are you sure?',
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
      })
    );

    expect(latestModal().props.enablePanDownToClose).toBe(false);
    const backdrop = latestModal().props.backdropComponent({
      animatedIndex: { value: 0 },
      animatedPosition: { value: 0 },
    });
    expect(backdrop.props.pressBehavior).toBe('none');
  });
});
