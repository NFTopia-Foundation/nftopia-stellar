import { Params } from 'nestjs-pino';
import * as crypto from 'crypto';
import { IncomingMessage } from 'http';

export function getLoggerConfig(env: NodeJS.ProcessEnv = process.env): Params {
  const isProduction = env.NODE_ENV === 'production';
  const logLevel = env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
  const sampleRate = env.LOG_SAMPLE_RATE
    ? parseFloat(env.LOG_SAMPLE_RATE)
    : 1.0;

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
      genReqId: (req: IncomingMessage) => {
        const headers = req.headers;
        const correlationId =
          headers['x-correlation-id'] || headers['x-request-id'];
        const reqRecord = req as unknown as Record<string, unknown>;
        const id =
          (Array.isArray(correlationId) ? correlationId[0] : correlationId) ||
          (typeof reqRecord.correlationId === 'string'
            ? reqRecord.correlationId
            : undefined) ||
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
        err: (err: unknown) => {
          if (!err) return err;
          const errorVal = err as Record<string, unknown>;
          const serialized = {
            type:
              typeof errorVal.constructor === 'function' &&
              errorVal.constructor.name
                ? errorVal.constructor.name
                : typeof errorVal.type === 'string'
                  ? errorVal.type
                  : 'Error',
            message:
              typeof errorVal.message === 'string'
                ? errorVal.message
                : err instanceof Error
                  ? err.message
                  : 'Unknown error',
            stack:
              typeof errorVal.stack === 'string' ? errorVal.stack : undefined,
          };
          if (serialized.stack) {
            const lines = serialized.stack.split('\n');
            serialized.stack = lines.slice(0, 10).join('\n'); // Truncate to first 10 lines
          }
          return serialized;
        },
      },
      formatters: {
        log: (object: Record<string, unknown>) => {
          if (object.req && typeof object.req === 'object') {
            const req = object.req as Record<string, unknown>;
            if (req.id && typeof req.id === 'string') {
              object.requestId = req.id;
            }
          }
          return object;
        },
      },
    },
  };
}
