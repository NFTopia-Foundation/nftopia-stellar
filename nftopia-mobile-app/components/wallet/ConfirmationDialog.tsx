import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import BottomSheet from '@/components/ui/BottomSheet';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  /** Optional element to restore screen-reader focus to after closing. */
  restoreFocusRef?: React.RefObject<any>;
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
  restoreFocusRef,
}: ConfirmationDialogProps) {
  const confirmScale = useRef(new Animated.Value(1)).current;
  const cancelScale = useRef(new Animated.Value(1)).current;
  const cancelRef = useRef<TouchableOpacity>(null);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      title={title}
      snapPoints={['45%']}
      enablePanDownToClose={false}
      closeOnBackdropPress={false}
      initialFocusRef={cancelRef}
      restoreFocusRef={restoreFocusRef}
      testID="confirmation-dialog"
    >
      <Text style={styles.message}>{message}</Text>
      <View style={styles.buttons}>
        <TouchableOpacity
          ref={cancelRef}
          style={styles.cancelButton}
          onPress={handleCancel}
          onPressIn={() => handlePressIn(cancelScale)}
          onPressOut={() => handlePressOut(cancelScale)}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          testID="confirmation-dialog-cancel"
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
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          testID="confirmation-dialog-confirm"
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
