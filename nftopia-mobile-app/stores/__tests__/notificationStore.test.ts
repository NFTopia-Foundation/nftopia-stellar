// ── Mocks ─────────────────────────────────────────────────────────────────────

// React Native injects this global at build time; this repo's jest config
// runs in a plain node environment, so shim it before the store module
// (which reads it via the shared createStore factory) is imported.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const asyncStorageStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(asyncStorageStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    asyncStorageStore[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete asyncStorageStore[key];
    return Promise.resolve();
  }),
  mergeItem: jest.fn(),
  clear: jest.fn(() => {
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(asyncStorageStore))),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

const mockApiClient = {
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
};
jest.mock('@/lib/api/sample', () => ({
  __esModule: true,
  default: mockApiClient,
}));

const mockPushNotificationService = {
  updateBadgeCount: jest.fn().mockResolvedValue(undefined),
  resetBadgeCount: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@/src/services/pushNotification.service', () => ({
  pushNotificationService: mockPushNotificationService,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useNotificationStore } from '../notificationStore';
import { DEFAULT_QUIET_HOURS } from '@/src/utils/notificationSchedule';
import type { NotificationPreferences } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PREFERENCES: NotificationPreferences = {
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

function getStore() {
  return useNotificationStore.getState();
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: null,
      preferences: { ...DEFAULT_PREFERENCES },
    });
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    jest.clearAllMocks();
  });

  describe('default preferences', () => {
    it('enables every category and push by default', () => {
      const { preferences } = getStore();
      expect(preferences.outbid).toBe(true);
      expect(preferences.sale).toBe(true);
      expect(preferences.follow).toBe(true);
      expect(preferences.mint).toBe(true);
      expect(preferences.auction_end).toBe(true);
      expect(preferences.listing).toBe(true);
      expect(preferences.offer).toBe(true);
      expect(preferences.transfer).toBe(true);
      expect(preferences.pushEnabled).toBe(true);
    });

    it('starts with quiet hours disabled (never silently mutes a new install)', () => {
      expect(getStore().preferences.quietHours.enabled).toBe(false);
    });

    it('pre-fills a conventional overnight quiet-hours window', () => {
      expect(getStore().preferences.quietHours.start).toBe('22:00');
      expect(getStore().preferences.quietHours.end).toBe('08:00');
    });
  });

  describe('updatePreferences', () => {
    it('toggles a single category independently, leaving others untouched', async () => {
      mockApiClient.updateNotificationPreferences.mockResolvedValue({
        ...DEFAULT_PREFERENCES,
        outbid: false,
      });

      await getStore().updatePreferences({ outbid: false });

      expect(getStore().preferences.outbid).toBe(false);
      expect(getStore().preferences.sale).toBe(true);
      expect(mockApiClient.updateNotificationPreferences).toHaveBeenCalledWith({ outbid: false });
    });

    it('merges a partial quietHours update into the store returned by the API', async () => {
      const updated = {
        ...DEFAULT_PREFERENCES,
        quietHours: { enabled: true, start: '23:00', end: '07:00' },
      };
      mockApiClient.updateNotificationPreferences.mockResolvedValue(updated);

      await getStore().updatePreferences({ quietHours: updated.quietHours });

      expect(getStore().preferences.quietHours).toEqual({
        enabled: true,
        start: '23:00',
        end: '07:00',
      });
    });

    it('leaves preferences unchanged and logs on API failure, rather than applying a partial update optimistically', async () => {
      mockApiClient.updateNotificationPreferences.mockRejectedValue(new Error('network down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getStore().updatePreferences({ outbid: false });

      expect(getStore().preferences.outbid).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('fetchPreferences', () => {
    it('replaces preferences with the server response', async () => {
      const serverPrefs = { ...DEFAULT_PREFERENCES, follow: false };
      mockApiClient.getNotificationPreferences.mockResolvedValue(serverPrefs);

      await getStore().fetchPreferences();

      expect(getStore().preferences.follow).toBe(false);
    });

    it('falls back to the existing (default) preferences when the fetch fails', async () => {
      mockApiClient.getNotificationPreferences.mockRejectedValue(new Error('offline'));

      await getStore().fetchPreferences();

      expect(getStore().preferences).toEqual(DEFAULT_PREFERENCES);
    });
  });


  describe('fetchNotifications', () => {
    it('loads notifications from the API and updates unread count', async () => {
      mockApiClient.getNotifications.mockResolvedValue([
        { id: '1', read: false, title: 'A' },
        { id: '2', read: true, title: 'B' },
      ]);

      await getStore().fetchNotifications();

      expect(mockApiClient.getNotifications).toHaveBeenCalledWith(1, 20);
      expect(getStore().loading).toBe(false);
      expect(getStore().error).toBeNull();
      expect(getStore().notifications).toHaveLength(2);
      expect(getStore().unreadCount).toBe(1);
      expect(mockPushNotificationService.updateBadgeCount).toHaveBeenCalledWith(1);
    });

    it('handles an empty result set', async () => {
      mockApiClient.getNotifications.mockResolvedValue([]);

      await getStore().fetchNotifications();

      expect(getStore().notifications).toEqual([]);
      expect(getStore().unreadCount).toBe(0);
      expect(getStore().hasMore).toBe(false);
      expect(getStore().loading).toBe(false);
    });

    it('sets error state when the API fails', async () => {
      mockApiClient.getNotifications.mockRejectedValue(new Error('network down'));

      await getStore().fetchNotifications();

      expect(getStore().loading).toBe(false);
      expect(getStore().error).toMatch(/network down/);
      expect(getStore().notifications).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('writes preference changes to storage', async () => {
      mockApiClient.updateNotificationPreferences.mockResolvedValue({
        ...DEFAULT_PREFERENCES,
        mint: false,
      });

      await getStore().updatePreferences({ mint: false });
      await flushMicrotasks();

      const raw = asyncStorageStore['notification-storage'];
      expect(raw).toBeDefined();
      expect(raw).toContain('"mint":false');
    });

    it('persists quiet hours across restarts', async () => {
      const quietHours = { enabled: true, start: '21:00', end: '06:00' };
      mockApiClient.updateNotificationPreferences.mockResolvedValue({
        ...DEFAULT_PREFERENCES,
        quietHours,
      });

      await getStore().updatePreferences({ quietHours });
      await flushMicrotasks();

      const raw = asyncStorageStore['notification-storage'];
      expect(raw).toContain('"start":"21:00"');
      expect(raw).toContain('"end":"06:00"');
    });
  });
});
