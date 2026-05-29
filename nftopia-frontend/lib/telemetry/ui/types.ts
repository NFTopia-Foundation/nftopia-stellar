// UI Telemetry Event Types and Enums

export enum DeviceType {
  Desktop = "desktop",
  Tablet = "tablet",
  Mobile = "mobile",
}

export enum LayoutVariant {
  Desktop = "desktop",
  Tablet = "tablet",
  Mobile = "mobile",
}

export enum ViewportPosition {
  AboveFold = "above_fold",
  BelowFold = "below_fold",
}

export type UIElementViewedPayload = {
  element: string;
  visibilityPercent: number;
  position: ViewportPosition;
  deviceType: DeviceType;
  timestamp: number;
};

export type UIElementInteractedPayload = {
  element: string;
  interactionType: "click" | "hover" | "focus";
  timeToInteractionMs: number;
  deviceType: DeviceType;
  timestamp: number;
};

export type FormFieldInteractionPayload = {
  form: string;
  field: string;
  keystrokeCount: number;
  validationErrors: number;
  timeInFieldMs: number;
  deviceType: DeviceType;
  timestamp: number;
};

export type FormSubmissionAttemptPayload = {
  form: string;
  fieldCount: number;
  validationErrors: number;
  deviceType: DeviceType;
  submissionId: string;
  timestamp: number;
};

export type FormSubmissionSuccessPayload = {
  form: string;
  submissionId: string;
  latencyMs: number;
  attemptCount: number;
  deviceType: DeviceType;
  timestamp: number;
};

export type ScrollDepthTrackedPayload = {
  milestone: 25 | 50 | 75 | 100;
  elementsPassed: string[];
  deviceType: DeviceType;
  timestamp: number;
};

export type LayoutVariantRenderedPayload = {
  variant: LayoutVariant;
  breakpoint: number;
  renderTimeMs: number;
  deviceType: DeviceType;
  timestamp: number;
};

export type AccessibilityInteractionPayload = {
  interaction: "keyboard_nav" | "focus_move";
  direction: "forward" | "backward" | "up" | "down";
  elementBefore: string;
  elementAfter: string;
  deviceType: DeviceType;
  timestamp: number;
};

export type ProgressiveDisclosureActionPayload = {
  element: string;
  action: "expand" | "collapse";
  timeInStateMs: number;
  deviceType: DeviceType;
  timestamp: number;
};

export type MobileGestureInteractionPayload = {
  gesture: "swipe" | "pinch";
  velocity: number;
  completed: boolean;
  deviceType: DeviceType;
  timestamp: number;
};
