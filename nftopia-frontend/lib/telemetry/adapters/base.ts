export interface TelemetryAdapter {
  init(): Promise<void> | void;
  track(eventName: string, payload?: Record<string, unknown>): Promise<void> | void;
  identify(userId: string, traits?: Record<string, unknown>): Promise<void> | void;
  reset(): Promise<void> | void;
}
