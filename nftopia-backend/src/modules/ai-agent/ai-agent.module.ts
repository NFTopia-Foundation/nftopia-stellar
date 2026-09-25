import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { NftModule } from '../nft/nft.module';
import { ListingModule } from '../listing/listing.module';
import { CollectionModule } from '../collection/collection.module';
import { OrderModule } from '../order/order.module';
import { AuctionModule } from '../auction/auction.module';
import { AiAgentService } from './ai-agent.service';
import { AiAgentController } from './ai-agent.controller';
import { AiUsageService } from './ai-usage.service';
import { AiAgentHealthService } from './ai-agent-health.service';
import { ChatSessionService } from './chat-session.service';
import { AiUsageRecord } from './entities/ai-usage-record.entity';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ContentFlag } from './entities/content-flag.entity';
import { AiToolCallLog } from './entities/ai-tool-call-log.entity';
import { AiChatRateLimitGuard } from '../../common/guards/ai-chat-rate-limit.guard';
import { aiChatRateLimiterProvider } from '../../common/guards/ai-chat-rate-limiter.provider';
import { ListingCreatedListener } from './listeners/listing-created.listener';
import { AI_MODERATION_QUEUE_NAME } from './listeners/ai-moderation.types';
import { ContentFlagService } from './content-flag.service';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      AiUsageRecord,
      ChatSession,
      ChatMessage,
      ContentFlag,
      AiToolCallLog,
    ]),
    BullModule.registerQueue({ name: AI_MODERATION_QUEUE_NAME }),
    AuditModule,
    NftModule,
    ListingModule,
    CollectionModule,
    OrderModule,
    AuctionModule,
  ],
  providers: [
    AiAgentService,
    AiUsageService,
    AiAgentHealthService,
    ChatSessionService,
    AiChatRateLimitGuard,
    aiChatRateLimiterProvider,
    ListingCreatedListener,
    ContentFlagService,
  ],
  controllers: [AiAgentController],
  exports: [AiAgentService, AiUsageService],
})
export class AiAgentModule {}
