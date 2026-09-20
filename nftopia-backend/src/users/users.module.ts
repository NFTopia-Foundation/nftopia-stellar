import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity'; // Point to the entity file
import { UserWallet } from '../auth/entities/user-wallet.entity';
import { WalletSession } from '../auth/entities/wallet-session.entity';
import { UserFollow } from './user-follow.entity';
import { UserFollowService } from './user-follow.service';
import { Listing } from '../modules/listing/entities/listing.entity';
import { Offer } from '../modules/offer/entities/offer.entity';
import { EmailModule } from '../modules/email/email.module';
import { DataExportJob } from './entities/data-export-job.entity';
import { AccountDeletionRequest } from './entities/account-deletion-request.entity';
import { GdprAuditLog } from './entities/gdpr-audit-log.entity';
import { GdprAuditService } from './gdpr-audit.service';
import { GdprExportService } from './gdpr-export.service';
import { AccountDeletionService } from './account-deletion.service';
import { DataExportProcessor } from './data-export.processor';
import { AccountDeletionScheduler } from './account-deletion.scheduler';
import { DATA_EXPORT_QUEUE } from './gdpr.constants';

@Module({
  imports: [
    EventEmitterModule,
    EmailModule,
    BullModule.registerQueue({ name: DATA_EXPORT_QUEUE }),
    TypeOrmModule.forFeature([
      User,
      UserWallet,
      WalletSession,
      UserFollow,
      Listing,
      Offer,
      DataExportJob,
      AccountDeletionRequest,
      GdprAuditLog,
    ]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserFollowService,
    GdprAuditService,
    GdprExportService,
    AccountDeletionService,
    DataExportProcessor,
    AccountDeletionScheduler,
  ],
  exports: [UsersService, UserFollowService],
})
export class UsersModule {}
