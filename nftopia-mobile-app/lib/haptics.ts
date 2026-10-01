import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePreferencesStore } from '@/stores/preferencesStore';

export type HapticImpactStyle = 'light' | 'medium' | 'heavy';
export type HapticNotificationType = 'success' | 'warning' | 'error';
export type HapticStyle = HapticImpactStyle | HapticNotificationType;

const IMPACT_STYLE_MAP: Record<HapticImpactStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

const NOTIFICATION_TYPE_MAP: Record<HapticNotificationType, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

/** expo-haptics has no native haptic engine on web — everything else (iOS/Android) has one, even if a specific device lacks vibration hardware (guarded by the try/catch in `fire` below). */
function isPlatformSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function isUserEnabled(): boolean {
  return !usePreferencesStore.getState().reduceHaptics;
}

/**
 * Fires a haptic call, but only after the platform-capability and user
 * "Reduce haptics" (#467) guards both pass, and never lets a haptic-engine
 * failure (e.g. a device with no vibration motor) surface to the caller —
 * a haptic is always best-effort, decorative feedback, never load-bearing.
 */
function fire(trigger: () => Promise<void>): void {
  if (!isPlatformSupported() || !isUserEnabled()) return;
  trigger().catch(() => {
    // Best-effort — swallow.
  });
}

function impact(style: HapticImpactStyle): void {
  fire(() => Haptics.impactAsync(IMPACT_STYLE_MAP[style]));
}

function notification(type: HapticNotificationType): void {
  fire(() => Haptics.notificationAsync(NOTIFICATION_TYPE_MAP[type]));
}

function selection(): void {
  fire(() => Haptics.selectionAsync());
}

function trigger(style: HapticStyle): void {
  if (style === 'light' || style === 'medium' || style === 'heavy') {
    impact(style);
  } else {
    notification(style);
  }
}

/**
 * Haptic pattern-to-interaction mapping (#467) — see docs/haptics.md for
 * the full rationale and examples. Call sites should reach for a semantic
 * preset below (tap, toggleOn, success, ...) rather than impact()/
 * notification() directly, so the same kind of interaction always feels
 * the same everywhere it happens:
 *
 * - tap        — a light, low-commitment press (secondary buttons, list
 *                items, Cancel).
 * - tapStrong  — a more deliberate press (primary CTAs, Confirm).
 * - heavy      — a destructive or heavy-commitment action (long-press to
 *                delete).
 * - toggleOn / toggleOff — enabling/disabling a switch or favorite.
 * - select     — one discrete step through a picker/selector list.
 * - success / warning / error — the *outcome* of an action (a transaction
 *                completed, a recoverable problem, a validation failure or
 *                failed transaction) — not the tap that started it.
 */
export const haptics = {
  impact,
  notification,
  selection,
  trigger,

  tap: () => impact('light'),
  tapStrong: () => impact('medium'),
  heavy: () => impact('heavy'),
  toggleOn: () => impact('medium'),
  toggleOff: () => impact('light'),
  select: () => selection(),
  success: () => notification('success'),
  warning: () => notification('warning'),
  error: () => notification('error'),
};
