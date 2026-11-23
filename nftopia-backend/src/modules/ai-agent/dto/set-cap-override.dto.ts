import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Hard ceiling on an admin-set per-user chat rate budget — a guard against typos (e.g. an extra zero). */
export const MAX_RATE_LIMIT_POINTS_OVERRIDE = 10_000;

/**
 * Per-tool-set AI chat request-rate overrides (#751). Each value is the
 * number of chat requests the user may make within one
 * AI_CHAT_RATE_LIMIT_TTL window for that tool set. Omitted tool sets keep
 * the env-configured default.
 */
export class RateLimitPointsOverrideDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(MAX_RATE_LIMIT_POINTS_OVERRIDE)
  'marketplace-assistant'?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(MAX_RATE_LIMIT_POINTS_OVERRIDE)
  'creator-copilot'?: number;
}

/**
 * Admin request body to set (or replace) a user's AI chat cap override
 * (#529). Every field is optional — an omitted field falls back to the
 * env-configured default for that specific cap, so an admin can raise just
 * the daily token cap without having to also restate the monthly one.
 */
export class SetCapOverrideDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  dailyTokenCap?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  monthlyTokenCap?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  dailySpendCapUsd?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  monthlySpendCapUsd?: number;

  /**
   * Optional per-tool-set chat rate-limit budgets (#751), e.g.
   * `{ "marketplace-assistant": 60 }`. Omit to keep the env defaults.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => RateLimitPointsOverrideDto)
  rateLimitPoints?: RateLimitPointsOverrideDto;

  /** Why this override was granted — shown back via GET so a later admin has context. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** ISO date-time. Omit for an override that lasts until an admin explicitly clears it. */
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
