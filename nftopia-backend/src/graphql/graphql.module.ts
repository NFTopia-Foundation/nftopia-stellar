import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GraphQLSchemaBuilderModule } from '@nestjs/graphql';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '../auth/jwt.strategy';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { CollectionModule } from '../modules/collection/collection.module';
import { NftModule } from '../modules/nft/nft.module';
import { SearchModule } from '../search/search.module';
import { GraphqlContextFactory } from './context/context.factory';
import { GraphqlAuthMiddleware } from './middleware/auth.middleware';
import { GraphqlLoggingMiddleware } from './middleware/logging.middleware';
import { graphqlResolvers, graphqlScalarClasses } from './resolvers';

const jwtAccessExpiresInSeconds = parseInt(
  process.env.JWT_EXPIRES_IN_SECONDS || '900',
  10,
);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    NftModule,
    SearchModule,
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
export class GraphqlGatewayModule {}
