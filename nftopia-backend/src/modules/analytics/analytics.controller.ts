import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';

@Controller('collections')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':id/stats')
  async getCollectionStats(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getCollectionStats(id, from, to);
  }
}
