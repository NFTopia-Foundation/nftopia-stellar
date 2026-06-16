import { ConfigService } from '@nestjs/config';

export const DEFAULT_WEBSOCKET_MAX_MESSAGE_SIZE_BYTES = 64 * 1024; // 64KB
export const DEFAULT_WS_PING_INTERVAL_MS = 25_000;
export const DEFAULT_WS_PING_TIMEOUT_MS = 10_000;
export const DEFAULT_WS_STALE_CLEANUP_INTERVAL_MS = 60_000;

export interface NotificationsConfig {
  websocket: {
    maxMessageSizeBytes: number;
    pingIntervalMs: number;
    pingTimeoutMs: number;
    staleCleanupIntervalMs: number;
  };
}

const toNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) {
    return defaultValue;
  }

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
      configService.get<string>('WEBSOCKET_PING_INTERVAL_MS'),
      DEFAULT_WS_PING_INTERVAL_MS,
    ),
    pingTimeoutMs: toNumber(
      configService.get<string>('WEBSOCKET_PING_TIMEOUT_MS'),
      DEFAULT_WS_PING_TIMEOUT_MS,
    ),
    staleCleanupIntervalMs: toNumber(
      configService.get<string>('WEBSOCKET_STALE_CLEANUP_INTERVAL_MS'),
      DEFAULT_WS_STALE_CLEANUP_INTERVAL_MS,
    ),
  },
});
