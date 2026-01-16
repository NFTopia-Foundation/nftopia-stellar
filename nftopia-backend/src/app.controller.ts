import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import metricsHandler from './metrics/queue_metrics';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/metrics')
  async getMetrics(@Res() res: Response) {
    await metricsHandler(null, res);
  }
}
