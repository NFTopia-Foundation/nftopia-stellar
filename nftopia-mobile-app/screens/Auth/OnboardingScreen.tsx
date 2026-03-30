import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        <Text style={styles.title}>Welcome to NFTopia</Text>
        <Text style={styles.subtitle}>
          Your gateway to the world of NFTs on Stellar
        </Text>
        
        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🎨</Text>
            <Text style={styles.featureText}>Create & Collect NFTs</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🔒</Text>
            <Text style={styles.featureText}>Secure & Decentralized</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>⚡</Text>
            <Text style={styles.featureText}>Fast Transactions</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('WalletSelection')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('EmailLogin')}
        >
          <Text style={styles.secondaryButtonText}>Sign In with Email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 32,
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
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  features: {
    width: '100%',
    gap: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    paddingBottom: 32,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});
