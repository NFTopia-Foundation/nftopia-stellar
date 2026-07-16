import { getLoggerConfig } from './logger.config';

interface TestConfig {
  pinoHttp: {
    level: string;
    transport?: { target: string };
    base: Record<string, string>;
    timestamp: () => string;
    redact: { paths: string[] };
    customLogLevel: (
      req: { url?: string },
      res: { statusCode: number },
      err?: Error | null,
    ) => string;
    serializers: {
      err: (err: unknown) => {
        message?: string;
        type?: string;
        stack?: string;
      };
    };
    formatters: {
      log: (obj: Record<string, unknown>) => Record<string, unknown>;
    };
  };
}

function getTestConfig(env?: NodeJS.ProcessEnv): TestConfig {
  return getLoggerConfig(env) as unknown as TestConfig;
}

describe('LoggerConfig', () => {
  it('should use pino-pretty transport in development', () => {
    const config = getTestConfig({ NODE_ENV: 'development' });
    expect(config.pinoHttp).toBeDefined();
    expect(config.pinoHttp.transport).toBeDefined();
    expect(config.pinoHttp.transport?.target).toBe('pino-pretty');
  });

  it('should not use transport in production (forces JSON)', () => {
    const config = getTestConfig({ NODE_ENV: 'production' });
    expect(config.pinoHttp).toBeDefined();
    expect(config.pinoHttp.transport).toBeUndefined();
  });

  it('should use LOG_LEVEL if provided', () => {
    const config = getTestConfig({ LOG_LEVEL: 'warn' });
    expect(config.pinoHttp.level).toBe('warn');
  });

  it('should default to info in production and debug in development', () => {
    const prodConfig = getTestConfig({ NODE_ENV: 'production' });
    expect(prodConfig.pinoHttp.level).toBe('info');

    const devConfig = getTestConfig({ NODE_ENV: 'development' });
    expect(devConfig.pinoHttp.level).toBe('debug');
  });

  it('should include service and environment in base fields', () => {
    const config = getTestConfig({ NODE_ENV: 'production' });
    expect(config.pinoHttp.base).toEqual({
      service: 'nftopia-backend',
      environment: 'production',
    });
  });

  it('should format ISO timestamp', () => {
    const config = getTestConfig();
    const timestampFn = config.pinoHttp.timestamp;
    expect(typeof timestampFn).toBe('function');
    const result = timestampFn();
    expect(result).toContain(',"time":"');
    const timeStr = result.split('"')[3];
    expect(new Date(timeStr).getTime()).not.toBeNaN();
  });

  it('should redact sensitive fields', () => {
    const config = getTestConfig();
    const redactPaths = config.pinoHttp.redact.paths;
    expect(redactPaths).toContain('req.headers.authorization');
    expect(redactPaths).toContain('req.body.password');
  });

  describe('customLogLevel', () => {
    let customLogLevel: (
      req: { url?: string },
      res: { statusCode: number },
      err?: Error | null,
    ) => string;

    beforeEach(() => {
      const config = getTestConfig();
      customLogLevel = config.pinoHttp.customLogLevel;
    });

    it('should return error for status >= 500', () => {
      expect(customLogLevel({}, { statusCode: 500 }, null)).toBe('error');
    });

    it('should return error if an error object is passed', () => {
      expect(customLogLevel({}, { statusCode: 200 }, new Error('Err'))).toBe(
        'error',
      );
    });

    it('should return warn for status >= 400', () => {
      expect(customLogLevel({}, { statusCode: 400 }, null)).toBe('warn');
    });

    it('should return debug for health checks and metrics', () => {
      expect(
        customLogLevel({ url: '/health' }, { statusCode: 200 }, null),
      ).toBe('debug');
      expect(
        customLogLevel(
          { url: '/api/v1/health/readiness' },
          { statusCode: 200 },
          null,
        ),
      ).toBe('debug');
      expect(
        customLogLevel({ url: '/metrics' }, { statusCode: 200 }, null),
      ).toBe('debug');
    });

    it('should return info for other successful requests', () => {
      expect(
        customLogLevel({ url: '/api/v1/nfts' }, { statusCode: 200 }, null),
      ).toBe('info');
    });

    it('should apply log sampling and return silent for successful requests when sampled out', () => {
      const config = getTestConfig({ LOG_SAMPLE_RATE: '0.0' });
      const sampledLogLevel = config.pinoHttp.customLogLevel;
      expect(
        sampledLogLevel({ url: '/api/v1/nfts' }, { statusCode: 200 }, null),
      ).toBe('silent');
    });
  });

  describe('serializers', () => {
    it('should truncate error stack trace to 10 lines', () => {
      const config = getTestConfig();
      const errSerializer = config.pinoHttp.serializers.err;
      const fakeError = {
        constructor: { name: 'CustomError' },
        message: 'Something failed',
        stack: Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n'),
      };

      const result = errSerializer(fakeError);
      expect(result.message).toBe('Something failed');
      expect(result.type).toBe('CustomError');
      const stack = result.stack;
      expect(stack).toBeDefined();
      const stackLines = stack ? stack.split('\n') : [];
      expect(stackLines.length).toBe(10);
      expect(stackLines[0]).toBe('line 0');
      expect(stackLines[9]).toBe('line 9');
    });
  });

  describe('formatters', () => {
    it('should map req.id to requestId in log formatter', () => {
      const config = getTestConfig();
      const logFormatter = config.pinoHttp.formatters.log;
      const logObj = {
        msg: 'test log',
        req: { id: 'test-req-id' },
      };

      const result = logFormatter(logObj);
      expect(result.requestId).toBe('test-req-id');
    });

    it('should not add requestId if req or req.id is missing', () => {
      const config = getTestConfig();
      const logFormatter = config.pinoHttp.formatters.log;
      const logObj = { msg: 'test log' };

      const result = logFormatter(logObj);
      expect(result.requestId).toBeUndefined();
    });
  });
});
