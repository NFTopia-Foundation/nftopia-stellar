import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity'; // Point to the entity file
import { UserWallet } from '../auth/entities/user-wallet.entity';
import { UserFollow } from './user-follow.entity';
import { UserFollowService } from './user-follow.service';
import { UserPrivacyProcessor } from './user-privacy.processor';
import { USER_PRIVACY_QUEUE } from './privacy-jobs';
import { EmailModule } from '../modules/email/email.module';

@Module({
  imports: [
    EventEmitterModule,
    BullModule.registerQueue({ name: USER_PRIVACY_QUEUE }),
    EmailModule,
    TypeOrmModule.forFeature([User, UserWallet, UserFollow]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UserFollowService, UserPrivacyProcessor],
  exports: [UsersService, UserFollowService],
})
export class UsersModule {}
