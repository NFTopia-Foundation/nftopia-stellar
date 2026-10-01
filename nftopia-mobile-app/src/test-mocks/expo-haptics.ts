// expo-haptics ships raw TS source with no pre-built JS, and this repo's
// ts-jest transform intentionally excludes node_modules (see
// react-native.tsx's mock for why) — component tests that render anything
// calling into it (e.g. ConfirmationDialog's press feedback) get this
// no-op stand-in instead.
export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export const impactAsync = jest.fn().mockResolvedValue(undefined);
export const notificationAsync = jest.fn().mockResolvedValue(undefined);
export const selectionAsync = jest.fn().mockResolvedValue(undefined);
