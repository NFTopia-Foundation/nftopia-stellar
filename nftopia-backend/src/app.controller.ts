import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
