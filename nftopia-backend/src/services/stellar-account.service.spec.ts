import { trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { StellarAccountService } from './stellar-account.service';

describe('StellarAccountService', () => {
  let service: StellarAccountService;

  beforeEach(() => {
    service = new StellarAccountService();
  });

  describe('toXlmAmount', () => {
    it('converts stroops to XLM', () => {
      expect(service.toXlmAmount('10000000')).toBe('1.0000000');
    });

    it('returns null for null/undefined', () => {
      expect(service.toXlmAmount(null)).toBeNull();
      expect(service.toXlmAmount(undefined)).toBeNull();
    });

    it('returns null for a non-numeric value', () => {
      expect(service.toXlmAmount('not-a-number')).toBeNull();
    });
  });

  describe('transformAccountData', () => {
    it('adds amountXlm to each balance', () => {
      const result = service.transformAccountData({
        balances: [{ balance: '50000000' }],
      }) as { balances: Array<{ amountXlm: string | null }> };

      expect(result.balances[0].amountXlm).toBe('5.0000000');
    });

    it('adds limitXlm to each trustline', () => {
      const result = service.transformAccountData({
        trustlines: [{ limit: '100000000' }],
      }) as { trustlines: Array<{ limitXlm: string | null }> };

      expect(result.trustlines[0].limitXlm).toBe('10.0000000');
    });

    it('passes through a payload with neither balances nor trustlines unchanged', () => {
      const payload = { id: 'account-1' };
      expect(service.transformAccountData(payload)).toBe(payload);
    });

    it('passes through non-object payloads unchanged', () => {
      expect(service.transformAccountData(null)).toBeNull();
      expect(service.transformAccountData('a string')).toBe('a string');
    });
  });

  describe('wrapCollectionResponse', () => {
    it('wraps an array with pagination metadata', () => {
      const result = service.wrapCollectionResponse([1, 2, 3], 2, 3, 10) as {
        data: number[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };

      expect(result.data).toEqual([1, 2, 3]);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 3,
        total: 10,
        totalPages: 4,
      });
    });

    it('passes through non-array data unchanged', () => {
      const payload = { not: 'an array' };
      expect(service.wrapCollectionResponse(payload)).toBe(payload);
    });

    it('defaults page/limit/total from the data length when omitted', () => {
      const result = service.wrapCollectionResponse([1, 2]) as {
        pagination: { page: number; limit: number; total: number };
      };
      expect(result.pagination).toEqual(
        expect.objectContaining({ page: 1, limit: 2, total: 2 }),
      );
    });
  });

  describe('tracing (#534)', () => {
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

    beforeEach(() => exporter.reset());

    it('produces a span for transformAccountData', () => {
      service.transformAccountData({ balances: [] });
      const [span] = exporter.getFinishedSpans();
      expect(span.name).toBe('stellar_account.transform_account_data');
    });

    it('produces a span for wrapCollectionResponse', () => {
      service.wrapCollectionResponse([1]);
      const [span] = exporter.getFinishedSpans();
      expect(span.name).toBe('stellar_account.wrap_collection_response');
    });
  });
});
