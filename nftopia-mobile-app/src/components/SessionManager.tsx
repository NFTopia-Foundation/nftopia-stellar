import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { SessionExpiryModal } from './SessionExpiryModal';
import { useToastStore } from '@/stores/toastStore';

export function SessionManager() {
  const {
    isAuthenticated,
    sessionExpiryTime,
    warningThreshold,
    getSessionTimeRemaining,
    setShowExpiryWarning,
    checkSessionExpiry,
    logout,
  } = useAuthStore();
  const { showToast } = useToastStore();
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !sessionExpiryTime) {
      setModalVisible(false);
      return;
    }

    // Check session status every 10 seconds
    const interval = setInterval(() => {
      const remaining = getSessionTimeRemaining();

      if (remaining === null) return;

      // Show warning when approaching threshold
      if (remaining <= warningThreshold && remaining > 0) {
        setShowExpiryWarning(true);
        setModalVisible(true);
      }

      // Force logout if expired
      if (remaining <= 0) {
        handleSessionExpired();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isAuthenticated, sessionExpiryTime, warningThreshold, getSessionTimeRemaining, setShowExpiryWarning]);

  const handleSessionExpired = async () => {
    setModalVisible(false);
    setShowExpiryWarning(false);

    showToast('Your session has expired. Please log in again.', 'error', 5000);

    await logout();
    // Note: Navigation reset should be handled by the auth state change
    // The AuthNavigator will automatically redirect to login
  };

  const handleExtend = () => {
    setModalVisible(false);
    setShowExpiryWarning(false);

    showToast('Your session has been extended successfully.', 'success', 3000);
  };

  const handleLogout = async () => {
    setModalVisible(false);
    setShowExpiryWarning(false);
    await logout();
  };

  return (
    <SessionExpiryModal
      visible={modalVisible}
      onExtend={handleExtend}
      onLogout={handleLogout}
    />
  );
}
