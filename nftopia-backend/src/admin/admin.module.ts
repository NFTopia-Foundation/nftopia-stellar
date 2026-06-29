import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/user.entity';
import { Collection } from '../modules/collection/entities/collection.entity';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Collection]),
    AuditModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
