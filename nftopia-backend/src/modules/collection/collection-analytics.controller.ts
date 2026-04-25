import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('collections')
export class CollectionAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':id/stats')
  async getStats(
    @Param('id') collectionId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getStatsForCollection(collectionId, from, to);
  }
}
