import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NftModule } from './nft/nft.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: (await import('cache-manager-redis-store')).default,
        host: config.get('REDIS_HOST') || 'localhost',
        port: parseInt(config.get('REDIS_PORT') || '6379', 10),
        password: config.get('REDIS_PASSWORD'),
        db: parseInt(config.get('REDIS_DB') || '0', 10),
        ttl: parseInt(config.get('CACHE_TTL') || '300', 10),
      }),
    }),

    AuthModule,

    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule], // TypeOrm still needs imports
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
    NftModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
