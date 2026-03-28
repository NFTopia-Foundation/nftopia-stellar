import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity'; // Point to the entity file
import { UserWallet } from '../auth/entities/user-wallet.entity';

@Module({
  imports: [EventEmitterModule, TypeOrmModule.forFeature([User, UserWallet])], // Registers the Repository
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Good practice to export if other modules need it
})
export class UsersModule {}
