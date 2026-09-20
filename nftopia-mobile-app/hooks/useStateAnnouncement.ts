import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useStateAnnouncement(
  message: string | null | undefined,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled || !message) return undefined;
    if (Platform.OS === 'web') return undefined;

    const timer = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(message);
    }, 100);

    return () => clearTimeout(timer);
  }, [message, enabled]);
}
