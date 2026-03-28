import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CollectionModule } from './modules/collection/collection.module';
import { NftModule } from './modules/nft/nft.module';
import { AuctionModule } from './modules/auction/auction.module';
import { BidModule } from './modules/bid/bid.module';
import { ListingModule } from './modules/listing/listing.module';
import { OrderModule } from './modules/order/order.module';
import { CollectionModule } from './modules/collection/collection.module';
import { LoggerModule } from 'nestjs-pino';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { StorageModule } from './storage/storage.module';
import { RedisRateGuard } from './common/guards/redis-rate.guard';
import { SearchModule } from './search/search.module';
import { SorobanRpcService } from './services/soroban-rpc.service';
import { StellarAccountService } from './services/stellar-account.service';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
          transport:
            config.get('NODE_ENV') !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                  },
                }
              : undefined,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          customLogLevel: (req, res) => {
            if (res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },
        },
      }),
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
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
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              type: 'postgres',
              url:
                config.get<string>('DATABASE_URL') || process.env.DATABASE_URL,
              host: config.get<string>('DB_HOST') || process.env.DB_HOST,
              port: parseInt(
                config.get('DB_PORT') || process.env.DB_PORT || '5432',
                10,
              ),
              username: config.get<string>('DB_USER') || process.env.DB_USER,
              password: config.get<string>('DB_PASS') || process.env.DB_PASS,
              database: config.get<string>('DB_NAME') || process.env.DB_NAME,
              autoLoadEntities: true,
              synchronize: true,
            }),
          }),
          UsersModule,
        ]),
    CollectionModule,
    NftModule,
    AuctionModule,
    BidModule,
    ListingModule,
    OrderModule,
    CollectionModule,
    StorageModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SorobanRpcService,
    StellarAccountService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: RedisRateGuard,
    },
  ],
})
export class AppModule {}
