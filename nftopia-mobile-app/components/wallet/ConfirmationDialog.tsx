import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { haptics } from '@/lib/haptics';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Called when the user confirms. If it returns a promise, the dialog fires
   * success/error haptics when it settles.
   */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  destructive?: boolean;
}

export default function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
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
    // Destructive actions get a warning buzz, regular confirms a firm tap.
    haptics.trigger(destructive ? 'warning' : 'confirm');

    const result = onConfirm();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>)
        .then(() => haptics.success())
        .catch(() => haptics.error());
    }
  };

  const handleCancel = () => {
    haptics.cancel();
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
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
              style={[styles.confirmButton, destructive && styles.confirmDestructive]}
              onPress={handleConfirm}
              onPressIn={() => handlePressIn(confirmScale)}
              onPressOut={() => handlePressOut(confirmScale)}
              activeOpacity={1}
            >
              <Animated.View style={{ transform: [{ scale: confirmScale }] }}>
                <Text
                  style={[styles.confirmText, destructive && styles.confirmTextDestructive]}
                >
                  {confirmLabel}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    ...shadows.md,
  },
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
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textInverse,
  },
  confirmTextDestructive: {
    color: colors.textInverse,
  },
});