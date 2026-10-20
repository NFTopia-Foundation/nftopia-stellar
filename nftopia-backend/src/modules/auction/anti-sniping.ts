import { ConfigService } from '@nestjs/config';
import { Auction } from './entities/auction.entity';

export function extendAuctionForLastMinuteBid(
  auction: Auction,
  configService: ConfigService,
  now = Date.now(),
): boolean {
  const windowSeconds = getSetting(
    configService,
    'AUCTION_ANTI_SNIPE_WINDOW_SECONDS',
    300,
  );
  const extensionSeconds = getSetting(
    configService,
    'AUCTION_ANTI_SNIPE_EXTENSION_SECONDS',
    300,
  );
  const maxExtensions = getSetting(
    configService,
    'AUCTION_ANTI_SNIPE_MAX_EXTENSIONS',
    3,
    true,
  );
  const remainingMs = new Date(auction.endTime).getTime() - now;

  if (
    windowSeconds === 0 ||
    remainingMs <= 0 ||
    remainingMs > windowSeconds * 1000 ||
    (auction.extensionCount ?? 0) >= maxExtensions
  ) {
    return false;
  }

  auction.endTime = new Date(
    new Date(auction.endTime).getTime() + extensionSeconds * 1000,
  );
  auction.extensionCount = (auction.extensionCount ?? 0) + 1;
  return true;
}

function getSetting(
  configService: ConfigService,
  key: string,
  fallback: number,
  allowZero = false,
): number {
  const value = Number(configService.get<number | string>(key) ?? fallback);
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(
      `${key} must be a ${allowZero ? 'non-negative' : 'positive'} integer`,
    );
  }
  return value;
}
