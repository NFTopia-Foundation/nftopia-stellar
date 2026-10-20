import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';
import { useAuthStore } from '@/stores/authStore';
import { KeyboardAwareScreen } from '@/src/components/KeyboardAwareScreen';
import FormInput from './components/FormInput';
import PasswordStrengthIndicator from './components/PasswordStrengthIndicator';
import { validateEmail, validatePassword, validateUsername, validateConfirmPassword } from './utils/validation';
import { authService } from '@/services/auth/auth.service';
import { ApiAuthError } from '@/services/auth/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailRegister'>;

export default function EmailRegisterScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Field refs for focus chaining via the return key.
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  
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

      const response = await authService.emailRegister(
        email.trim(),
        password,
        username.trim(),
      );

      // Store the backend's user; flipping isAuthenticated makes
      // AppNavigator swap AuthNavigator for MainNavigator, which is how
      // this screen hands the user into the authenticated app.
      setUser({
        id: response.user.id,
        email: response.user.email ?? email.trim(),
        username: response.user.username ?? username.trim(),
        createdAt: new Date(),
      });

      Alert.alert('Success', 'Account created successfully!');
    } catch (error) {
      console.error('Registration error:', error);

      const apiError = (error ?? {}) as ApiAuthError;
      const statusCode =
        typeof apiError.statusCode === 'number' ? apiError.statusCode : undefined;
      const errorMessage =
        typeof apiError.message === 'string' && apiError.message.length > 0
          ? apiError.message
          : 'Failed to register';

      // The auth service reports failures as { message, statusCode }: a 4xx
      // status means the backend rejected the submitted values (e.g. 409
      // "Email is already registered"), while a failure with no status at
      // all is a transport problem (server unreachable, timeout, offline).
      const isNetworkError =
        statusCode === undefined &&
        /network|timeout|connection|offline/i.test(errorMessage);
      const isValidationError =
        statusCode !== undefined && statusCode >= 400 && statusCode < 500;

      setAuthError(errorMessage);
      if (isNetworkError) {
        Alert.alert(
          'Network Error',
          'Unable to reach the server. Check your connection and try again.',
        );
      } else if (isValidationError) {
        Alert.alert('Validation Error', errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <View style={styles.footerGap}>
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
  );

  return (
    <KeyboardAwareScreen
      footer={footer}
      contentContainerStyle={styles.content}
    >
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
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
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
          inputRef={emailRef}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
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
            inputRef={passwordRef}
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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
          inputRef={confirmPasswordRef}
          returnKeyType="done"
          onSubmitEditing={handleRegister}
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
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    backgroundColor: '#ffffff',
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
  primaryButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerGap: {
    gap: 16,
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
