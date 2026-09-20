/**
 * @deprecated Use `@/lib/haptics` instead.
 *
 * This legacy wrapper predates the centralized haptics module and did not
 * respect the "Reduce haptics" preference or the platform capability guard.
 * It is kept as a thin compatibility shim so existing imports keep working.
 */
import { haptics, HapticPreset } from '@/lib/haptics';

export type HapticImpactStyle = 'light' | 'medium' | 'heavy';
export type HapticNotificationType = 'success' | 'warning' | 'error';
export type HapticSelectionType = 'selection';

const IMPACT_PRESETS: Record<HapticImpactStyle, HapticPreset> = {
  light: 'press',
  medium: 'confirm',
  heavy: 'longPress',
};

export class HapticFeedback {
  static impact(style: HapticImpactStyle = 'light'): void {
    haptics.impact(style);
  }

  static notification(type: HapticNotificationType): void {
    haptics.notification(type);
  }

  static selection(): void {
    haptics.selection();
  }

  static light(): void {
    this.impact('light');
  }

  static medium(): void {
    this.impact('medium');
  }

  static heavy(): void {
    this.impact('heavy');
  }

  static success(): void {
    this.notification('success');
  }

  static warning(): void {
    this.notification('warning');
  }

  static error(): void {
    this.notification('error');
  }

  static onPress(style: HapticImpactStyle = 'light'): void {
    haptics.trigger(IMPACT_PRESETS[style]);
  }

  static onLongPress(): void {
    haptics.longPress();
  }

  static onSuccess(): void {
    this.success();
  }

  static onError(): void {
    this.error();
  }
}
