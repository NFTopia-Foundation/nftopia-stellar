import { Module } from '@nestjs/common';
import { RedisIoAdapter } from './redis.adapter';

@Module({
  providers: [RedisIoAdapter],
  exports: [RedisIoAdapter],
})
export class RedisModule {}