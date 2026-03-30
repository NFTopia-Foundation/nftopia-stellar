import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';
import { useAuthStore } from '@/stores/authStore';
import { StellarWalletService } from '@/src/services/stellar/wallet.service';

type Props = NativeStackScreenProps<AuthStackParamList, 'WalletImport'>;

export default function WalletImportScreen({ navigation }: Props) {
  const [secretKey, setSecretKey] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setUser } = useAuthStore();

  const handleImportWallet = async () => {
    if (!secretKey || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      
      // Import wallet using the wallet service
      const walletService = new StellarWalletService();
      const wallet = await walletService.importFromSecretKey(secretKey, password);
      
      // Store user data
      setUser({
        id: Date.now().toString(),
        walletAddress: wallet.publicKey,
        walletType: 'stellar',
        createdAt: new Date(),
      });

      Alert.alert('Success', 'Wallet imported successfully!');
      
      // Navigate to main app (to be implemented)
      // navigation.reset({ routes: [{ name: 'Main' }] });
    } catch (error) {
      console.error('Wallet import error:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to import wallet'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Import Wallet</Text>
      <Text style={styles.subtitle}>
        Enter your Stellar secret key to import your wallet
      </Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Secret Key</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter your secret key (starts with S)"
            placeholderTextColor="#999"
            value={secretKey}
            onChangeText={setSecretKey}
            secureTextEntry
            autoCapitalize="none"
            multiline
            numberOfLines={3}
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Create a password to encrypt your wallet"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!isLoading}
          />
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>🔒</Text>
          <Text style={styles.warningText}>
            Your secret key is stored encrypted on your device. Never share it with anyone.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleImportWallet}
          disabled={isLoading}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading ? 'Importing...' : 'Import Wallet'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  textArea: {
    fontFamily: 'monospace',
    fontSize: 14,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#e7f3ff',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  warningIcon: {
    fontSize: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#084298',
    lineHeight: 20,
  },
  footer: {
    paddingBottom: 32,
    gap: 12,
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
