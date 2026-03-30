import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SplashScreen from '@/components/SplashScreen';

export default function AppNavigator() {
  const { isAuthenticated, isCheckingAuth, initializeAuth } = useAuthStore();

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Show splash screen while checking auth status
  if (isCheckingAuth) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
