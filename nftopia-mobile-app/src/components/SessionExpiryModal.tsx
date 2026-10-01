import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useBiometric } from '@/src/hooks/useBiometric';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';

interface SessionExpiryModalProps {
  visible: boolean;
  onExtend?: () => void;
  onLogout?: () => void;
}

export function SessionExpiryModal({ visible, onExtend, onLogout }: SessionExpiryModalProps) {
  const { sessionExpiryTime, extendSession, getSessionTimeRemaining } = useAuthStore();
  const { isAvailable, isEnrolled, requireBiometricWithFallback } = useBiometric();
  const [isExtending, setIsExtending] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Update countdown every second
  useEffect(() => {
    if (!visible) return;

    const updateCountdown = () => {
      const remaining = getSessionTimeRemaining() || 0;
      setTimeRemaining(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [visible, getSessionTimeRemaining]);

  // Announce warning for screen readers
  useEffect(() => {
    if (visible) {
      const message = `Your session will expire in ${Math.ceil(timeRemaining / 60)} minutes. Please extend your session to continue.`;
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [visible, timeRemaining]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExtend = async () => {
    try {
      setIsExtending(true);

      const doExtend = async () => {
        const extended = await extendSession();
        if (extended) {
          if (onExtend) onExtend();
        } else {
          // Refresh token is no longer valid — extending isn't possible,
          // so fall back to login rather than silently dismissing the
          // warning as if it had succeeded.
          if (onLogout) onLogout();
        }
      };

      // If biometrics are available, require authentication
      if (isAvailable && isEnrolled) {
        await requireBiometricWithFallback('EXTEND_SESSION', doExtend, () => {
          setIsExtending(false);
        });
      } else {
        // No biometrics, extend directly
        await doExtend();
      }
    } catch (error) {
      console.error('Failed to extend session:', error);
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
  };

  const isUrgent = timeRemaining < 60; // Less than 1 minute

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}} // Prevent closing by back button
    >
      <View style={styles.overlay}>
        <View
          style={[styles.dialog, isUrgent && styles.urgentDialog]}
          accessible={true}
          accessibilityLiveRegion="assertive"
          accessibilityLabel="Session expiry warning"
          accessibilityHint={`Your session will expire in ${formatTime(timeRemaining)}. You can extend it or log out.`}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>⏰</Text>
          </View>

          <Text style={styles.title}>Session Expiring Soon</Text>

          <View style={styles.countdownContainer}>
            <Text style={[styles.countdown, isUrgent && styles.urgentCountdown]}>
              {formatTime(timeRemaining)}
            </Text>
            <Text style={styles.countdownLabel}>remaining</Text>
          </View>

          <Text style={styles.message}>
            Your session will expire soon. Extend it to continue without losing your work, or log out
            securely.
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              disabled={isExtending}
            >
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.extendButton, isUrgent && styles.urgentExtendButton]}
              onPress={handleExtend}
              disabled={isExtending}
            >
              {isExtending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.extendText}>Extend Session</Text>
              )}
            </TouchableOpacity>
          </View>

          {isAvailable && isEnrolled && (
            <Text style={styles.footerText}>
              Biometric authentication required to extend session
            </Text>
          )}
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
    maxWidth: 360,
    ...shadows.md,
  },
  urgentDialog: {
    borderWidth: 2,
    borderColor: colors.error,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  countdown: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  urgentCountdown: {
    color: colors.error,
  },
  countdownLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logoutButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  extendButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  urgentExtendButton: {
    backgroundColor: colors.error,
  },
  extendText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footerText: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
