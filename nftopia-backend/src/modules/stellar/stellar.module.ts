import { Module } from '@nestjs/common';
import { SorobanRpcService } from '../../services/soroban-rpc.service';
import { SorobanService } from './soroban.service';
import { MarketplaceSettlementClient } from './marketplace-settlement.client';
import { TransactionContractClient } from './transaction-contract.client';

@Module({
  providers: [
    SorobanService,
    MarketplaceSettlementClient,
    SorobanRpcService,
    TransactionContractClient,
  ],
  exports: [
    SorobanService,
    MarketplaceSettlementClient,
    TransactionContractClient,
  ],
})
export class StellarModule {}
