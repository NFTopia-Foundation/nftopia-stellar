import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';

export { BottomSheetModalProvider, BottomSheetTextInput };
export { BottomSheetScrollView };

/**
 * Named snap-point presets so features don't have to remember raw percentages.
 *  - `peek`: compact action sheet (share, quick actions).
 *  - `half`: default for filters / confirmations.
 *  - `full`: tall sheets with a lot of content.
 */
export const SNAP_POINT_PRESETS = {
  peek: '35%',
  half: '55%',
  full: '90%',
} as const;

export type SnapPointPreset = keyof typeof SNAP_POINT_PRESETS;
export type SnapPoint = SnapPointPreset | string | number;

export interface BottomSheetRef {
  /** Mount and present the sheet at its initial snap point. */
  present: () => void;
  /** Close and unmount the sheet. */
  dismiss: () => void;
  /** Close the sheet without unmounting (keeps it ready to re-present). */
  close: () => void;
  /** Snap to one of the configured snap points by index. */
  snapToIndex: (index: number) => void;
  /** Snap to the largest snap point. */
  expand: () => void;
  /** Snap to the smallest snap point. */
  collapse: () => void;
}

export interface BottomSheetProps {
  /**
   * Controlled visibility. When provided, the sheet presents/dismisses as the
   * value changes. Omit it to drive the sheet imperatively through the ref
   * (`ref.current.present()`), which avoids threading state through features.
   */
  visible?: boolean;
  /** Called whenever the sheet is dismissed (backdrop, swipe, back button, ref). */
  onClose: () => void;
  /** Called after the sheet has been presented. */
  onOpen?: () => void;
  /** Sheet body. */
  children?: React.ReactNode;
  /**
   * Snap points to expose. Accepts the `peek`/`half`/`full` presets, custom
   * percentages (`'70%'`) or absolute pixel values. Defaults to `['half']`.
   */
  snapPoints?: SnapPoint[];
  /** Index into `snapPoints` the sheet opens at. Defaults to `0`. */
  initialSnapIndex?: number;
  /** Optional header title; also used as the screen-reader entry point. */
  title?: string;
  /** Pinned below the scrollable body (e.g. Apply / Clear actions). */
  footer?: React.ReactNode;
  /** Wrap the body in a `BottomSheetScrollView` for long/scrollable content. */
  scrollable?: boolean;
  /** Allow swipe-down-to-dismiss. Defaults to `true`. */
  enablePanDownToClose?: boolean;
  /** Dismiss when the backdrop is pressed. Defaults to `true`. */
  closeOnBackdropPress?: boolean;
  /** How the sheet reacts to the keyboard. Defaults to `'interactive'`. */
  keyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
  /** Android soft-input mode; `adjustResize` keeps inputs visible. */
  androidKeyboardInputMode?: 'adjustPan' | 'adjustResize';
  /**
   * Element to move screen-reader focus to when the sheet opens. Falls back to
   * the title, then the sheet container.
   */
  initialFocusRef?: React.RefObject<any>;
  /** Element to restore screen-reader focus to when the sheet closes. */
  restoreFocusRef?: React.RefObject<any>;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Notified when the active snap index changes. */
  onSnapIndexChange?: (index: number) => void;
}

interface BottomSheetAccessibilityContextValue {
  isAnySheetOpen: boolean;
  registerSheet: (id: symbol) => void;
  unregisterSheet: (id: symbol) => void;
}

const noop = () => {};

const BottomSheetAccessibilityContext =
  createContext<BottomSheetAccessibilityContextValue>({
    isAnySheetOpen: false,
    registerSheet: noop,
    unregisterSheet: noop,
  });

/**
 * Read whether any bottom sheet is currently open. Consumers (usually the app
 * root) can use this to hide the rest of the tree from screen readers while a
 * sheet is up, which traps focus inside the sheet.
 */
export function useBottomSheetAccessibility(): BottomSheetAccessibilityContextValue {
  return useContext(BottomSheetAccessibilityContext);
}

export interface BottomSheetProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app once to install the gesture handler / modal portal host and to
 * track open sheets for accessibility focus trapping. Mount it as high as
 * possible (e.g. around the navigation tree).
 */
