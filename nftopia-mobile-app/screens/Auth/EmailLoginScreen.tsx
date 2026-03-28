import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { FormInput } from '../../components/FormInput';
import { AuthService } from '../../lib/api/AuthService';
import { useAuthStore } from '../../lib/zustand/useAuthStore';

export default function EmailLoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; api?: string }>({});

  const validate = () => {
    const newErrors: any = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    try {
      const response = await AuthService.login(email, password);
      // Backend returns access_token, refresh_token, user
      useAuthStore.getState().setAuth(response.access_token, response.refresh_token, response.user);
      navigation?.navigate('MainApp');
      Alert.alert('Success', 'Logged in successfully!');
    } catch (error: any) {
      setErrors({ api: error.message || 'Login failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <Text className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</Text>
      <Text className="text-gray-500 mb-8 text-2xl">Sign in to your NFTopia account</Text>

      {errors.api ? (
        <View className="bg-red-50 p-3 rounded-lg mb-4">
          <Text className="text-red-600 text-sm text-center">{errors.api}</Text>
        </View>
      ) : null}

      <FormInput
        label="Email Address"
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={(text) => { setEmail(text); setErrors(prev => ({ ...prev, email: undefined })); }}
        error={errors.email}
      />

      <FormInput
        label="Password"
        placeholder="Enter your password"
        secureTextEntry
        value={password}
        onChangeText={(text) => { setPassword(text); setErrors(prev => ({ ...prev, password: undefined })); }}
        error={errors.password}
      />

      <TouchableOpacity className="self-end mb-6" onPress={() => {}}>
        <Text className="text-blue-600 font-medium">Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`bg-blue-600 rounded-lg py-4 items-center justify-center mb-6 flex-row ${loading ? 'opacity-70' : ''}`}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#ffffff" className="mr-2" /> : null}
        <Text className="text-white font-bold text-lg">Login</Text>
      </TouchableOpacity>

      <View className="flex-row justify-center mt-4">
        <Text className="text-gray-500">Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation?.navigate('EmailRegister')}>
          <Text className="text-blue-600 font-bold">Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
