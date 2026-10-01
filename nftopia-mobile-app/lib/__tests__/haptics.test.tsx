import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { haptics } from '@/lib/haptics';
import { usePreferencesStore } from '@/stores/preferencesStore';

const impactAsync = Haptics.impactAsync as jest.Mock;
const notificationAsync = Haptics.notificationAsync as jest.Mock;
const selectionAsync = Haptics.selectionAsync as jest.Mock;

describe('haptics (#467)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'ios';
    usePreferencesStore.getState().setReduceHaptics(false);
  });

  describe('presets', () => {
    it('tap fires a light impact', () => {
      haptics.tap();
      expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('tapStrong fires a medium impact', () => {
      haptics.tapStrong();
      expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    });

    it('heavy fires a heavy impact', () => {
      haptics.heavy();
      expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
    });

    it('toggleOn fires a medium impact', () => {
      haptics.toggleOn();
      expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    });

    it('toggleOff fires a light impact', () => {
      haptics.toggleOff();
      expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('select fires a selection haptic', () => {
      haptics.select();
      expect(selectionAsync).toHaveBeenCalledTimes(1);
    });

    it('success fires a success notification', () => {
      haptics.success();
      expect(notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    });

    it('warning fires a warning notification', () => {
      haptics.warning();
      expect(notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
    });

    it('error fires an error notification', () => {
      haptics.error();
      expect(notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    });
  });

  describe('trigger', () => {
    it('dispatches impact styles to impactAsync', () => {
      haptics.trigger('light');
      haptics.trigger('medium');
      haptics.trigger('heavy');
      expect(impactAsync).toHaveBeenCalledTimes(3);
      expect(notificationAsync).not.toHaveBeenCalled();
    });

    it('dispatches notification styles to notificationAsync', () => {
      haptics.trigger('success');
      haptics.trigger('warning');
      haptics.trigger('error');
      expect(notificationAsync).toHaveBeenCalledTimes(3);
      expect(impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('platform guard', () => {
    it('no-ops on web', () => {
      (Platform as { OS: string }).OS = 'web';
      haptics.tap();
      haptics.success();
      haptics.select();
      expect(impactAsync).not.toHaveBeenCalled();
      expect(notificationAsync).not.toHaveBeenCalled();
      expect(selectionAsync).not.toHaveBeenCalled();
    });

    it('fires on ios and android', () => {
      (Platform as { OS: string }).OS = 'android';
      haptics.tap();
      expect(impactAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('"Reduce haptics" preference guard', () => {
    it('no-ops when the user has enabled reduceHaptics', () => {
      usePreferencesStore.getState().setReduceHaptics(true);
      haptics.tap();
      haptics.success();
      expect(impactAsync).not.toHaveBeenCalled();
      expect(notificationAsync).not.toHaveBeenCalled();
    });

    it('fires again once reduceHaptics is turned back off', () => {
      usePreferencesStore.getState().setReduceHaptics(true);
      haptics.tap();
      usePreferencesStore.getState().setReduceHaptics(false);
      haptics.tap();
      expect(impactAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure resilience', () => {
    it('never throws or rejects when the native call fails', async () => {
      impactAsync.mockRejectedValueOnce(new Error('no haptic engine'));
      expect(() => haptics.tap()).not.toThrow();
      // Flush the swallowed promise rejection.
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
