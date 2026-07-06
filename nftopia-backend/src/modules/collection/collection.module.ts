import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/user.entity';
import { Nft } from '../nft/entities/nft.entity';
import { CollectionService } from './collection.service';
import { Collection } from './entities/collection.entity';
import { VerificationRequest } from './entities/verification-request.entity';
import { CollectionStats } from './entities/collection-stats.entity';
import { AnalyticsService } from './analytics.service';
import { CollectionAnalyticsController } from './collection-analytics.controller';
import { AnalyticsCronJob } from './analytics-cron.job';
import { CollectionController } from './collection.controller';
import { Order } from '../order/entities/order.entity';
import { CollectionLike } from './entities/collection-like.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Collection,
      CollectionStats,
      Order,
      Nft,
      User,
      VerificationRequest,
      CollectionLike,
    ]),
  ],
  providers: [CollectionService, AnalyticsService, AnalyticsCronJob],
  controllers: [CollectionController, CollectionAnalyticsController],
  exports: [CollectionService, AnalyticsService],
})
export class CollectionModule {}
