import {
  getTracingConfig,
  tracingEnvironmentFromProcessEnv,
} from './tracing.config';

describe('getTracingConfig', () => {
  it('is disabled under NODE_ENV=test by default', () => {
    const config = getTracingConfig({ nodeEnv: 'test' });
    expect(config.enabled).toBe(false);
  });

  it('is enabled outside test by default', () => {
    expect(getTracingConfig({ nodeEnv: 'development' }).enabled).toBe(true);
    expect(getTracingConfig({ nodeEnv: 'production' }).enabled).toBe(true);
  });

  it('OTEL_ENABLED explicitly overrides the NODE_ENV-based default', () => {
    expect(
      getTracingConfig({ nodeEnv: 'test', otelEnabled: 'true' }).enabled,
    ).toBe(true);
    expect(
      getTracingConfig({ nodeEnv: 'production', otelEnabled: 'false' }).enabled,
    ).toBe(false);
  });

  it('falls back to the default service name and OTLP endpoint', () => {
    const config = getTracingConfig({ nodeEnv: 'development' });
    expect(config.serviceName).toBe('nftopia-backend');
    expect(config.otlpEndpoint).toBe('http://localhost:4318/v1/traces');
  });

  it('honors an explicit service name and OTLP endpoint', () => {
    const config = getTracingConfig({
      nodeEnv: 'development',
      otelServiceName: 'nftopia-backend-canary',
      otelExporterOtlpEndpoint: 'http://collector.internal:4318/v1/traces',
    });
    expect(config.serviceName).toBe('nftopia-backend-canary');
    expect(config.otlpEndpoint).toBe(
      'http://collector.internal:4318/v1/traces',
    );
  });

  it('carries the given service version through', () => {
    const config = getTracingConfig({ nodeEnv: 'development' }, '1.2.3');
    expect(config.serviceVersion).toBe('1.2.3');
  });

  describe('sample ratio', () => {
    it('defaults to 1 (trace everything) outside production', () => {
      expect(getTracingConfig({ nodeEnv: 'development' }).sampleRatio).toBe(1);
    });

    it('defaults to a reduced ratio in production', () => {
      expect(getTracingConfig({ nodeEnv: 'production' }).sampleRatio).toBe(0.2);
    });

    it('is overridable via OTEL_TRACES_SAMPLE_RATIO in any environment', () => {
      const config = getTracingConfig({
        nodeEnv: 'production',
        otelTracesSampleRatio: '0.5',
      });
      expect(config.sampleRatio).toBe(0.5);
    });

    it('accepts the boundary values 0 and 1', () => {
      expect(
        getTracingConfig({ nodeEnv: 'production', otelTracesSampleRatio: '0' })
          .sampleRatio,
      ).toBe(0);
      expect(
        getTracingConfig({ nodeEnv: 'production', otelTracesSampleRatio: '1' })
          .sampleRatio,
      ).toBe(1);
    });

    it('rejects a value outside [0, 1]', () => {
      expect(() =>
        getTracingConfig({
          nodeEnv: 'production',
          otelTracesSampleRatio: '1.5',
        }),
      ).toThrow(/OTEL_TRACES_SAMPLE_RATIO/);
    });

    it('rejects a non-numeric value', () => {
      expect(() =>
        getTracingConfig({
          nodeEnv: 'production',
          otelTracesSampleRatio: 'high',
        }),
      ).toThrow(/OTEL_TRACES_SAMPLE_RATIO/);
    });
  });
});

describe('tracingEnvironmentFromProcessEnv', () => {
  it('reads the OTEL_* variables off the given process.env-like object', () => {
    const env = tracingEnvironmentFromProcessEnv({
      NODE_ENV: 'production',
      OTEL_ENABLED: 'true',
      OTEL_SERVICE_NAME: 'custom-service',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318/v1/traces',
      OTEL_TRACES_SAMPLE_RATIO: '0.3',
    });

    expect(env).toEqual({
      nodeEnv: 'production',
      otelEnabled: 'true',
      otelServiceName: 'custom-service',
      otelExporterOtlpEndpoint: 'http://collector:4318/v1/traces',
      otelTracesSampleRatio: '0.3',
    });
  });
});
