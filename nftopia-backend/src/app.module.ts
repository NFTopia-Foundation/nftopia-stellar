import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import * as redisStore from 'cache-manager-redis-store';

import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Environment variables
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Global Redis cache
    CacheModule.register({
      isGlobal: true,
      store: redisStore as any,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      ttl: parseInt(process.env.CACHE_TTL || '300', 10),
    }),

    AuthModule,

    // Disable DB & UsersModule in tests
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
          TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              type: 'postgres',
              url: config.get<string>('DATABASE_URL'),
              autoLoadEntities: true,
              synchronize: false,
            }),
          }),
          UsersModule,
        ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
