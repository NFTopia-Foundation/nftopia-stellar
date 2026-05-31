import { ConfigService } from '@nestjs/config';

export const DEFAULT_WEBSOCKET_MAX_MESSAGE_SIZE_BYTES = 64 * 1024; // 64KB

export interface NotificationsConfig {
  websocket: {
    maxMessageSizeBytes: number;
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
  },
});
