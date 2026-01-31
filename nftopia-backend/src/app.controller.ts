import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-22T12:00:00.000Z' },
      },
    },
  })
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }

  @Get('/cache-test')
  async testCache(): Promise<{
    message: string;
    cacheHit: boolean;
    cachedValue: any;
    timestamp: string;
  }> {
    return this.appService.testCache();
  }
}
