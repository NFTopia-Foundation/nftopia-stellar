import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity'; // Point to the entity file
import { UserWallet } from '../auth/entities/user-wallet.entity';
import { UserFollow } from './user-follow.entity';
import { UserFollowService } from './user-follow.service';

@Module({
  imports: [
    EventEmitterModule,
    TypeOrmModule.forFeature([User, UserWallet, UserFollow]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UserFollowService],
  exports: [UsersService, UserFollowService],
})
export class UsersModule {}
