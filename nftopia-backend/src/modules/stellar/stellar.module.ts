import { Module } from '@nestjs/common';
import { SorobanService } from './soroban.service';
import { MarketplaceSettlementClient } from './marketplace-settlement.client';

@Module({
  providers: [SorobanService, MarketplaceSettlementClient],
  exports: [SorobanService, MarketplaceSettlementClient],
})
export class StellarModule {}
