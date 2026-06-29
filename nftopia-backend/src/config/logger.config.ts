import { Params } from 'nestjs-pino';
import * as crypto from 'crypto';

export function getLoggerConfig(env: NodeJS.ProcessEnv = process.env): Params {
  const isProduction = env.NODE_ENV === 'production';
  const logLevel = env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
  const sampleRate = env.LOG_SAMPLE_RATE ? parseFloat(env.LOG_SAMPLE_RATE) : 1.0;

  return {
    pinoHttp: {
      level: logLevel,
      transport: !isProduction
        ? {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
            },
          }
        : undefined,
      base: {
        service: 'nftopia-backend',
        environment: env.NODE_ENV || 'development',
      },
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'req.body.password',
          'req.body.token',
          'req.body.secret',
          'req.body.key',
          'req.body.apiKey',
          'req.body.pass',
          'password',
          'token',
          'authorization',
          'cookie',
          'secret',
          'key',
        ],
        censor: '[REDACTED]',
      },
      genReqId: (req) => {
        const id =
          req.headers['x-correlation-id'] ||
          req.headers['x-request-id'] ||
          req['correlationId'] ||
          crypto.randomUUID();
        return id;
      },
      customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';

        const url = req.url || '';
        if (url.includes('/health') || url.includes('/metrics')) {
          return 'debug';
        }

        // Apply log sampling for successful requests
        if (sampleRate < 1.0 && Math.random() > sampleRate) {
          return 'silent';
        }

        return 'info';
      },
      serializers: {
        err: (err) => {
          if (!err) return err;
          const serialized = {
            type: err.constructor?.name || err.type || 'Error',
            message: err.message,
            stack: err.stack,
          };
          if (serialized.stack && typeof serialized.stack === 'string') {
            const lines = serialized.stack.split('\n');
            serialized.stack = lines.slice(0, 10).join('\n'); // Truncate to first 10 lines
          }
          return serialized;
        },
      },
      formatters: {
        log: (object: Record<string, any>) => {
          if (object.req && object.req.id) {
            object.requestId = object.req.id;
          }
          return object;
        },
      },
    },
  };
}
