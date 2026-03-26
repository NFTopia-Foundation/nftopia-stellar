import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GraphQLSchemaBuilderModule } from '@nestjs/graphql';
import { JwtStrategy } from '../auth/jwt.strategy';
import { GraphqlContextFactory } from './context/context.factory';
import { GraphqlAuthMiddleware } from './middleware/auth.middleware';
import { GraphqlLoggingMiddleware } from './middleware/logging.middleware';
import { graphqlResolvers } from './resolvers';

const jwtAccessExpiresInSeconds = parseInt(
  process.env.JWT_EXPIRES_IN_SECONDS || '900',
  10,
);

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    GraphQLSchemaBuilderModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: {
        expiresIn: jwtAccessExpiresInSeconds,
      },
    }),
  ],
  providers: [
    JwtStrategy,
    GraphqlContextFactory,
    GraphqlAuthMiddleware,
    GraphqlLoggingMiddleware,
    ...graphqlResolvers,
  ],
  exports: [
    GraphQLSchemaBuilderModule,
    GraphqlContextFactory,
    GraphqlLoggingMiddleware,
    ...graphqlResolvers,
  ],
})
export class GraphqlGatewayModule {}
