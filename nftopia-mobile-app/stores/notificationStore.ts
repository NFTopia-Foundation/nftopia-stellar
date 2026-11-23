import { createStore } from '@/src/utils/store.factory';
import { Notification, NotificationPreferences } from '@/types';
import apiClient from '@/lib/api/sample';
import { pushNotificationService } from '@/src/services/pushNotification.service';
import { DEFAULT_QUIET_HOURS } from '@/src/utils/notificationSchedule';

export const VERSION = 2;

const defaultPreferences: NotificationPreferences = {
  outbid: true,
  sale: true,
  follow: true,
  mint: true,
  auction_end: true,
  listing: true,
  offer: true,
  transfer: true,
  pushEnabled: true,
  quietHours: DEFAULT_QUIET_HOURS,
};

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  preferences: NotificationPreferences;

  fetchNotifications: (page?: number, limit?: number) => Promise<void>;
  hasMore: boolean;
  page: number;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  addNotification: (notification: Notification) => void;
  resetBadgeCount: () => Promise<void>;
}

const initialState: NotificationStore = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  hasMore: true,
  page: 1,
  preferences: defaultPreferences,

  fetchNotifications: async () => {},
  fetchUnreadCount: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  fetchPreferences: async () => {},
  updatePreferences: async () => {},
  addNotification: () => {},
  resetBadgeCount: async () => {},
};

export const useNotificationStore = createStore<NotificationStore>({
  name: 'notification-store',
  initialState,
  actions: (set, get) => ({
    ...initialState,

    fetchNotifications: async (page = 1, limit = 20) => {
      set({ loading: true, error: null });
      try {
        const notifications = await apiClient.getNotifications(page, limit);
        const unreadCount = notifications.filter((n) => !n.read).length;
        await pushNotificationService.updateBadgeCount(unreadCount);
        const prev = page > 1 ? get().notifications : [];
        // Deduplicate by id when appending pages
        const merged =
          page > 1
            ? [
                ...prev,
                ...notifications.filter(
                  (n) => !prev.some((p) => p.id === n.id),
                ),
              ]
            : notifications;
        set({
          notifications: merged,
          unreadCount:
            page > 1
              ? merged.filter((n) => !n.read).length
              : unreadCount,
          loading: false,
          page,
          hasMore: notifications.length >= limit,
        });
      } catch (error: any) {
        set({
          error: error?.message || 'Failed to load notifications',
          loading: false,
        });
      }
    },

    fetchUnreadCount: async () => {
      try {
        const { count } = await apiClient.getUnreadCount();
        set({ unreadCount: count });
        await pushNotificationService.updateBadgeCount(count);
      } catch {
        // Silently fail
      }
    },

    markAsRead: async (id: string) => {
      try {
        await apiClient.markNotificationRead(id);
        set((state) => {
          const newNotifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          const newUnreadCount = newNotifications.filter(n => !n.read).length;
          pushNotificationService.updateBadgeCount(newUnreadCount);
          return {
            notifications: newNotifications,
            unreadCount: newUnreadCount,
          };
        });
      } catch (error: any) {
        console.error('Failed to mark notification as read:', error.message);
      }
    },

    markAllAsRead: async () => {
      try {
        await apiClient.markAllNotificationsRead();
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
        await pushNotificationService.resetBadgeCount();
      } catch (error: any) {
        console.error('Failed to mark all as read:', error.message);
      }
    },

    fetchPreferences: async () => {
      try {
        const preferences = await apiClient.getNotificationPreferences();
        set({ preferences });
      } catch {
        // Use defaults
      }
    },

    updatePreferences: async (prefs: Partial<NotificationPreferences>) => {
      try {
        const preferences = await apiClient.updateNotificationPreferences(prefs);
        set({ preferences });
      } catch (error: any) {
        console.error('Failed to update preferences:', error.message);
      }
    },

    addNotification: (notification: Notification) => {
      set((state) => {
        const newNotifications = [notification, ...state.notifications];
        const newUnreadCount = newNotifications.filter(n => !n.read).length;
        pushNotificationService.updateBadgeCount(newUnreadCount);
        return {
          notifications: newNotifications,
          unreadCount: newUnreadCount,
        };
      });
    },

    resetBadgeCount: async () => {
      await pushNotificationService.resetBadgeCount();
      set({ unreadCount: 0 });
    },
  }),
  persist: {
    enabled: true,
    name: 'notification-storage',
    version: VERSION,
    // v1 -> v2: added `preferences.quietHours`. Older persisted state has no
    // such field; without this, hydrating it would leave `quietHours`
    // `undefined` and crash the first read (e.g. `isWithinQuietHours`).
    migrate: async (state: any) => ({
      ...state,
      preferences: {
        ...defaultPreferences,
        ...state?.preferences,
        quietHours: state?.preferences?.quietHours ?? DEFAULT_QUIET_HOURS,
      },
    }),
    partialize: (state: NotificationStore) => ({
      notifications: state.notifications,
      unreadCount: state.unreadCount,
      preferences: state.preferences,
    }),
    storage: 'async', // Use async storage for notifications
    blacklist: ['loading', 'error'], // Don't persist loading and error states
  },
  devtools: {
    enabled: __DEV__,
    name: 'NotificationStore',
  },
});