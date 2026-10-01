import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';

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
import { TransactionRetryModule } from './modules/transaction/transaction-retry.module';
import { AuditModule } from './common/audit/audit.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { getLoggerConfig } from './config/logger.config';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { SocialModule } from './modules/social/social.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import {
  getMongoConfig,
  mongoEnvironmentFromProcessEnv,
} from './config/mongo.config';
// import { CorsConfig } from './config/cors.config';

@Module({
  imports: [
    HealthModule,
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

    /**
     * BullMQ configuration for job queues
     * Used by TransactionRetryModule and other queue-based features
     */
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST') || 'localhost',
          port: parseInt(config.get('REDIS_PORT') || '6379', 10),
          password: config.get('REDIS_PASSWORD') || undefined,
          db: parseInt(config.get('REDIS_DB') || '0', 10),
        },
        defaultJobOptions: {
          attempts: 1, // We handle retries ourselves in the worker
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: false, // Keep for DLQ handling
          removeOnFail: false, // Keep for DLQ handling
          timeout: 300000, // 5 minutes timeout for long-running jobs
        },
        // Optimize for transaction retry workloads
        limiter: {
          max: 100, // Max concurrent jobs
          duration: 1000, // Per second
        },
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
              logging: config.get('NODE_ENV') === 'development',
              extra: {
                max: parseInt(
                  config.get('DB_POOL_SIZE') ||
                    process.env.DB_POOL_SIZE ||
                    '20',
                  10,
                ),
                idleTimeoutMillis: parseInt(
                  config.get('DB_IDLE_TIMEOUT_MS') ||
                    process.env.DB_IDLE_TIMEOUT_MS ||
                    '30000',
                  10,
                ),
                connectionTimeoutMillis: parseInt(
                  config.get('DB_CONNECTION_TIMEOUT_MS') ||
                    process.env.DB_CONNECTION_TIMEOUT_MS ||
                    '10000',
                  10,
                ),
              },
            }),
          }),
          // MongoDB connection for analytics/event data (#531) — flexible,
          // schema-light document storage kept separate from the
          // relational Postgres schema above. Skipped under test for the
          // same reason TypeOrmModule is: so the Jest suite never tries to
          // hold the process open waiting on a real connection. See
          // docs/mongodb-analytics.md.
          MongooseModule.forRootAsync({
            useFactory: () => {
              const mongoConfig = getMongoConfig(
                mongoEnvironmentFromProcessEnv(process.env),
              );
              return {
                uri: mongoConfig.uri,
                dbName: mongoConfig.dbName,
                retryAttempts: mongoConfig.retryAttempts,
                retryDelay: mongoConfig.retryDelay,
                connectTimeoutMS: mongoConfig.connectTimeoutMS,
                serverSelectionTimeoutMS: mongoConfig.serverSelectionTimeoutMS,
              };
            },
          }),
          UsersModule,
          AdminModule,
          AnalyticsModule,
        ]),
    CollectionModule,
    NftModule,
    AuctionModule,
    BidModule,
    ListingModule,
    OrderModule,
    OfferModule,
    TransactionModule,
    TransactionRetryModule, // Add the transaction retry module
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
    AiAgentModule,
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
