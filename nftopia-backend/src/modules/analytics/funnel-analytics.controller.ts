import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AnalyticsEventService } from './analytics-event.service';
import { FunnelSummaryQueryDto } from './dto/funnel-summary-query.dto';

const FUNNEL_STAGE_ENTERED_EVENT = 'funnel_stage_entered';
const MAX_RANGE_DAYS = 90;

/**
 * Internal-only funnel drop-off summary (#662), consumed by
 * nftopia-frontend's /internal/funnel-dashboard page. Admin-gated — this is
 * the real access boundary; the frontend route's own gate is UX only.
 */
@Controller('analytics/funnel')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FunnelAnalyticsController {
  constructor(private readonly analyticsEventService: AnalyticsEventService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN)
  async getSummary(@Query() query: FunnelSummaryQueryDto): Promise<{
    from: string;
    to: string;
    sessionsByStage: Record<string, number>;
  }> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (from > to) {
      throw new BadRequestException('"from" must not be after "to"');
    }
    const rangeDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (rangeDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
      );
    }

    const sessionsByStage =
      await this.analyticsEventService.countDistinctSessionsByStage(
        FUNNEL_STAGE_ENTERED_EVENT,
        from,
        to,
      );

    return { from: query.from, to: query.to, sessionsByStage };
  }
}
