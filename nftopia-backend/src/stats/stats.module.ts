// src/stats/stats.module.ts

import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NFT } from '../nfts/entities/nft.entity';
import { User } from '../users/entities/user.entity';
import { Collection } from '../collections/entities/collection.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NFT, User, Collection, Transaction]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
