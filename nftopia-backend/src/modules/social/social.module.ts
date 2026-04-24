import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from './entities/follow.entity';
import { Activity } from './entities/activity.entity';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Follow, Activity])],
  providers: [SocialService],
  controllers: [SocialController],
  exports: [SocialService],
})
export class SocialModule {}
