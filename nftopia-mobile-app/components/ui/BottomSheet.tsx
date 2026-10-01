import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  InteractionManager,
  StyleSheet,
  View,
} from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';

/**
 * Shared bottom sheet primitive (#469), wrapping @gorhom/bottom-sheet with
 * app-consistent styling and a declarative visible/onClose API matching
 * ConfirmationDialog's — see docs/bottom-sheet.md for usage and the
 * migration/design notes.
 */

export type BottomSheetSnapPreset = 'peek' | 'half' | 'full';
export type BottomSheetSnapPoint = BottomSheetSnapPreset | string | number;

/** peek: just enough to show a title/a couple of actions. half: the common case. full: near-fullscreen, leaving a gap so it still reads as a sheet, not a new screen. */
const SNAP_PRESET_PERCENTAGES: Record<BottomSheetSnapPreset, string> = {
  peek: '25%',
  half: '50%',
  full: '90%',
};

function resolveSnapPoint(point: BottomSheetSnapPoint): string | number {
  if (typeof point === 'string' && point in SNAP_PRESET_PERCENTAGES) {
    return SNAP_PRESET_PERCENTAGES[point as BottomSheetSnapPreset];
  }
  return point;
}

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Ordered from smallest to largest. Defaults to ['half']. */
  snapPoints?: BottomSheetSnapPoint[];
  /** Index into `snapPoints` to open to. Defaults to the last (largest) one. */
  initialSnapIndex?: number;
  /** Swipe-down-to-dismiss. Default true. */
  enablePanDownToClose?: boolean;
  /** Tap-outside-to-dismiss. Default true. */
  enableBackdropDismiss?: boolean;
  /**
   * Set true for a sheet containing a text input (render it with
   * BottomSheetTextInput, not the plain RN one, so the sheet's own
   * gesture handling doesn't fight the input for touches) so the sheet
   * resizes above the keyboard instead of the keyboard covering it.
   */
  keyboardAware?: boolean;
  /** Announced to screen readers as the sheet's label; also where focus moves to on open. */
  accessibilityLabel?: string;
  /** Ref to the element that triggered the sheet (e.g. the button that opened it) — screen-reader focus restores to it on close, if given. */
  restoreFocusRef?: React.RefObject<View | null>;
  testID?: string;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  snapPoints = ['half'],
  initialSnapIndex,
  enablePanDownToClose = true,
  enableBackdropDismiss = true,
  keyboardAware = false,
  accessibilityLabel,
  restoreFocusRef,
  testID,
}: BottomSheetProps) {
  const contentRef = useRef<View>(null);
  const wasVisible = useRef(false);

  const resolvedSnapPoints = useMemo(() => snapPoints.map(resolveSnapPoint), [snapPoints]);
  const openIndex = initialSnapIndex ?? resolvedSnapPoints.length - 1;

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) =>
      enableBackdropDismiss ? (
        <BottomSheetBackdrop
          {...backdropProps}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ) : null,
    [enableBackdropDismiss],
  );

  // Screen-reader focus (#469): moves into the sheet on open, restores to
  // the trigger element (if given) on close. Best-effort/defensive — a
  // focus-management hiccup must never be able to block the sheet itself
  // from actually opening or closing.
  useEffect(() => {
    if (visible && !wasVisible.current) {
      wasVisible.current = true;
      InteractionManager.runAfterInteractions(() => {
        try {
          const node = findNodeHandle(contentRef.current);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        } catch {
          // Best-effort.
        }
      });
    } else if (!visible && wasVisible.current) {
      wasVisible.current = false;
      if (restoreFocusRef?.current) {
        InteractionManager.runAfterInteractions(() => {
          try {
            const node = findNodeHandle(restoreFocusRef.current);
            if (node) AccessibilityInfo.setAccessibilityFocus(node);
          } catch {
            // Best-effort.
          }
        });
      }
    }
  }, [visible, restoreFocusRef]);

  return (
    <GorhomBottomSheet
      index={visible ? openIndex : -1}
      snapPoints={resolvedSnapPoints}
      enablePanDownToClose={enablePanDownToClose}
      // Fires on every close, regardless of cause (pan-down, backdrop tap,
      // or the `index` prop above going to -1) — the single source of
      // truth for "tell the parent we're closed", so it never double-fires
      // alongside a separate onChange-based check.
      onClose={onClose}
      backdropComponent={renderBackdrop}
      keyboardBehavior={keyboardAware ? 'interactive' : 'fillParent'}
      keyboardBlurBehavior={keyboardAware ? 'restore' : 'none'}
      android_keyboardInputMode={keyboardAware ? 'adjustResize' : 'adjustPan'}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.content}>
        <View
          ref={contentRef}
          accessible
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={styles.contentInner}
          testID={testID}
        >
          {children}
        </View>
      </BottomSheetView>
    </GorhomBottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    ...shadows.md,
  },
  handleIndicator: {
    backgroundColor: colors.border,
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    flex: 1,
    padding: spacing.lg,
  },
});
