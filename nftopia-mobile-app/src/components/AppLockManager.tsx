import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { AppLockScreen } from '@/screens/Auth/AppLockScreen';

interface AppLockManagerProps {
  children: React.ReactNode;
}

export function AppLockManager({ children }: AppLockManagerProps) {
  const {
    isLocked,
    lockApp,
    unlockApp,
    appLockEnabled,
    lockTimeout,
    isAuthenticated,
  } = useAuthStore();

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);
  const [showLockScreen, setShowLockScreen] = useState(false);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousAppState = appState.current;

      if (previousAppState.match(/inactive/) && nextAppState === 'active') {
        // App coming from inactive to active (not background)
        return;
      }

      if (previousAppState.match(/background/) && nextAppState === 'active') {
        // App coming from background to active
        const timeInBackground = backgroundTimeRef.current
          ? Date.now() - backgroundTimeRef.current
          : 0;

        // Lock if app was in background longer than timeout and lock is enabled
        if (appLockEnabled && isAuthenticated && timeInBackground > lockTimeout * 1000) {
          lockApp();
          setShowLockScreen(true);
        }
      }

      if (nextAppState === 'background') {
        // App going to background
        backgroundTimeRef.current = Date.now();
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [appLockEnabled, lockTimeout, isAuthenticated, lockApp]);

  // Show lock screen when isLocked becomes true
  useEffect(() => {
    if (isLocked) {
      setShowLockScreen(true);
    }
  }, [isLocked]);

  const handleUnlockSuccess = () => {
    setShowLockScreen(false);
  };

  return (
    <>
      {showLockScreen && <AppLockScreen onUnlockSuccess={handleUnlockSuccess} />}
      {!showLockScreen && children}
    </>
  );
}
