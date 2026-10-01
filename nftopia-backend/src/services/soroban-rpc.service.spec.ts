import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  SorobanRpcService,
  retrySorobanRpcCall,
  sorobanRpcRetryMetrics,
  type SorobanRpcRetryOptions,
} from './soroban-rpc.service';

describe('SorobanRpcService', () => {
  let service: SorobanRpcService;
  let configService: ConfigService;

  const originalFetch = global.fetch;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanRpcService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string | undefined> = {
                STELLAR_NETWORK: 'TESTNET',
                STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
                SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
                STELLAR_NETWORK_PASSPHRASE: undefined,
                STELLAR_TIMEOUT_DEFAULT_MS: undefined,
                STELLAR_TIMEOUT_SIMULATION_MS: undefined,
                STELLAR_TIMEOUT_SUBMISSION_MS: undefined,
                STELLAR_LOG_LEVEL: undefined,
                STELLAR_OBFUSCATE_SENSITIVE_ERRORS: undefined,
              };
              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SorobanRpcService>(SorobanRpcService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRuntimeConfig', () => {
    it('returns testnet defaults when config is empty', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      const config = service.getRuntimeConfig();

      expect(config.network).toBe('testnet');
      expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    });

    it('respects explicit mainnet config', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'STELLAR_NETWORK') return 'MAINNET';
        if (key === 'STELLAR_HORIZON_URL') return 'https://horizon.stellar.org';
        return undefined;
      });

      const config = service.getRuntimeConfig();

      expect(config.network).toBe('mainnet');
      expect(config.horizonUrl).toBe('https://horizon.stellar.org');
    });
  });

  describe('onModuleInit', () => {
    it('logs success when Horizon is reachable', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.onModuleInit();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://horizon-testnet.stellar.org/',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Horizon health check passed'),
      );
    });

    it('logs a warning but does not throw in non-production when Horizon is unreachable', async () => {
      process.env.NODE_ENV = 'development';
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.onModuleInit();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Horizon health check failed'),
      );
    });

    it('throws in production when Horizon is unreachable', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'STELLAR_NETWORK') return 'MAINNET';
        if (key === 'STELLAR_HORIZON_URL') return 'https://horizon.stellar.org';
        if (key === 'SOROBAN_RPC_URL') return 'https://mainnet.sorobanrpc.com';
        return undefined;
      });

      process.env.NODE_ENV = 'production';
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.onModuleInit()).rejects.toThrow(
        'Horizon health check failed',
      );
    });
  });

  describe('retrySorobanRpcCall tracing (#534)', () => {
    const baseOptions: SorobanRpcRetryOptions = {
      config: {
        sorobanRpcMaxRetries: 3,
        sorobanRpcRetryDelayMs: 1,
        sorobanRpcRetryBackoffMultiplier: 1,
        sorobanRpcRetryMaxDelayMs: 5,
      },
      methodName: 'getAccount',
    };

    // `trace.getTracer(...)` is called once at module load in
    // soroban-rpc.service.ts (before any provider exists yet); its
    // ProxyTracer resolves and caches a delegate on first real use and
    // does not re-resolve it on a later setGlobalTracerProvider() call —
    // so the provider is registered once here, and tests reset the
    // exporter's captured spans instead of re-registering per test.
    const exporter = new InMemorySpanExporter();
    let provider: BasicTracerProvider;

    beforeAll(() => {
      provider = new BasicTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      });
      trace.setGlobalTracerProvider(provider);
    });

    afterAll(async () => {
      trace.disable();
      await provider.shutdown();
    });

    beforeEach(() => {
      exporter.reset();
      sorobanRpcRetryMetrics.totalRetryAttempts = 0;
      sorobanRpcRetryMetrics.successfulRecoveries = 0;
      sorobanRpcRetryMetrics.exhaustedRetries = 0;
    });

    it('produces a span named after the RPC method, with rpc.system/rpc.method attributes', async () => {
      await retrySorobanRpcCall(() => Promise.resolve('ok'), baseOptions);

      const [span] = exporter.getFinishedSpans();
      expect(span.name).toBe('soroban_rpc.getAccount');
      expect(span.attributes['rpc.system']).toBe('soroban');
      expect(span.attributes['rpc.method']).toBe('getAccount');
      expect(span.attributes['soroban_rpc.attempts']).toBe(1);
    });

    it('records the attempt count that eventually succeeded', async () => {
      let calls = 0;
      const operation = () => {
        calls += 1;
        if (calls < 3) {
          return Promise.reject(
            Object.assign(new Error('temporarily unavailable'), {
              status: 503,
            }),
          );
        }
        return Promise.resolve('ok');
      };

      await retrySorobanRpcCall(operation, baseOptions);

      const [span] = exporter.getFinishedSpans();
      expect(span.attributes['soroban_rpc.attempts']).toBe(3);
      expect(span.events.filter((e) => e.name === 'retry')).toHaveLength(2);
      expect(sorobanRpcRetryMetrics.successfulRecoveries).toBe(1);
    });

    it('marks the span as an error and records the exception on exhausted retries', async () => {
      const operation = () =>
        Promise.reject(
          Object.assign(new Error('still unavailable'), { status: 503 }),
        );

      await expect(retrySorobanRpcCall(operation, baseOptions)).rejects.toThrow(
        'still unavailable',
      );

      const [span] = exporter.getFinishedSpans();
      expect(span.status.code).toBe(2); // SpanStatusCode.ERROR
      expect(span.events.some((e) => e.name === 'exception')).toBe(true);
      expect(sorobanRpcRetryMetrics.exhaustedRetries).toBe(1);
    });

    it('marks the span as an error immediately for a non-retryable failure (no retry events)', async () => {
      const operation = () =>
        Promise.reject(
          Object.assign(new Error('bad request'), { status: 400 }),
        );

      await expect(retrySorobanRpcCall(operation, baseOptions)).rejects.toThrow(
        'bad request',
      );

      const [span] = exporter.getFinishedSpans();
      expect(span.status.code).toBe(2); // SpanStatusCode.ERROR
      expect(span.events.filter((e) => e.name === 'retry')).toHaveLength(0);
    });

    it('always ends the span, even on failure', async () => {
      const operation = () => Promise.reject(new Error('boom'));

      await expect(
        retrySorobanRpcCall(operation, baseOptions),
      ).rejects.toThrow();

      expect(exporter.getFinishedSpans()).toHaveLength(1);
    });
  });
});
