// -------------------------------------------------------------------------
// Secrets must be resolved BEFORE dotenv/config (and therefore before any
// module import that reads process.env) so that config validators see the
// correct values at startup. The loadDockerSecrets() call is a no-op in
// development (when SECRET_FILE_* vars are absent).
// -------------------------------------------------------------------------
import { loadDockerSecrets } from './config/secrets.loader';

const _secretsResult = loadDockerSecrets();
// Log the result after the Pino logger is available (see bootstrap()).

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { GraphQLSchemaFactory } from '@nestjs/graphql';
import { json, urlencoded } from 'express';
import type { Request, Response, NextFunction } from 'express';
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
import { MetricsInterceptor } from './common/metrics/metrics.interceptor';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import {
  createCorsConfig,
  logRejectedOrigin,
  CorsConfig,
} from './config/cors.config';

/**
 * Get CORS configuration based on environment
 */
function getCorsConfig(): CorsConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const corsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
  const corsOriginDev = process.env.CORS_ORIGIN_DEV;

  return createCorsConfig({
    nodeEnv,
    corsAllowedOrigins,
    corsOriginDev,
  });
}

/**
 * Check if an origin is allowed by the CORS configuration
 */
function isOriginAllowed(origin: string, config: CorsConfig): boolean {
  return config.origins.some((allowed: string) => {
    // Allow wildcard subdomains if configured
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain);
    }
    return origin === allowed;
  });
}

/**
 * Create CORS middleware with origin logging
 */
function createCorsMiddleware() {
  const config = getCorsConfig();

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // Allow requests with no origin (same-origin, non-browser clients)
    if (!origin) {
      next();
      return;
    }

    // Check if origin is allowed
    const isAllowed = isOriginAllowed(origin, config);

    if (!isAllowed) {
      logRejectedOrigin(origin, req.path);
      res.status(403).json({
        statusCode: 403,
        message: 'CORS origin not allowed',
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
    res.setHeader(
      'Access-Control-Allow-Headers',
      config.allowedHeaders.join(', '),
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      config.exposedHeaders.join(', '),
    );
    res.setHeader('Access-Control-Max-Age', String(config.maxAge));

    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }

    next();
  };
}

/**
 * Create CORS origin callback for enableCors
 */
function createCorsOriginCallback(context: string) {
  const config = getCorsConfig();

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ): void => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowed = isOriginAllowed(origin, config);

    if (!isAllowed) {
      logRejectedOrigin(origin, context);
      callback(new Error('CORS origin not allowed'), false);
      return;
    }

    callback(null, true);
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
  app.useLogger(app.get<PinoLogger>(PinoLogger));

  const sorobanRpcService = app.get<SorobanRpcService>(SorobanRpcService);
  const stellarAccountService = app.get<StellarAccountService>(
    StellarAccountService,
  );

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new StellarErrorInterceptor(sorobanRpcService),
    new StellarLoggingInterceptor(sorobanRpcService),
    new StellarTimeoutInterceptor(sorobanRpcService),
    new StellarResponseInterceptor(sorobanRpcService),
    new StellarTransformInterceptor(stellarAccountService),
    new MetricsInterceptor(),
  );

  // Apply CORS middleware with origin logging
  app.use(createCorsMiddleware());

  // Also enable Cors for preflight handling
  app.enableCors({
    origin: createCorsOriginCallback('rest'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-API-Key',
      'X-CSRF-Token',
      'Cache-Control',
      'Pragma',
    ],
    exposedHeaders: [
      'Content-Length',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
    ],
    maxAge: 86400,
  });

  app.useGlobalPipes(createValidationPipe());

  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NFTopia API')
    .setDescription('NFTopia Stellar NFT Marketplace API Documentation')
    .setVersion('1.0')
    .addTag('health', 'Liveness and readiness probes')
    .addTag('nft', 'NFT operations')
    .addTag('marketplace', 'Marketplace operations')
    .addTag('users', 'User operations')
    .addTag('search', 'Search and discovery operations')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  const logger = app.get<PinoLogger>(PinoLogger);

  logger.log(`Application is running on: http://localhost:${port}/api/v1`);
  logger.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );

  return app;
}

async function bootstrapGraphqlGateway() {
  const graphqlApp = await NestFactory.create(GraphqlGatewayModule);
  graphqlApp.useLogger(graphqlApp.get<PinoLogger>(PinoLogger));
  graphqlApp.useGlobalInterceptors(new CorrelationIdInterceptor());
  // graphqlApp.enableCors(createCorsConfig());

  // Apply same CORS configuration to GraphQL gateway
  graphqlApp.enableCors({
    origin: createCorsOriginCallback('graphql'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-API-Key',
      'X-CSRF-Token',
      'Cache-Control',
      'Pragma',
    ],
    exposedHeaders: [
      'Content-Length',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
    ],
    maxAge: 86400,
  });

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
  // Emit secrets-load audit record once the Nest logger is ready.
  const startupLogger = new NestLogger('Bootstrap');
  startupLogger.log(
    `[SecretsLoader] Resolved ${_secretsResult.loadedCount} Docker secret(s): ` +
      `[${_secretsResult.loadedVars.join(', ')}]. ` +
      (_secretsResult.skippedVars.length > 0
        ? `Skipped (not configured): [${_secretsResult.skippedVars.join(', ')}].`
        : 'All optional secrets configured.'),
  );

  // Validate CORS configuration on startup
  try {
    getCorsConfig();
  } catch (error) {
    startupLogger.error(`CORS configuration error: ${(error as Error).message}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  await bootstrapRestApi();
  await bootstrapGraphqlGateway();
}

void bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
});
