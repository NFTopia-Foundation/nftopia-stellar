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
import { UserAiCapOverride } from './entities/user-ai-cap-override.entity';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ContentFlag } from './entities/content-flag.entity';
import { AiToolCallLog } from './entities/ai-tool-call-log.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { NftMetadata } from '../../nft/entities/nft-metadata.entity';
import { AiChatRateLimitGuard } from '../../common/guards/ai-chat-rate-limit.guard';
import { aiChatRateLimiterProvider } from '../../common/guards/ai-chat-rate-limiter.provider';
import { CopilotRateLimitGuard } from '../../common/guards/copilot-rate-limit.guard';
import { copilotRateLimiterProvider } from '../../common/guards/copilot-rate-limiter.provider';
import { ListingCreatedListener } from './listeners/listing-created.listener';
import { AI_MODERATION_QUEUE_NAME } from './listeners/ai-moderation.types';
import { ContentFlagService } from './content-flag.service';
import { AuditModule } from '../../common/audit/audit.module';
import { PromptInjectionService } from './prompt-injection.service';
import { AiModerationProcessor } from './ai-moderation.processor';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      AiUsageRecord,
      UserAiCapOverride,
      ChatSession,
      ChatMessage,
      ContentFlag,
      AiToolCallLog,
      // Listing content lives on the (legacy, top-level) StellarNft/
      // NftMetadata entities — the same ones ListingModule itself uses —
      // not the modules/nft Nft entity NftModule above provides. Needed
      // by AiModerationProcessor (#527) to fetch what it's moderating.
      StellarNft,
      NftMetadata,
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
    CopilotRateLimitGuard,
    copilotRateLimiterProvider,
    ListingCreatedListener,
    AiModerationProcessor,
    ContentFlagService,
    PromptInjectionService,
  ],
  controllers: [AiAgentController],
  exports: [AiAgentService, AiUsageService],
})
export class AiAgentModule {}
