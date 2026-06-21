import { ConfigService } from '@nestjs/config';

export const DEFAULT_WEBSOCKET_MAX_MESSAGE_SIZE_BYTES = 64 * 1024; // 64KB
export const DEFAULT_PING_INTERVAL_MS = 25_000; // 25 s
export const DEFAULT_PING_TIMEOUT_MS = 30_000; // 30 s
export const DEFAULT_STALE_THRESHOLD_MS = 60_000; // 60 s

export interface NotificationsConfig {
  websocket: {
    maxMessageSizeBytes: number;
    pingIntervalMs: number;
    pingTimeoutMs: number;
    staleThresholdMs: number;
  };
}

const toNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export const getNotificationsConfig = (
  configService: ConfigService,
): NotificationsConfig => ({
  websocket: {
    maxMessageSizeBytes: toNumber(
      configService.get<string>('WEBSOCKET_MAX_MESSAGE_SIZE_BYTES'),
      DEFAULT_WEBSOCKET_MAX_MESSAGE_SIZE_BYTES,
    ),
    pingIntervalMs: toNumber(
      configService.get<string>('WS_PING_INTERVAL_MS'),
      DEFAULT_PING_INTERVAL_MS,
    ),
    pingTimeoutMs: toNumber(
      configService.get<string>('WS_PING_TIMEOUT_MS'),
      DEFAULT_PING_TIMEOUT_MS,
    ),
    staleThresholdMs: toNumber(
      configService.get<string>('WS_STALE_THRESHOLD_MS'),
      DEFAULT_STALE_THRESHOLD_MS,
    ),
  },
});
