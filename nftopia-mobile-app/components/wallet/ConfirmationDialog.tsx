import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';
import BottomSheet from '@/components/ui/BottomSheet';
import { haptics } from '@/lib/haptics';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * May return a Promise (#467) — if it does, and it rejects, an error
   * haptic fires. Callers that already handle their own errors (e.g.
   * SendScreen, which shows its own "Send failed" alert) can keep
   * catching internally; this is purely a fallback for callers that don't.
   */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  destructive?: boolean;
  /**
   * Extra content rendered between the message and the buttons (#471) —
   * e.g. TransactionFeeSummary for a transaction-signing confirmation.
   * Optional and unused by this dialog's other callers (wallet removal,
   * etc.), so it doesn't affect them.
   */
  children?: React.ReactNode;
  /**
   * Disables and dims the confirm button without hiding it — used to
   * block submission (e.g. a minimum-reserve breach) while still letting
   * the user see *why* via `children`, rather than silently removing
   * their only way to act on the dialog.
   */
  confirmDisabled?: boolean;
}

/**
 * Migrated to the shared BottomSheet primitive (#469) — was its own
 * centered Modal before. The props API and button behavior are unchanged
 * for every existing caller (WalletList's remove-wallet confirmation,
 * SendScreen's payment confirmation from #471); only the presentation
 * changed, from a centered fade-in card to a sheet sliding up from the
 * bottom with swipe-to-dismiss and backdrop-tap-to-close — both of which
 * invoke onCancel exactly like the Cancel button does.
 */
export default function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
  children,
  confirmDisabled = false,
}: ConfirmationDialogProps) {
  const confirmScale = useRef(new Animated.Value(1)).current;
  const cancelScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 5,
    }).start();
  };

  const handlePressOut = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 5,
    }).start();
  };

  const handleConfirm = () => {
    if (confirmDisabled) return;
    haptics.tapStrong();
    Promise.resolve(onConfirm()).catch(() => {
      haptics.error();
    });
  };

  const handleCancel = () => {
    haptics.tap();
    onCancel();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      snapPoints={['half']}
      accessibilityLabel={title}
      testID="confirmation-dialog"
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {children}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          onPressIn={() => handlePressIn(cancelScale)}
          onPressOut={() => handlePressOut(cancelScale)}
          activeOpacity={1}
        >
          <Animated.View style={{ transform: [{ scale: cancelScale }] }}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            destructive && styles.confirmDestructive,
            confirmDisabled && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          onPressIn={() => handlePressIn(confirmScale)}
          onPressOut={() => handlePressOut(confirmScale)}
          activeOpacity={1}
          disabled={confirmDisabled}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          accessibilityState={{ disabled: confirmDisabled }}
        >
          <Animated.View style={{ transform: [{ scale: confirmScale }] }}>
            <Text style={[styles.confirmText, destructive && styles.confirmTextDestructive]}>
              {confirmLabel}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmDestructive: {
    backgroundColor: colors.error,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.7,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textInverse,
  },
  confirmTextDestructive: {
    color: colors.textInverse,
  },
});
