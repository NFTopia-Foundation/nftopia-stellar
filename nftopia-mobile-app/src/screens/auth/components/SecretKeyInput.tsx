import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { stellarWalletService } from '../../../services/stellar/wallet.service';

interface SecretKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export const SecretKeyInput: React.FC<SecretKeyInputProps> = ({
  value,
  onChange,
  error,
}) => {
  const [visible, setVisible] = useState(false);

  const isValid = value.length > 0 && stellarWalletService.isValidSecretKey(value);
  const showValidation = value.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Secret Key</Text>
      <View
        style={[
          styles.inputRow,
          showValidation && isValid && styles.inputValid,
          showValidation && !isValid && styles.inputInvalid,
          error && styles.inputInvalid,
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="S..."
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          autoCorrect={false}
          secureTextEntry={!visible}
          accessibilityLabel="Stellar secret key"
        />
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setVisible((v) => !v)}
          accessibilityLabel={visible ? 'Hide secret key' : 'Show secret key'}
        >
          <Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>
      {showValidation && !isValid && !error && (
        <Text style={styles.hint}>
          Stellar secret keys start with &apos;S&apos; and are 56 characters long.
        </Text>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {showValidation && isValid && (
        <Text style={styles.validText}>Valid secret key</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  inputValid: {
    borderColor: '#10B981',
  },
  inputInvalid: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 12,
    fontFamily: 'monospace',
  },
  toggleButton: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  toggleText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
  },
  validText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
});
