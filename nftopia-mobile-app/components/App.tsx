import "./global.css";
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native';
import EmailLoginScreen from './screens/Auth/EmailLoginScreen';
import EmailRegisterScreen from './screens/Auth/EmailRegisterScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'Login' | 'Register'>('Login');

  const mockNavigation = {
    navigate: (screenName: string) => {
      if (screenName === 'EmailRegister') setCurrentScreen('Register');
      if (screenName === 'EmailLogin') setCurrentScreen('Login');
      if (screenName === 'MainApp') setCurrentScreen('Login'); // mock successful auth
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {currentScreen === 'Login' ? (
        <EmailLoginScreen navigation={mockNavigation} />
      ) : (
        <EmailRegisterScreen navigation={mockNavigation} />
      )}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}
