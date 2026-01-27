import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
t
    {
      ...ThrottlerModule.forRoot({
        ttl: 60,
        limit: 10,
      }),
    },

    ...(process.env.NODE_ENV === 'test'
      ? []
      : [TypeOrmModule.forRoot(typeOrmConfig), UsersModule]),

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
