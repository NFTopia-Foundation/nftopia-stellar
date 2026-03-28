import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { GraphQLSchemaFactory } from '@nestjs/graphql';
import { json } from 'express';
import type { Request, Response } from 'express';
import { GraphqlGatewayModule } from './graphql/graphql.module';
import {
  BaseResolver,
  graphqlResolvers,
  graphqlScalarClasses,
} from './graphql/resolvers';
import { GraphqlContextFactory } from './graphql/context/context.factory';
import { GraphqlLoggingMiddleware } from './graphql/middleware/logging.middleware';
import type { GraphqlContext } from './graphql/context/context.interface';
import {
  createGraphqlLandingPagePlugin,
  formatGraphqlError,
  getGraphqlConfig,
} from './config/graphql.config';
import { StellarErrorInterceptor } from './interceptors/stellar-error.interceptor';
import { StellarLoggingInterceptor } from './interceptors/stellar-logging.interceptor';
import { StellarResponseInterceptor } from './interceptors/stellar-response.interceptor';
import { StellarTimeoutInterceptor } from './interceptors/stellar-timeout.interceptor';
import { StellarTransformInterceptor } from './interceptors/stellar-transform.interceptor';
import { SorobanRpcService } from './services/soroban-rpc.service';
import { StellarAccountService } from './services/stellar-account.service';

function createCorsConfig() {
  return {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  };
}

function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });
}

async function bootstrapRestApi() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(PinoLogger));

  const sorobanRpcService = app.get(SorobanRpcService);
  const stellarAccountService = app.get(StellarAccountService);

  app.useGlobalInterceptors(
    new StellarErrorInterceptor(sorobanRpcService),
    new StellarLoggingInterceptor(sorobanRpcService),
    new StellarTimeoutInterceptor(sorobanRpcService),
    new StellarResponseInterceptor(sorobanRpcService),
    new StellarTransformInterceptor(stellarAccountService),
  );

  app.enableCors(createCorsConfig());
  app.useGlobalPipes(createValidationPipe());

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('NFTopia API')
    .setDescription('NFTopia Stellar NFT Marketplace API Documentation')
    .setVersion('1.0')
    .addTag('nft', 'NFT operations')
    .addTag('marketplace', 'Marketplace operations')
    .addTag('users', 'User operations')
    .addTag('search', 'Search and discovery operations')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  const logger = app.get(PinoLogger);

  logger.log(`Application is running on: ...`);
  logger.log(`Swagger documentation available at: ...`);

  return app;
}

async function bootstrapGraphqlGateway() {
  const graphqlApp = await NestFactory.create(GraphqlGatewayModule);
  graphqlApp.enableCors(createCorsConfig());
  graphqlApp.useGlobalPipes(createValidationPipe());

  const graphqlConfig = getGraphqlConfig();
  const schemaFactory = graphqlApp.get(GraphQLSchemaFactory);
  const contextFactory = graphqlApp.get(GraphqlContextFactory);
  const loggingMiddleware = graphqlApp.get(GraphqlLoggingMiddleware);
  const baseResolver = graphqlApp.get(BaseResolver);
  const landingPagePlugin = createGraphqlLandingPagePlugin(
    graphqlConfig.playgroundEnabled,
  );

  const schema = await schemaFactory.create(
    [...graphqlResolvers],
    [...graphqlScalarClasses],
  );
  const apolloServer = new ApolloServer<GraphqlContext>({
    schema,
    rootValue: {
      health: () => baseResolver.health(),
    },
    introspection: graphqlConfig.introspectionEnabled,
    formatError: formatGraphqlError,
    plugins: [
      loggingMiddleware.createPlugin(),
      ...(landingPagePlugin ? [landingPagePlugin] : []),
    ],
  });

  await apolloServer.start();

  const httpAdapter = graphqlApp.getHttpAdapter().getInstance() as {
    use: (...args: unknown[]) => void;
  };
  const graphqlMiddleware = expressMiddleware<GraphqlContext>(apolloServer, {
    context: async ({ req, res }) =>
      contextFactory.create(
        req as unknown as Request,
        res as unknown as Response,
      ),
  });

  httpAdapter.use(graphqlConfig.path, json(), graphqlMiddleware);

  await graphqlApp.listen(graphqlConfig.port);

  const logger = new NestLogger('GraphqlGateway');
  logger.log(
    `GraphQL gateway is running on: http://localhost:${graphqlConfig.port}${graphqlConfig.path}`,
  );

  return graphqlApp;
}

async function bootstrap() {
  await bootstrapRestApi();
  await bootstrapGraphqlGateway();
}
void bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
});
