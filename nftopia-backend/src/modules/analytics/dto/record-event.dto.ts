import { Type } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Matches nftopia-frontend's `EnrichedTelemetryEvent.context` shape
 * (lib/telemetry/context/types.ts) field-for-field — note this is
 * snake_case on the wire (the frontend's actual output), not the
 * camelCase `AnalyticsEventContext` Mongoose schema class it gets mapped
 * to before persisting (see AnalyticsIngestionController). This is the
 * "future ingestion endpoint" analytics-event.schema.ts's docstring
 * anticipated when the collection was first provisioned (#531), finally
 * added here as part of #662 so the funnel dashboard has real data to read.
 */
class AnalyticsEventContextDto {
  @IsString()
  timestamp: string;

  @IsString()
  @MaxLength(500)
  route: string;

  @IsString()
  @MaxLength(10)
  locale: string;

  @IsString()
  @MaxLength(100)
  session_id: string;

  @IsString()
  @IsIn(['desktop', 'tablet', 'mobile', 'unknown'])
  device_type: string;

  @IsString()
  @MaxLength(50)
  app_surface: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  anonymous_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  user_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer_route?: string;
}

export class RecordEventDto {
  @IsString()
  @MaxLength(100)
  eventName: string;

  @ValidateNested()
  @Type(() => AnalyticsEventContextDto)
  context: AnalyticsEventContextDto;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
