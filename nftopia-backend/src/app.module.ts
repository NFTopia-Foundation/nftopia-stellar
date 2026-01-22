import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppService } from './app.service';

@Module({
  imports: [
    {
      ...ThrottlerModule.forRoot({
        ttl: 60,
        limit: 10,
      }),
    },
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
