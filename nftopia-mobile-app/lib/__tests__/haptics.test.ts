// Written without importing RN components so it runs in the project's node
// jest environment. Platform and the preferences store are mocked so the guard
// logic can be exercised deterministically.

const mockImpactAsync = jest.fn((_style?: unknown) => Promise.resolve());
const mockNotificationAsync = jest.fn((_type?: unknown) => Promise.resolve());
const mockSelectionAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
  impactAsync: (style?: unknown) => mockImpactAsync(style),
  notificationAsync: (type?: unknown) => mockNotificationAsync(type),
  selectionAsync: () => mockSelectionAsync(),
}));

const mockPlatform = { OS: 'ios' as string };
jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

let reduceHaptics = false;
jest.mock('@/stores/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({ reduceHaptics }),
  },
}));

import {
  haptics,
  impactAsync,
  notificationAsync,
  selectionAsync,
  trigger,
  isHapticsSupported,
  areHapticsEnabled,
} from '../haptics';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('lib/haptics', () => {
  beforeEach(() => {
    mockPlatform.OS = 'ios';
    reduceHaptics = false;
    jest.clearAllMocks();
  });

  describe('guards', () => {
    it('reports support on ios and android only', () => {
      expect(isHapticsSupported()).toBe(true);
      mockPlatform.OS = 'android';
      expect(isHapticsSupported()).toBe(true);
      mockPlatform.OS = 'web';
      expect(isHapticsSupported()).toBe(false);
    });

    it('reflects the reduce-haptics preference', () => {
      expect(areHapticsEnabled()).toBe(true);
      reduceHaptics = true;
      expect(areHapticsEnabled()).toBe(false);
    });

    it('no-ops on web without calling native', () => {
      mockPlatform.OS = 'web';
      haptics.press();
      haptics.success();
      expect(mockImpactAsync).not.toHaveBeenCalled();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
    });

    it('no-ops when the user has reduced haptics', () => {
      reduceHaptics = true;
      haptics.press();
      haptics.error();
      expect(mockImpactAsync).not.toHaveBeenCalled();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('presets', () => {
    it('maps impact presets to the right styles', async () => {
      await impactAsync('light');
      await impactAsync('medium');
      await impactAsync('heavy');
      expect(mockImpactAsync).toHaveBeenNthCalledWith(1, 'Light');
      expect(mockImpactAsync).toHaveBeenNthCalledWith(2, 'Medium');
      expect(mockImpactAsync).toHaveBeenNthCalledWith(3, 'Heavy');
    });

    it('maps notification presets to the right types', async () => {
      await notificationAsync('success');
      await notificationAsync('warning');
      await notificationAsync('error');
      expect(mockNotificationAsync).toHaveBeenNthCalledWith(1, 'Success');
      expect(mockNotificationAsync).toHaveBeenNthCalledWith(2, 'Warning');
      expect(mockNotificationAsync).toHaveBeenNthCalledWith(3, 'Error');
    });

    it('routes named interaction presets', async () => {
      await haptics.press();
      expect(mockImpactAsync).toHaveBeenLastCalledWith('Light');

      await haptics.longPress();
      expect(mockImpactAsync).toHaveBeenLastCalledWith('Heavy');

      await haptics.confirm();
      expect(mockImpactAsync).toHaveBeenLastCalledWith('Medium');

      await haptics.toggle();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(1);

      await haptics.success();
      expect(mockNotificationAsync).toHaveBeenLastCalledWith('Success');

      await haptics.error();
      expect(mockNotificationAsync).toHaveBeenLastCalledWith('Error');

      await trigger('warning');
      expect(mockNotificationAsync).toHaveBeenLastCalledWith('Warning');

      await trigger('cancel');
      expect(mockImpactAsync).toHaveBeenLastCalledWith('Light');
    });
  });

  it('swallows native errors so interactions never crash', async () => {
    mockImpactAsync.mockRejectedValueOnce(new Error('no haptic engine'));
    await expect(haptics.press()).resolves.toBeUndefined();
    expect(mockImpactAsync).toHaveBeenCalled();
  });

  it('keeps the legacy HapticFeedback shim working', async () => {
    const { HapticFeedback } = require('../../src/utils/haptic');
    HapticFeedback.success();
    await flush();
    expect(mockNotificationAsync).toHaveBeenCalledWith('Success');
  });
});
