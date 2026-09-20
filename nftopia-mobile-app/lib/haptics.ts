import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePreferencesStore } from '@/stores/preferencesStore';

/**
 * Centralized haptic feedback.
 *
 * All haptic calls in the app should go through this module rather than
 * importing `expo-haptics` directly. It provides:
 *
 *  - named presets mapped to interaction types (see `HapticPreset` and
 *    `docs/HAPTICS.md` for the full mapping),
 *  - a platform/capability guard that safely no-ops on unsupported platforms
 *    (web, and any device without a haptic engine),
 *  - respect for the user's "Reduce haptics" accessibility preference.
 *
 * Calls are fire-and-forget: every helper swallows native errors so a missing
 * haptic engine can never crash or warn during a user interaction.
 */
export type ImpactStyle = 'light' | 'medium' | 'heavy';
export type NotificationType = 'success' | 'warning' | 'error';

/**
 * Presets named after the interaction they represent. Prefer these over the
 * lower-level `impactAsync`/`notificationAsync` helpers so feedback stays
 * consistent across similar interactions.
 */
export type HapticPreset =
  | 'press'
  | 'longPress'
  | 'toggle'
  | 'select'
  | 'confirm'
  | 'cancel'
  | 'success'
  | 'warning'
  | 'error';

const IMPACT_STYLES: Record<ImpactStyle, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

const NOTIFICATION_TYPES: Record<NotificationType, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

/** True only on platforms that have a haptic engine wired up. */
export function isHapticsSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Reads the user's "Reduce haptics" preference. Falls back to enabled if the
 * store is unavailable (e.g. before hydration or in isolation).
 */
export function areHapticsEnabled(): boolean {
  try {
    return !usePreferencesStore.getState().reduceHaptics;
  } catch {
    return true;
  }
}

function canFire(): boolean {
  return isHapticsSupported() && areHapticsEnabled();
}

export async function impactAsync(style: ImpactStyle = 'light'): Promise<void> {
  if (!canFire()) return;
  try {
    await Haptics.impactAsync(IMPACT_STYLES[style]);
  } catch {
    // Haptics are best-effort; ignore unsupported hardware/OS failures.
  }
}

export async function notificationAsync(type: NotificationType): Promise<void> {
  if (!canFire()) return;
  try {
    await Haptics.notificationAsync(NOTIFICATION_TYPES[type]);
  } catch {
    // Best-effort.
  }
}

export async function selectionAsync(): Promise<void> {
  if (!canFire()) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Best-effort.
  }
}

const PRESETS: Record<HapticPreset, () => Promise<void>> = {
  press: () => impactAsync('light'),
  longPress: () => impactAsync('heavy'),
  toggle: () => selectionAsync(),
  select: () => selectionAsync(),
  confirm: () => impactAsync('medium'),
  cancel: () => impactAsync('light'),
  success: () => notificationAsync('success'),
  warning: () => notificationAsync('warning'),
  error: () => notificationAsync('error'),
};

/** Fire the preset associated with an interaction type. */
export function trigger(preset: HapticPreset): Promise<void> {
  return PRESETS[preset]();
}

export const haptics = {
  // Interaction presets
  press: () => PRESETS.press(),
  longPress: () => PRESETS.longPress(),
  toggle: () => PRESETS.toggle(),
  select: () => PRESETS.select(),
  confirm: () => PRESETS.confirm(),
  cancel: () => PRESETS.cancel(),
  success: () => PRESETS.success(),
  warning: () => PRESETS.warning(),
  error: () => PRESETS.error(),
  // Escape hatches
  trigger,
  impact: impactAsync,
  notification: notificationAsync,
  selection: selectionAsync,
};

export default haptics;
