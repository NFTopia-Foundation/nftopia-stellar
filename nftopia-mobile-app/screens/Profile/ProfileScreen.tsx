import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/MainNavigator';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { useAuthStore } from '@/stores/authStore';
import { useLanguageStore } from '@/src/stores/languageStore';
import NetworkSwitcher from '@/components/wallet/NetworkSwitcher';
import { LanguageSwitcher } from '@/src/components/LanguageSwitcher';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { BiometricSettings } from '@/src/components/BiometricSettings';
import { useBiometric } from '@/src/hooks/useBiometric';
import { withErrorBoundary } from '@/src/hoc/withErrorBoundary';
import { errorLogger } from '@/src/errors/logger';
import { useTheme } from '@/src/theme/ThemeContext';
import { requestRatingPrompt } from '@/src/services/ratingPrompt';
import { useToast } from '@/src/hooks/useToast';
import { useFavoritesStore } from '@/stores/favoritesStore';

type Props = NativeStackScreenProps<MainStackParamList, 'Profile'>;

function ProfileContent({ navigation }: Props) {
  const { t } = useTranslation();
  const { activeWallet, network, switchNetwork, wallets } = useWalletConnect();
  const { user, logout, appLockEnabled, setAppLockEnabled, lockTimeout, setLockTimeout } = useAuthStore();
  const { language } = useLanguageStore();
  const { colors, isDark } = useTheme();
  const { showInfo, showError } = useToast();
  const { isAvailable: biometricsAvailable, isEnrolled: biometricsEnrolled } = useBiometric();
  const [showLockTimeoutPicker, setShowLockTimeoutPicker] = useState(false);
  const favoriteCount = useFavoritesStore(
    (s) => s.favorites.length + s.favoriteCollections.length
  );

  const handleRateApp = async () => {
    try {
      const result = await requestRatingPrompt();
      if (result === 'unavailable') {
        showInfo('Store reviews are not available on this device yet.');
      }
    } catch {
      showError('Unable to open the store review prompt.');
    }
  };

  const handleToggleAppLock = () => {
    // Unlocking currently only has a working path through biometrics (PIN
    // verification isn't implemented) — enabling it without biometrics set
    // up would lock the user out of the app with no way back in.
    if (!appLockEnabled && (!biometricsAvailable || !biometricsEnrolled)) {
      Alert.alert(
        'Biometric authentication required',
        'App Lock currently unlocks with biometrics only. Set up fingerprint or face recognition on this device before enabling it.',
      );
      return;
    }
    setAppLockEnabled(!appLockEnabled);
  };

  const handleSignOut = () => {
    Alert.alert(
      t('profile.signOut'),
      t('profile.signOutConfirm'),
      [
        { text: t('profile.signOutCancel'), style: 'cancel' },
        { 
          text: t('profile.signOutConfirmButton'), 
          style: 'destructive',
          onPress: () => {
            logout();
            errorLogger.log(
              new Error('User signed out'),
              'ProfileScreen',
              user?.id,
              { action: 'sign_out' }
            );
          }
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      paddingTop: 60,
      gap: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 16,
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    rowValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    rowValueMono: {
      fontSize: 13,
      fontFamily: 'monospace',
      color: colors.text,
      maxWidth: 180,
    },
    noWalletText: {
      fontSize: 15,
      color: colors.textTertiary,
      marginBottom: 8,
    },
    linkRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      marginTop: 4,
    },
    linkText: {
      fontSize: 15,
      color: colors.info,
      fontWeight: '500',
    },
    arrow: {
      fontSize: 18,
      color: colors.textTertiary,
    },
    favoriteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    favoriteBadge: {
      backgroundColor: colors.primary,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    favoriteBadgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    logoutButton: {
      backgroundColor: colors.errorBackground,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.error,
    },
    themeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    switch: {
      width: 50,
      height: 28,
    },
    switchTrack: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.border,
      borderRadius: 14,
      padding: 2,
    },
    switchTrackActive: {
      backgroundColor: colors.primary,
    },
    switchThumb: {
      width: 24,
      height: 24,
      backgroundColor: colors.background,
      borderRadius: 12,
    },
    switchThumbActive: {
      transform: [{ translateX: 22 }],
    },
    timeoutOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    timeoutOption: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timeoutOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    timeoutOptionText: {
      fontSize: 13,
      color: colors.text,
    },
    timeoutOptionTextActive: {
      color: '#FFFFFF',
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        {t('profile.title')}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {t('profile.account')}
        </Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('profile.email')}</Text>
          <Text style={styles.rowValue}>{user?.email ?? t('common.noResults')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {t('profile.wallet')}
        </Text>
        {activeWallet ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('profile.activeWallet')}</Text>
            <Text style={styles.rowValueMono} numberOfLines={1}>
              {activeWallet.publicKey.slice(0, 12)}...{activeWallet.publicKey.slice(-8)}
            </Text>
          </View>
        ) : (
          <Text style={styles.noWalletText}>{t('profile.noWalletConnected')}</Text>
        )}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('WalletManagement')}
          accessibilityRole="button"
          accessibilityLabel={t('profile.manageWallets', { count: wallets.length })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.linkText}>
            {t('profile.manageWallets', { count: wallets.length })}
          </Text>
          <Text style={styles.arrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {t('profile.settings')}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="App settings"
          style={styles.linkRow}
          onPress={() => navigation.navigate('Settings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.linkText}>App settings</Text>
          <Text style={styles.arrow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">→</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.linkRow} onPress={() => navigation.navigate('Favorites')}>
          <View style={styles.favoriteRow}>
            <Text style={styles.linkText}>{t('profile.favorites')}</Text>
            {favoriteCount > 0 && (
              <View style={styles.favoriteBadge}>
                <Text style={styles.favoriteBadgeText}>{favoriteCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
        <View style={styles.themeRow}>
          <Text style={styles.rowLabel}>{t('profile.theme')}</Text>
          <ThemeToggle variant="switch" showLabel={false} />
        </View>
        <TouchableOpacity style={styles.linkRow} onPress={handleRateApp}>
          <Text style={styles.linkText}>Rate NFTopia</Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          Security
        </Text>
        <BiometricSettings />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>App Lock</Text>
          <TouchableOpacity
            onPress={handleToggleAppLock}
            style={styles.switch}
            accessibilityRole="switch"
            accessibilityLabel="App lock"
            accessibilityState={{ checked: appLockEnabled }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.switchTrack, appLockEnabled && styles.switchTrackActive]}>
              <View style={[styles.switchThumb, appLockEnabled && styles.switchThumbActive]} />
            </View>
          </TouchableOpacity>
        </View>
        {appLockEnabled && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Lock Timeout</Text>
          </View>
        )}
        {appLockEnabled && (
          <View style={styles.timeoutOptions}>
            {[
              { label: 'Immediately', value: 0 },
              { label: '30 seconds', value: 30 },
              { label: '1 minute', value: 60 },
              { label: '5 minutes', value: 300 },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.timeoutOption,
                  lockTimeout === option.value && styles.timeoutOptionActive,
                ]}
                onPress={() => setLockTimeout(option.value)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: lockTimeout === option.value }}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text
                  style={[
                    styles.timeoutOptionText,
                    lockTimeout === option.value && styles.timeoutOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {t('profile.language')}
        </Text>
        <LanguageSwitcher variant="full" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {t('home.network')}
        </Text>
        <NetworkSwitcher network={network} onSwitch={switchNetwork} />
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleSignOut}
        accessibilityRole="button"
        accessibilityLabel={t('profile.signOut')}
      >
        <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const ProfileScreen = withErrorBoundary(ProfileContent, {
  name: 'ProfileScreen',
  onError: (error, errorInfo) => {
    errorLogger.log(
      error,
      'ProfileScreen',
      undefined,
      { componentStack: errorInfo.componentStack }
    );
  },
});

export default ProfileScreen;
