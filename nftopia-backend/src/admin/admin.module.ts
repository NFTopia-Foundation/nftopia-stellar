import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/user.entity';
import { Collection } from '../collections/collection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Collection])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
