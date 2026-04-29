import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({
    status: 200,
    description: 'Process is up',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-22T12:00:00.000Z' },
      },
    },
  })
  async getLive() {
    return this.healthService.checkLive();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({
    status: 200,
    description: 'Services are ready',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        details: {
          type: 'object',
          properties: {
            postgres: { type: 'string', example: 'up' },
            redis: { type: 'string', example: 'up' },
          },
        },
        timestamp: { type: 'string', example: '2024-01-22T12:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more services are unhealthy',
  })
  async getReady() {
    const health = await this.healthService.checkReady();
    if (health.status === 'ok') {
      return health;
    } else {
      throw new ServiceUnavailableException(health);
    }
  }
}
