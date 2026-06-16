import { Module } from '@nestjs/common';
import { MigrationLockService } from './migration-lock.service';

@Module({
  providers: [MigrationLockService],
})
export class DatabaseModule {}
