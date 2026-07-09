import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GraphQLSchemaBuilderModule } from '@nestjs/graphql';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { JwtStrategy } from '../auth/jwt.strategy';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { CollectionModule } from '../modules/collection/collection.module';
import { ListingModule } from '../modules/listing/listing.module';
import { NftModule } from '../modules/nft/nft.module';
import { AuctionModule } from '../modules/auction/auction.module';
import { BidModule } from '../modules/bid/bid.module';
import { SearchModule } from '../search/search.module';
import { OrderModule } from '../modules/order/order.module';
import { UsersModule } from '../users/users.module';
import { GraphqlContextFactory } from './context/context.factory';
import { GraphqlAuthMiddleware } from './middleware/auth.middleware';
import { GraphqlLoggingMiddleware } from './middleware/logging.middleware';
import { graphqlResolvers, graphqlScalarClasses } from './resolvers';
import { getLoggerConfig } from '../config/logger.config';
import { CorrelationIdMiddleware } from '../common/middleware/correlation-id.middleware';

const jwtAccessExpiresInSeconds = parseInt(
  process.env.JWT_EXPIRES_IN_SECONDS || '900',
  10,
);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => getLoggerConfig(process.env),
    }),
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
    PassportModule,
    GraphQLSchemaBuilderModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [],
      useFactory: () => ({
        type: 'postgres' as const,
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: {
        expiresIn: jwtAccessExpiresInSeconds,
      },
    }),
    CollectionModule,
    ListingModule,
    NftModule,
    AuctionModule,
    BidModule,
    SearchModule,
    OrderModule,
    UsersModule,
  ],
  providers: [
    JwtStrategy,
    GqlAuthGuard,
    GraphqlContextFactory,
    GraphqlAuthMiddleware,
    GraphqlLoggingMiddleware,
    ...graphqlResolvers,
    ...graphqlScalarClasses,
  ],
  exports: [
    GraphQLSchemaBuilderModule,
    GraphqlContextFactory,
    GraphqlLoggingMiddleware,
    ...graphqlResolvers,
    ...graphqlScalarClasses,
  ],
})
export class GraphqlGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
