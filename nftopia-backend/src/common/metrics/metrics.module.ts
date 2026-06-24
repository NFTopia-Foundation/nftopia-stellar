import { Global, Module } from '@nestjs/common';
import { PrometheusService } from './prometheus';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  providers: [PrometheusService],
  exports: [PrometheusService],
  controllers: [MetricsController],
})
export class MetricsModule {}