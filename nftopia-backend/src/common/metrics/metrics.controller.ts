import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import { PrometheusService } from './prometheus';
import type { Request, Response } from 'express';

@Controller('metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MetricsController {
  constructor(private readonly prometheusService: PrometheusService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async getMetrics(@Req() req: Request, @Res() res: Response) {
    if (req.query.token !== process.env.METRICS_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const metrics = await this.prometheusService.getMetrics();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.send(metrics);
  }
}
