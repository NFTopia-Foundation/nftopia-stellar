import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useBiometric } from '@/src/hooks/useBiometric';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useToastStore } from '@/stores/toastStore';

interface AppLockScreenProps {
  onUnlockSuccess: () => void;
}

export function AppLockScreen({ onUnlockSuccess }: AppLockScreenProps) {
  const {
    isLocked,
    unlockApp,
    resetFailedAttempts,
    isInLockout,
    getLockoutRemaining,
    failedUnlockAttempts,
    appLockEnabled,
  } = useAuthStore();

  const { isAvailable, isEnrolled, requireBiometricWithFallback, cooldownRemaining } = useBiometric();
  const { showToast } = useToastStore();

  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [shakeAnim] = useState(new Animated.Value(0));
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  // Update lockout countdown
  useEffect(() => {
    if (isInLockout()) {
      setLockoutCountdown(getLockoutRemaining());
      const interval = setInterval(() => {
        const remaining = getLockoutRemaining();
        setLockoutCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          resetFailedAttempts();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isInLockout, getLockoutRemaining, resetFailedAttempts]);

  // Attempt biometric unlock on mount if available
  useEffect(() => {
    if (isLocked && appLockEnabled && isAvailable && isEnrolled && !isInLockout()) {
      attemptBiometricUnlock();
    }
  }, [isLocked, appLockEnabled, isAvailable, isEnrolled, isInLockout]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const attemptBiometricUnlock = async () => {
    try {
      setIsAuthenticating(true);

      await requireBiometricWithFallback(
        'UNLOCK_APP',
        async () => {
          const unlocked = await unlockApp();
          if (unlocked) {
            resetFailedAttempts();
            onUnlockSuccess();
            AccessibilityInfo.announceForAccessibility('App unlocked successfully');
          } else {
            shake();
            AccessibilityInfo.announceForAccessibility('Authentication failed');
          }
        },
        () => {
          shake();
          setIsAuthenticating(false);
          AccessibilityInfo.announceForAccessibility('Authentication failed');
        }
      );
    } catch (error) {
      console.error('Biometric unlock error:', error);
      shake();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length === 0) return;

    try {
      setIsAuthenticating(true);
      const unlocked = await unlockApp(pin);

      if (unlocked) {
        resetFailedAttempts();
        setPin('');
        onUnlockSuccess();
        AccessibilityInfo.announceForAccessibility('App unlocked successfully');
      } else {
        shake();
        setPin('');
        showToast(`Incorrect PIN. Failed attempts: ${failedUnlockAttempts + 1}/5`, 'error', 2000);
        AccessibilityInfo.announceForAccessibility('Incorrect PIN');
      }
    } catch (error) {
      shake();
      setPin('');
      showToast('Failed to unlock app', 'error', 2000);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleBiometricPress = () => {
    if (!isAvailable || !isEnrolled) {
      showToast('Biometrics not available. Please use your PIN to unlock', 'info', 3000);
      return;
    }

    if (isInLockout()) {
      showToast(
        `Too many attempts. Please wait ${lockoutCountdown} seconds before trying again`,
        'warning',
        3000
      );
      return;
    }

    attemptBiometricUnlock();
  };

  if (!isLocked) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔐</Text>
        </View>

        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.message}>
          {isAvailable && isEnrolled
            ? 'Use biometrics or enter your PIN to unlock'
            : 'Enter your PIN to unlock'}
        </Text>

        {isInLockout() && (
          <View style={styles.lockoutContainer}>
            <Text style={styles.lockoutText}>
              ⏰ Too many failed attempts. Wait {lockoutCountdown}s
            </Text>
          </View>
        )}

        <Animated.View
          style={[
            styles.pinContainer,
            {
              transform: [{ translateX: shakeAnim }],
            },
          ]}
        >
          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={setPin}
            placeholder="Enter PIN"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            editable={!isAuthenticating && !isInLockout()}
            onSubmitEditing={handlePinSubmit}
            autoFocus
            accessible={true}
            accessibilityLabel="PIN input"
            accessibilityHint="Enter your 6-digit PIN to unlock the app"
          />
        </Animated.View>

        <TouchableOpacity
          style={[
            styles.unlockButton,
            (isAuthenticating || isInLockout() || pin.length === 0) && styles.buttonDisabled,
          ]}
          onPress={handlePinSubmit}
          disabled={isAuthenticating || isInLockout() || pin.length === 0}
          accessible={true}
          accessibilityLabel="Unlock with PIN"
          accessibilityRole="button"
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.unlockButtonText}>Unlock</Text>
          )}
        </TouchableOpacity>

        {isAvailable && isEnrolled && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricPress}
            disabled={isAuthenticating || isInLockout()}
            accessible={true}
            accessibilityLabel="Unlock with biometrics"
            accessibilityRole="button"
          >
            <Text style={styles.biometricButtonText}>👆 Use Biometrics</Text>
          </TouchableOpacity>
        )}

        {failedUnlockAttempts > 0 && !isInLockout() && (
          <Text style={styles.attemptsText}>
            Failed attempts: {failedUnlockAttempts}/5
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 340,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  lockoutContainer: {
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  lockoutText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    fontWeight: '600',
  },
  pinContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  pinInput: {
    height: 50,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    letterSpacing: 8,
  },
  unlockButton: {
    width: '100%',
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  biometricButton: {
    width: '100%',
    height: 50,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  biometricButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  attemptsText: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
