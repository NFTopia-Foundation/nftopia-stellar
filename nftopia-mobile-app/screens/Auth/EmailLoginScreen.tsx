import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';
import { useAuthStore } from '@/stores/authStore';
import { useAnalytics } from '@/src/hooks/useAnalytics';
import { ANALYTICS_EVENTS } from '@/src/analytics/config';
import { KeyboardAwareScreen } from '@/src/components/KeyboardAwareScreen';
import { haptics } from '@/lib/haptics';
import FormInput from './components/FormInput';
import { validateEmail, validatePassword } from './utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailLogin'>;

export default function EmailLoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const { setUser, setError: setAuthError } = useAuthStore();
  const { track, trackError, identify } = useAnalytics();

  const validateForm = (): boolean => {
    setEmailError(null);
    setPasswordError(null);

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error);
      haptics.error();
      return false;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error);
      haptics.error();
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    track(ANALYTICS_EVENTS.LOGIN_START, { email });

    try {
      setIsLoading(true);
      setAuthError(null);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const userData = {
        id: Date.now().toString(),
        email: email,
        createdAt: new Date(),
      };

      setUser(userData);
      
      // Identify user for analytics
      identify(userData.id, {
        email: userData.email,
        createdAt: userData.createdAt,
      });

      track(ANALYTICS_EVENTS.LOGIN_SUCCESS, {
        userId: userData.id,
        email: userData.email,
      });

      Alert.alert('Success', 'Logged in successfully!');
      
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to login';
      setAuthError(errorMessage);
      
      trackError(error as Error, {
        email,
        action: 'login',
      });
      
      track(ANALYTICS_EVENTS.LOGIN_FAILURE, {
        error: errorMessage,
      });
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <View style={styles.footerGap}>
      <TouchableOpacity
        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
        testID="login-button"
        accessibilityRole="button"
        accessibilityLabel="Sign in"
        accessibilityState={{ disabled: isLoading, busy: isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <View style={styles.row}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity
          onPress={() => {
            track('register_navigation');
            navigation.navigate('EmailRegister');
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign up for a new account"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Text style={styles.linkText}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          track('back_navigation');
          navigation.goBack();
        }}
        disabled={isLoading}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAwareScreen footer={footer} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        Welcome Back
      </Text>
      <Text style={styles.subtitle}>
        Sign in to continue to NFTopia
      </Text>


      <View style={styles.form}>
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
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          testID="email-input"
        />

        <FormInput
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (passwordError) setPasswordError(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          editable={!isLoading}
          error={passwordError}
          inputRef={passwordRef}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          testID="password-input"
        />

        <TouchableOpacity 
          style={styles.forgotPassword}
          onPress={() => {
            track('password_reset_clicked');
            Alert.alert('Feature coming soon!', 'Password reset will be implemented in the next update.');
          }}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityState={{ disabled: isLoading }}
        >
          <Text style={[styles.forgotPasswordText, isLoading && styles.disabledLink]}>
            Forgot Password?
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
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
  forgotPassword: {
    alignItems: 'flex-end',
    marginTop: -8,
  },
  forgotPasswordText: {
    // #0070EB (was #007AFF): the brighter blue only reached 4.02:1 against
    // white, failing WCAG AA (4.5:1) for this 14px link text.
    color: '#0070EB',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledLink: {
    opacity: 0.5,
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
  linkText: {
    color: '#0070EB',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
});