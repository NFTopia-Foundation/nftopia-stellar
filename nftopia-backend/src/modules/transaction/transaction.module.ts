import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { TransactionContractClient } from '../stellar/transaction-contract.client';
import { StellarModule } from '../stellar/stellar.module';
import { Listing } from '../listing/entities/listing.entity';
import { Auction } from '../auction/entities/auction.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { Nft } from '../nft/entities/nft.entity';
import { StorageModule } from '../../storage/storage.module';
import { UsersModule } from '../../users/users.module';
import { NftModule } from '../nft/nft.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Listing, Auction, StellarNft, Nft]),
    StellarModule,
    StorageModule,
    UsersModule,
    NftModule,
  ],
  providers: [TransactionService, TransactionContractClient],
  controllers: [TransactionController],
  exports: [TransactionService],
})
export class TransactionModule {}
