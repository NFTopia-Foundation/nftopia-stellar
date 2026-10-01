import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

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
