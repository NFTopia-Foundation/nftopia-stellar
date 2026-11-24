import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { TransactionRetryModule } from './transaction-retry.module';
import { StellarModule } from '../stellar/stellar.module';
import { ListingModule } from '../listing/listing.module';
import { AuctionModule } from '../auction/auction.module';
import { NftModule } from '../nft/nft.module';
import { StorageModule } from '../../storage/storage.module';
import { UsersModule } from '../../users/users.module';
import { AuditModule } from '../../common/audit/audit.module';
import { DistributedLockService } from '../../common/locks/distributed-lock.service';
import { TransactionReconciliationJob } from './transaction-reconciliation.job';
import { PrometheusService } from '../../common/metrics/prometheus';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    TransactionRetryModule,
    StellarModule,
    ListingModule,
    AuctionModule,
    NftModule,
    StorageModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    DistributedLockService,
    TransactionReconciliationJob,
    PrometheusService,
  ],
  exports: [
    TransactionService,
    DistributedLockService,
    TransactionReconciliationJob,
  ],
})
export class TransactionModule {}
