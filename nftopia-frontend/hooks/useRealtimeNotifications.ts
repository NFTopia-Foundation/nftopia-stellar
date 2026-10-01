"use client";

import { useEffect } from 'react';
import { useNotificationActions } from '@/lib/stores/notification-store';
import { NotificationType } from '@/lib/stores/types';

export interface RealtimeNotificationEventDetail {
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  metadata?: Record<string, unknown>;
}

export function useRealtimeNotifications() {
  const { addNotification } = useNotificationActions();

  useEffect(() => {
    const handleCustomNotification = (event: Event) => {
      const customEvent = event as CustomEvent<RealtimeNotificationEventDetail>;
      if (customEvent.detail && customEvent.detail.title) {
        addNotification({
          title: customEvent.detail.title,
          message: customEvent.detail.message,
          type: customEvent.detail.type || 'system',
          link: customEvent.detail.link,
          metadata: customEvent.detail.metadata,
        });
      }
    };

    window.addEventListener('nftopia:notification', handleCustomNotification);

    return () => {
      window.removeEventListener('nftopia:notification', handleCustomNotification);
    };
  }, [addNotification]);
}

/**
 * Utility helper to programmatically trigger a real-time notification event
 * across the application.
 */
export function dispatchRealtimeNotification(detail: RealtimeNotificationEventDetail) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<RealtimeNotificationEventDetail>('nftopia:notification', {
      detail,
    });
    window.dispatchEvent(event);
  }
}
