import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorThrottleService } from './two-factor-throttle.service';
import { AuthModule } from './auth.module';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => AuthModule)],
  controllers: [TwoFactorController],
  providers: [TwoFactorService, TwoFactorThrottleService],
  exports: [TwoFactorService, TwoFactorThrottleService],
})
export class TwoFactorModule {}
