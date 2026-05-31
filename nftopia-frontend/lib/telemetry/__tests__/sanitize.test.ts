import { sanitizePayload } from '../sanitize';

describe('sanitizePayload', () => {
  it('passes global allowlist fields', () => {
    const result = sanitizePayload({ latency_ms: 123, error_code: 'ERR' });
    expect(result).toEqual({ latency_ms: 123, error_code: 'ERR' });
  });

  it('passes category allowlist fields for correct category', () => {
    const result = sanitizePayload({ provider: 'freighter', error_code: 'ERR' }, { category: 'wallet' });
    expect(result).toEqual({ provider: 'freighter', error_code: 'ERR' });
  });

  it('strips category allowlist fields for wrong category', () => {
    const result = sanitizePayload({ provider: 'freighter', error_code: 'ERR' }, { category: 'auth' });
    expect(result).toEqual({ error_code: 'ERR' });
  });

  it('always strips always-blocked fields', () => {
    const result = sanitizePayload({ provider: 'freighter', email: 'user@example.com', error_code: 'ERR' }, { category: 'wallet' });
    expect(result).toEqual({ provider: 'freighter', error_code: 'ERR' });
  });

  it('truncates long string values', () => {
    const longStr = 'a'.repeat(300);
    const result = sanitizePayload({ error_code: longStr }, { maxStringLength: 10 });
    expect(result.error_code).toBe('a'.repeat(10));
  });

  it('removes null and undefined values', () => {
    const result = sanitizePayload({ provider: null, error_code: undefined, latency_ms: 123 });
    expect(result).toEqual({ latency_ms: 123 });
  });

  it('does not mutate original payload', () => {
    const payload = { provider: 'freighter', error_code: 'ERR' };
    const copy = { ...payload };
    sanitizePayload(payload, { category: 'wallet' });
    expect(payload).toEqual(copy);
  });

  it('returns empty object for empty or invalid input', () => {
    expect(sanitizePayload(null as any)).toEqual({});
    expect(sanitizePayload(undefined as any)).toEqual({});
    expect(sanitizePayload(123 as any)).toEqual({});
    expect(sanitizePayload([] as any)).toEqual({});
    expect(sanitizePayload({})).toEqual({});
  });

  it('logs stripped fields in debug mode (does not log values)', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    sanitizePayload({ email: 'user@example.com', foo: 'bar', latency_ms: 1 }, { category: 'wallet', debug: true, maxStringLength: 2 });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[telemetry][strip] wallet: email (always-blocked)'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[telemetry][strip] wallet: foo (not-in-allowlist)'));
    spy.mockRestore();
  });
});
