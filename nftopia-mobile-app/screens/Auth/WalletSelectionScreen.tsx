import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'WalletSelection'>;

export default function WalletSelectionScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Choose Your Wallet</Text>
      <Text style={styles.subtitle}>
        Select a wallet to get started with NFTopia
      </Text>

      <View style={styles.wallets}>
        {/* Create New Wallet */}
        <TouchableOpacity
          style={styles.walletCard}
          onPress={() => navigation.navigate('WalletCreate')}
        >
          <View style={styles.walletIcon}>
            <Text style={styles.walletIconText}>🆕</Text>
          </View>
          <View style={styles.walletInfo}>
            <Text style={styles.walletName}>Create New Wallet</Text>
            <Text style={styles.walletDescription}>
              Generate a new Stellar wallet securely on your device
            </Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        {/* Import Existing Wallet */}
        <TouchableOpacity
          style={styles.walletCard}
          onPress={() => navigation.navigate('WalletImport')}
        >
          <View style={styles.walletIcon}>
            <Text style={styles.walletIconText}>📥</Text>
          </View>
          <View style={styles.walletInfo}>
            <Text style={styles.walletName}>Import Wallet</Text>
            <Text style={styles.walletDescription}>
              Import your existing Stellar wallet using secret key
            </Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.orText}>OR</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity
        style={styles.emailButton}
        onPress={() => navigation.navigate('EmailLogin')}
      >
        <Text style={styles.emailButtonText}>Sign in with Email</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
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
  wallets: {
    gap: 16,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  walletIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  walletIconText: {
    fontSize: 24,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  walletDescription: {
    fontSize: 14,
    color: '#666',
  },
  arrow: {
    fontSize: 24,
    color: '#999',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#e9ecef',
  },
  orText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  emailButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  emailButtonText: {
    color: '#333',
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
