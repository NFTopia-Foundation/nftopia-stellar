import { Module } from '@nestjs/common';
import { SorobanService } from './soroban.service';

@Module({
  providers: [SorobanService],
  exports: [SorobanService],
})
export class StellarModule {}
