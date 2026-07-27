import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { NetworkType } from '@/stores/walletStore';

interface NetworkSwitcherProps {
  network: NetworkType;
  onSwitch: (network: NetworkType) => void;
}

export default function NetworkSwitcher({ network, onSwitch }: NetworkSwitcherProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Network</Text>
      <View style={styles.switchRow}>
        <TouchableOpacity
          style={[
            styles.option,
            network === 'testnet' && styles.optionActive,
          ]}
          onPress={() => onSwitch('testnet')}
        >
          <View style={[styles.dot, network === 'testnet' ? styles.dotTestnet : styles.dotInactive]} />
          <Text
            style={[
              styles.optionText,
              network === 'testnet' && styles.optionTextActive,
            ]}
          >
            Testnet
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.option,
            network === 'mainnet' && styles.optionActive,
          ]}
          onPress={() => onSwitch('mainnet')}
        >
          <View style={[styles.dot, network === 'mainnet' ? styles.dotMainnet : styles.dotInactive]} />
          <Text
            style={[
              styles.optionText,
              network === 'mainnet' && styles.optionTextActive,
            ]}
          >
            Mainnet
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flex: 1,
    justifyContent: 'center',
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotTestnet: {
    backgroundColor: colors.testnet,
  },
  dotMainnet: {
    backgroundColor: colors.mainnet,
  },
  dotInactive: {
    backgroundColor: colors.textTertiary,
  },
  optionText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  optionTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
});