export function BottomSheetProvider({ children }: BottomSheetProviderProps) {
  const [openSheets, setOpenSheets] = useState<Set<symbol>>(() => new Set());

  const registerSheet = useCallback((id: symbol) => {
    setOpenSheets((previous) => {
      if (previous.has(id)) return previous;
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }, []);

  const unregisterSheet = useCallback((id: symbol) => {
    setOpenSheets((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<BottomSheetAccessibilityContextValue>(
    () => ({
      isAnySheetOpen: openSheets.size > 0,
      registerSheet,
      unregisterSheet,
    }),
    [openSheets, registerSheet, unregisterSheet]
  );

  return (
    <BottomSheetAccessibilityContext.Provider value={value}>
      <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
    </BottomSheetAccessibilityContext.Provider>
  );
}

type BottomSheetModalHandle = {
  present: (data?: unknown) => void;
  dismiss: (configs?: unknown) => void;
  close: (configs?: unknown) => void;
  forceClose: (configs?: unknown) => void;
  snapToIndex: (index: number, configs?: unknown) => void;
  snapToPosition: (position: number | string, configs?: unknown) => void;
  expand: (configs?: unknown) => void;
  collapse: (configs?: unknown) => void;
};

function resolveSnapPoints(snapPoints?: SnapPoint[]): (string | number)[] {
  if (!snapPoints || snapPoints.length === 0) {
    return [SNAP_POINT_PRESETS.half];
  }
  return snapPoints.map((point) =>
    typeof point === 'string' && point in SNAP_POINT_PRESETS
      ? SNAP_POINT_PRESETS[point as SnapPointPreset]
      : point
  );
}

/**
 * Shared bottom sheet for actions and filters.
 *
 * Wraps `@gorhom/bottom-sheet` with the app's styling and adds:
 *  - configurable snap points (peek / half / full),
 *  - swipe-down and backdrop-tap dismissal,
 *  - keyboard-aware resizing for sheets with inputs,
 *  - screen-reader focus management (move in on open, restore on close),
 *  - a stable, reusable API for filters, wallet actions and share sheets.
 */
const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  function BottomSheet(
    {
      visible,
      onClose,
      onOpen,
      children,
      snapPoints,
      initialSnapIndex = 0,
      title,
      footer,
      scrollable = false,
      enablePanDownToClose = true,
      closeOnBackdropPress = true,
      keyboardBehavior = 'interactive',
      androidKeyboardInputMode = 'adjustResize',
      initialFocusRef,
      restoreFocusRef,
      testID,
      style,
      contentContainerStyle,
      onSnapIndexChange,
    },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const modalRef = useRef<BottomSheetModalHandle | null>(null);
    const titleRef = useRef<View>(null);
    const containerRef = useRef<View>(null);
    const isPresentedRef = useRef(false);
    const hasFocusedRef = useRef(false);
    const sheetIdRef = useRef(Symbol('bottom-sheet'));

    const { registerSheet, unregisterSheet } = useBottomSheetAccessibility();

    const resolvedSnapPoints = useMemo(
      () => resolveSnapPoints(snapPoints),
      [snapPoints]
    );

    const focusIntoSheet = useCallback(() => {
      const target =
        initialFocusRef?.current ?? titleRef.current ?? containerRef.current;
      if (!target) return;
      const node = findNodeHandle(target);
      if (node != null) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, [initialFocusRef]);

    const restoreFocus = useCallback(() => {
      const target = restoreFocusRef?.current;
      if (!target) return;
      const node = findNodeHandle(target);
      if (node != null) {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, [restoreFocusRef]);

    const present = useCallback(() => {
      if (isPresentedRef.current) return;
      isPresentedRef.current = true;
      hasFocusedRef.current = false;
      registerSheet(sheetIdRef.current);
      modalRef.current?.present();
      onOpen?.();
    }, [onOpen, registerSheet]);

    const dismiss = useCallback(() => {
      modalRef.current?.dismiss();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        present,
        dismiss,
        close: () => modalRef.current?.close(),
        snapToIndex: (index: number) => modalRef.current?.snapToIndex(index),
        expand: () => modalRef.current?.expand(),
        collapse: () => modalRef.current?.collapse(),
      }),
      [present, dismiss]
    );

    useEffect(() => {
      if (visible === undefined) return;
      if (visible) {
        present();
      } else if (isPresentedRef.current) {
        modalRef.current?.dismiss();
      }
    }, [visible, present]);

    const handleDismiss = useCallback(() => {
      if (!isPresentedRef.current) return;
      isPresentedRef.current = false;
      hasFocusedRef.current = false;
      unregisterSheet(sheetIdRef.current);
      restoreFocus();
      onClose();
    }, [onClose, restoreFocus, unregisterSheet]);

    const handleChange = useCallback(
      (index: number) => {
        if (index < 0) return;
        if (!hasFocusedRef.current) {
          hasFocusedRef.current = true;
          focusIntoSheet();
        }
        onSnapIndexChange?.(index);
      },
      [focusIntoSheet, onSnapIndexChange]
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior={closeOnBackdropPress ? 'close' : 'none'}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ),
      [closeOnBackdropPress]
    );

    const renderHandle = useCallback(
      () => (
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={modalRef}
        index={initialSnapIndex}
        snapPoints={resolvedSnapPoints}
        enablePanDownToClose={enablePanDownToClose}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode={androidKeyboardInputMode}
        backdropComponent={renderBackdrop}
        handleComponent={renderHandle}
        onDismiss={handleDismiss}
        onChange={handleChange}
        backgroundStyle={styles.background}
        style={style}
        enableDismissOnClose
      >
        <BottomSheetView
          style={styles.container}
          testID={testID}
          accessibilityViewIsModal
          importantForAccessibility="yes"
        >
          <View ref={containerRef} style={styles.inner}>
            {title ? (
              <View style={styles.header}>
                <Text
                  ref={titleRef}
                  style={styles.title}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={dismiss}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  testID={testID ? `${testID}-close` : undefined}
                >
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {scrollable ? (
              <BottomSheetScrollView
                contentContainerStyle={[styles.content, contentContainerStyle]}
                keyboardShouldPersistTaps="handled"
                testID={testID ? `${testID}-scroll` : undefined}
              >
                {children}
              </BottomSheetScrollView>
            ) : (
              <View style={[styles.content, contentContainerStyle]}>
                {children}
              </View>
            )}

            {footer ? (
              <View
                style={[
                  styles.footer,
                  { paddingBottom: Math.max(insets.bottom, spacing.md) },
                ]}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

export default BottomSheet;

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.md,
  },
  container: {
    paddingBottom: spacing.sm,
  },
  inner: {
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  closeText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
