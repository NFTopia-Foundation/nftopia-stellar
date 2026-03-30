import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';
import { useAuthStore } from '@/stores/authStore';
import FormInput from './components/FormInput';
import PasswordStrengthIndicator from './components/PasswordStrengthIndicator';
import { validateEmail, validatePassword, validateUsername, validateConfirmPassword } from './utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailRegister'>;

export default function EmailRegisterScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Validation errors
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const { setUser, setError: setAuthError } = useAuthStore();

  const validateForm = (): boolean => {
    // Clear previous errors
    setUsernameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);

    let isValid = true;

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      setUsernameError(usernameValidation.error);
      isValid = false;
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error);
      isValid = false;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error);
      isValid = false;
    }

    // Validate confirm password
    const confirmPasswordValidation = validateConfirmPassword(password, confirmPassword);
    if (!confirmPasswordValidation.isValid) {
      setConfirmPasswordError(confirmPasswordValidation.error);
      isValid = false;
    }

    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setAuthError(null);
      
      // TODO: Implement actual registration logic with backend
      // For now, just simulate registration
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate user data
      setUser({
        id: Date.now().toString(),
        email: email,
        createdAt: new Date(),
      });

      Alert.alert('Success', 'Account created successfully!');
      
      // Navigate to main app (to be implemented)
      // navigation.reset({ routes: [{ name: 'Main' }] });
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to register';
      setAuthError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>
        Sign up to start your NFT journey
      </Text>

      <View style={styles.form}>
        <FormInput
          label="Username"
          placeholder="Choose a username"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (usernameError) setUsernameError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          error={usernameError}
          testID="username-input"
        />

        <FormInput
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (emailError) setEmailError(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          error={emailError}
          testID="email-input"
        />

        <View style={styles.inputGroup}>
          <FormInput
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(null);
              if (confirmPassword && confirmPasswordError) {
                setConfirmPasswordError(null);
              }
            }}
            secureTextEntry
            autoCapitalize="none"
            editable={!isLoading}
            error={passwordError}
            testID="password-input"
          />
          <PasswordStrengthIndicator password={password} />
        </View>

        <FormInput
          label="Confirm Password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (confirmPasswordError) setConfirmPasswordError(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          editable={!isLoading}
          error={confirmPasswordError}
          testID="confirm-password-input"
        />

        <View style={styles.termsBox}>
          <Text style={styles.termsText}>
            By creating an account, you agree to our{' '}
            <Text style={styles.linkText}>Terms of Service</Text> and{' '}
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
          testID="register-button"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.row}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('EmailLogin')}>
            <Text style={styles.linkText}>Sign In</Text>
          </TouchableOpacity>
        </View>

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
  termsBox: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  termsText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 32,
    gap: 16,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
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
