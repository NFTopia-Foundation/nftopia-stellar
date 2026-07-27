import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/MainNavigator';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { useAuthStore } from '@/stores/authStore';
import NetworkSwitcher from '@/components/wallet/NetworkSwitcher';

type Props = NativeStackScreenProps<MainStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { activeWallet, network, switchNetwork, wallets } = useWalletConnect();
  const { user, logout } = useAuthStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{user?.email ?? 'Not set'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wallet</Text>
        {activeWallet ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Active Wallet</Text>
            <Text style={styles.rowValueMono} numberOfLines={1}>
              {activeWallet.publicKey.slice(0, 12)}...{activeWallet.publicKey.slice(-8)}
            </Text>
          </View>
        ) : (
          <Text style={styles.noWalletText}>No wallet connected</Text>
        )}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('WalletManagement')}
        >
          <Text style={styles.linkText}>Manage Wallets ({wallets.length})</Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Network</Text>
        <NetworkSwitcher network={network} onSwitch={switchNetwork} />
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 60,
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
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
  logoutButton: {
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
});
