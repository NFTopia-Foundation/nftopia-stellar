import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface MnemonicConfirmationProps {
  confirmed: boolean;
  onChange: (confirmed: boolean) => void;
}

export const MnemonicConfirmation: React.FC<MnemonicConfirmationProps> = ({
  confirmed,
  onChange,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onChange(!confirmed)}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: confirmed }}
    >
      <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
        {confirmed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.label}>
        I have saved my recovery phrase securely. I understand that losing it means
        permanent loss of access to my wallet.
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
  },
});
