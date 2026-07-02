import { Module } from '@nestjs/common';
import { SorobanRpcService } from '../../services/soroban-rpc.service';
import { SorobanService } from './soroban.service';
import { MarketplaceSettlementClient } from './marketplace-settlement.client';

@Module({
  providers: [SorobanService, MarketplaceSettlementClient, SorobanRpcService],
  exports: [SorobanService, MarketplaceSettlementClient],
})
export class StellarModule {}
