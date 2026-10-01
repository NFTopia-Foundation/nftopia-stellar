import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { NotificationStore, NotificationItem, NotificationState } from './types';

const MAX_NOTIFICATIONS = 50;

const initialNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'New Bid Received',
    message: 'Someone placed a bid of 150 XLM on "Cosmic Explorer #042"',
    type: 'bid',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    read: false,
    link: '/explore',
  },
  {
    id: 'notif-2',
    title: 'Item Sold!',
    message: 'Your NFT "Nebula Spark #007" was sold for 320 XLM',
    type: 'sale',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    read: false,
    link: '/marketplace',
  },
  {
    id: 'notif-3',
    title: 'New Follower',
    message: 'StellarArtist liked your collection "Stellar Dreams"',
    type: 'follow',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    read: true,
    link: '/artists',
  },
];

const initialState: NotificationState = {
  notifications: initialNotifications,
  isHydrated: false,
};

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      immer((set) => ({
        ...initialState,

        addNotification: (payload) =>
          set((state: NotificationState) => {
            const newNotif: NotificationItem = {
              id: payload.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              timestamp: payload.timestamp || new Date().toISOString(),
              read: payload.read ?? false,
              title: payload.title,
              message: payload.message,
              type: payload.type,
              link: payload.link,
              metadata: payload.metadata,
            };

            // Prepend new notification and cap at MAX_NOTIFICATIONS
            state.notifications = [newNotif, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
          }),

        markAsRead: (id: string) =>
          set((state: NotificationState) => {
            const target = state.notifications.find((n: NotificationItem) => n.id === id);
            if (target) {
              target.read = true;
            }
          }),

        markAllAsRead: () =>
          set((state: NotificationState) => {
            state.notifications.forEach((n: NotificationItem) => {
              n.read = true;
            });
          }),

        removeNotification: (id: string) =>
          set((state: NotificationState) => {
            state.notifications = state.notifications.filter((n: NotificationItem) => n.id !== id);
          }),

        clearAll: () =>
          set((state: NotificationState) => {
            state.notifications = [];
          }),

        setHydrated: (hydrated: boolean) =>
          set((state: NotificationState) => {
            state.isHydrated = hydrated;
          }),
      })),
      {
        name: 'nftopia-notifications',
        version: 1,
        onRehydrateStorage: () => (state) => {
          state?.setHydrated(true);
        },
        partialize: (state: NotificationState) => ({
          notifications: state.notifications,
        }),
      }
    ),
    {
      name: 'notification-store',
    }
  )
);

// Hooks for component integration
export const useUnreadCount = () => {
  return useNotificationStore((state: NotificationState) =>
    state.notifications.reduce((count: number, item: NotificationItem) => (item.read ? count : count + 1), 0)
  );
};

export const useNotificationActions = () => {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const clearAll = useNotificationStore((state) => state.clearAll);

  return {
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  };
};
