import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AnalyticsEventService } from './analytics-event.service';
import { RecordEventDto } from './dto/record-event.dto';

/**
 * Public telemetry ingestion (#662) — the endpoint
 * analytics-event.schema.ts's docstring anticipated when the collection was
 * first provisioned (#531), but which never existed until now. Intentionally
 * unauthenticated (anonymous session telemetry, same trust model as any
 * client-side analytics SDK) and protected only by the app-wide
 * RedisRateGuard, same as every other REST route.
 */
@Controller('analytics')
export class AnalyticsIngestionController {
  constructor(private readonly analyticsEventService: AnalyticsEventService) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async record(@Body() dto: RecordEventDto): Promise<{ success: true }> {
    await this.analyticsEventService.record({
      eventName: dto.eventName,
      // The wire format is snake_case (the frontend's actual
      // EnrichedTelemetryEvent.context shape) — map it onto the Mongoose
      // schema's camelCase fields here, once, rather than at every caller.
      context: {
        timestamp: dto.context.timestamp,
        route: dto.context.route,
        locale: dto.context.locale,
        sessionId: dto.context.session_id,
        deviceType: dto.context.device_type,
        appSurface: dto.context.app_surface,
        anonymousId: dto.context.anonymous_id,
        userId: dto.context.user_id,
        referrerRoute: dto.context.referrer_route,
      },
      payload: dto.payload,
    });
    return { success: true };
  }
}
