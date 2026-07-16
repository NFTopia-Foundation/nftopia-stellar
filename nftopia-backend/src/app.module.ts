import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IndexerModule } from './jobs';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CollectionModule } from './modules/collection/collection.module';
import { NftModule } from './modules/nft/nft.module';
import { AuctionModule } from './modules/auction/auction.module';
import { AdminModule } from './admin/admin.module';
import { BidModule } from './modules/bid/bid.module';
import { ListingModule } from './modules/listing/listing.module';
import { OrderModule } from './modules/order/order.module';
import { LoggerModule } from 'nestjs-pino';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { StorageModule } from './storage/storage.module';
import { RedisRateGuard } from './common/guards/redis-rate.guard';
import { SearchModule } from './search/search.module';
import { SorobanRpcService } from './services/soroban-rpc.service';
import { StellarAccountService } from './services/stellar-account.service';
import { CollectionFactoryModule } from './modules/collection-factory/collection-factory.module';
import { StellarModule } from './modules/stellar/stellar.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OfferModule } from './modules/offer/offer.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { AuditModule } from './common/audit/audit.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { getLoggerConfig } from './config/logger.config';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { SocialModule } from './modules/social/social.module';
import { PaymentModule } from './modules/payment/payment.module';
// import { CorsConfig } from './config/cors.config';

@Module({
  imports: [
    HealthModule,
    DatabaseSupportModule,
    ScheduleModule.forRoot(),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => getLoggerConfig(process.env),
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
            useFactory: (config: ConfigService) => createTypeOrmOptions(config),
          }),
          UsersModule,
          AdminModule,
        ]),
    CollectionModule,
    NftModule,
    AuctionModule,
    BidModule,
    ListingModule,
    OrderModule,
    OfferModule,
    TransactionModule,
    StorageModule,
    SearchModule,
    CollectionFactoryModule,
    StellarModule,
    NotificationsModule,
    IndexerModule,
    AuditModule,
    MetricsModule,
    SocialModule,
    PaymentModule,
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
