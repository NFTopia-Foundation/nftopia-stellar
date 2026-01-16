import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { NFT } from '../nfts/entities/nft.entity';
import { User } from '../users/entities/user.entity';
import { Auction } from '../auctions/entities/auction.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { NftStorageService } from '../nftstorage/nftstorage.service';
import { NftStorageModule } from '../nftstorage/nftstorage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, NFT, User, Auction]),
    NftStorageModule
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, NftStorageService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
