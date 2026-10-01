import { Horizon } from 'stellar-sdk';
import {
  BASE_RESERVE_STROOPS,
  DEFAULT_BASE_FEE_STROOPS,
  buildFeeEstimate,
  checkMinimumReserve,
  deriveFeeTiers,
  isSurgePricing,
  isValidCustomFeeStroops,
  stroopsToXlm,
  xlmToStroops,
} from '../fee';

function makeFeeStats(
  overrides: Partial<Horizon.HorizonApi.FeeDistribution> = {},
): Horizon.HorizonApi.FeeStatsResponse {
  const distribution: Horizon.HorizonApi.FeeDistribution = {
    max: '10000',
    min: '100',
    mode: '100',
    p10: '100',
    p20: '100',
    p30: '100',
    p40: '100',
    p50: '100',
    p60: '150',
    p70: '200',
    p80: '500',
    p90: '1000',
    p95: '2000',
    p99: '5000',
    ...overrides,
  };
  return {
    last_ledger: '1',
    last_ledger_base_fee: '100',
    ledger_capacity_usage: '0.5',
    fee_charged: distribution,
    max_fee: distribution,
  };
}

describe('stroopsToXlm', () => {
  it('converts 10,000,000 stroops (1 XLM) to a whole XLM string', () => {
    expect(stroopsToXlm('10000000')).toBe('1');
  });

  it('converts fractional stroops, trimming trailing zeros', () => {
    expect(stroopsToXlm('1230000')).toBe('0.123');
  });

  it('returns "0" for zero', () => {
    expect(stroopsToXlm('0')).toBe('0');
  });

  it('accepts a number as well as a string', () => {
    expect(stroopsToXlm(10_000_000)).toBe('1');
  });

  it('returns "0" for a non-numeric input', () => {
    expect(stroopsToXlm('not-a-number')).toBe('0');
  });
});

describe('xlmToStroops', () => {
  it('converts whole XLM to stroops', () => {
    expect(xlmToStroops('10')).toBe('100000000');
  });

  it('converts fractional XLM to stroops', () => {
    expect(xlmToStroops('0.123')).toBe('1230000');
  });

  it('rounds to the nearest integer stroop', () => {
    expect(xlmToStroops('0.00000001')).toBe('0');
  });

  it('returns "0" for a non-numeric input', () => {
    expect(xlmToStroops('nope')).toBe('0');
  });
});

describe('deriveFeeTiers', () => {
  it('uses the fallback fee for every tier when feeStats is null (fully degraded)', () => {
    const tiers = deriveFeeTiers(null, '250');
    expect(tiers.low.feePerOperationStroops).toBe('250');
    expect(tiers.medium.feePerOperationStroops).toBe('250');
    expect(tiers.high.feePerOperationStroops).toBe('250');
  });

  it('defaults the fallback to the network minimum when none is given', () => {
    const tiers = deriveFeeTiers(null);
    expect(tiers.medium.feePerOperationStroops).toBe(DEFAULT_BASE_FEE_STROOPS);
  });

  it('derives low/medium/high from p10/mode/p95 of fee_charged', () => {
    const feeStats = makeFeeStats({ p10: '120', mode: '300', p95: '4000' });
    const tiers = deriveFeeTiers(feeStats);
    expect(tiers.low.feePerOperationStroops).toBe('120');
    expect(tiers.medium.feePerOperationStroops).toBe('300');
    expect(tiers.high.feePerOperationStroops).toBe('4000');
  });

  it('falls back to min/p50/max within fee_charged when the primary field is empty', () => {
    const feeStats = makeFeeStats({ p10: '', mode: '', p95: '', min: '80', p50: '90', max: '9000' });
    // Fallback floor set below every value here so clamping can't mask
    // which source field actually got picked.
    const tiers = deriveFeeTiers(feeStats, '10');
    expect(tiers.low.feePerOperationStroops).toBe('80');
    expect(tiers.medium.feePerOperationStroops).toBe('90');
    expect(tiers.high.feePerOperationStroops).toBe('9000');
  });

  it('never recommends a tier below the network minimum, even if Horizon reports one', () => {
    const feeStats = makeFeeStats({ p10: '10', mode: '50' });
    const tiers = deriveFeeTiers(feeStats, '100');
    expect(Number(tiers.low.feePerOperationStroops)).toBeGreaterThanOrEqual(100);
    expect(Number(tiers.medium.feePerOperationStroops)).toBeGreaterThanOrEqual(100);
  });
});

describe('isSurgePricing', () => {
  it('is false when the medium tier equals the network minimum', () => {
    const tiers = deriveFeeTiers(makeFeeStats({ mode: '100' }));
    expect(isSurgePricing(tiers, '100')).toBe(false);
  });

  it('is true when the medium tier exceeds the network minimum', () => {
    const tiers = deriveFeeTiers(makeFeeStats({ mode: '500' }));
    expect(isSurgePricing(tiers, '100')).toBe(true);
  });
});

describe('isValidCustomFeeStroops', () => {
  it('accepts an integer at or above the minimum', () => {
    expect(isValidCustomFeeStroops('100', '100')).toBe(true);
    expect(isValidCustomFeeStroops('500', '100')).toBe(true);
  });

  it('rejects a value below the minimum', () => {
    expect(isValidCustomFeeStroops('50', '100')).toBe(false);
  });

  it('rejects non-integer input', () => {
    expect(isValidCustomFeeStroops('12.5', '100')).toBe(false);
    expect(isValidCustomFeeStroops('abc', '100')).toBe(false);
    expect(isValidCustomFeeStroops('', '100')).toBe(false);
    expect(isValidCustomFeeStroops('-100', '100')).toBe(false);
  });
});

describe('buildFeeEstimate', () => {
  it('computes a single-operation total using the medium tier by default', () => {
    const estimate = buildFeeEstimate({
      operationLabels: ['Send Payment'],
      feeStats: makeFeeStats({ mode: '100' }),
    });
    expect(estimate.operationCount).toBe(1);
    expect(estimate.feePerOperationStroops).toBe('100');
    expect(estimate.totalFeeStroops).toBe('100');
    expect(estimate.totalFeeXlm).toBe('0.00001');
  });

  it('multiplies the per-operation fee by the number of operations for a multi-op transaction', () => {
    const estimate = buildFeeEstimate({
      operationLabels: ['Add Trustline', 'Send Payment'],
      feeStats: makeFeeStats({ mode: '100' }),
    });
    expect(estimate.operationCount).toBe(2);
    expect(estimate.totalFeeStroops).toBe('200');
  });

  it('produces one breakdown entry per operation, each carrying the per-operation fee', () => {
    const estimate = buildFeeEstimate({
      operationLabels: ['Add Trustline', 'Send Payment', 'Set Options'],
      feeStats: makeFeeStats({ mode: '150' }),
    });
    expect(estimate.breakdown).toHaveLength(3);
    expect(estimate.breakdown.map((b) => b.label)).toEqual([
      'Add Trustline',
      'Send Payment',
      'Set Options',
    ]);
    expect(estimate.breakdown.every((b) => b.feeStroops === '150')).toBe(true);
  });

  it('treats an empty operations array as a single generic operation rather than a zero-op transaction', () => {
    const estimate = buildFeeEstimate({ operationLabels: [], feeStats: makeFeeStats() });
    expect(estimate.operationCount).toBe(1);
    expect(estimate.breakdown).toHaveLength(1);
  });

  it('honors an explicit tier selection', () => {
    const feeStats = makeFeeStats({ p10: '100', mode: '300', p95: '3000' });
    const low = buildFeeEstimate({ operationLabels: ['Send Payment'], feeStats, tier: 'low' });
    const high = buildFeeEstimate({ operationLabels: ['Send Payment'], feeStats, tier: 'high' });
    expect(low.feePerOperationStroops).toBe('100');
    expect(high.feePerOperationStroops).toBe('3000');
  });

  it('lets a custom fee override take precedence over the selected tier', () => {
    const estimate = buildFeeEstimate({
      operationLabels: ['Send Payment'],
      feeStats: makeFeeStats({ mode: '100' }),
      tier: 'low',
      customFeePerOperationStroops: '777',
    });
    expect(estimate.feePerOperationStroops).toBe('777');
  });

  it('clamps a custom fee below the network minimum up to the minimum, rather than accepting it', () => {
    const estimate = buildFeeEstimate({
      operationLabels: ['Send Payment'],
      feeStats: makeFeeStats(),
      customFeePerOperationStroops: '1',
      fallbackBaseFeeStroops: '100',
    });
    expect(estimate.feePerOperationStroops).toBe('100');
  });

  it('flags surge pricing when the network fee is above the minimum', () => {
    const estimate = buildFeeEstimate({
      operationLabels: ['Send Payment'],
      feeStats: makeFeeStats({ mode: '500' }),
    });
    expect(estimate.isSurge).toBe(true);
  });

  it('degrades gracefully to the fallback fee when feeStats is unavailable, and reports degraded: true', () => {
    const estimate = buildFeeEstimate({
      operationLabels: ['Send Payment'],
      feeStats: null,
      fallbackBaseFeeStroops: '100',
      degraded: true,
    });
    expect(estimate.degraded).toBe(true);
    expect(estimate.feePerOperationStroops).toBe('100');
    expect(estimate.totalFeeStroops).toBe('100');
  });
});

describe('checkMinimumReserve', () => {
  it('passes when the balance comfortably covers the reserve plus fee', () => {
    const result = checkMinimumReserve({
      nativeBalanceStroops: xlmToStroops('100'),
      subentryCount: 0,
      totalFeeStroops: '100',
    });
    expect(result.ok).toBe(true);
    expect(result.minimumReserveXlm).toBe('1'); // (2 + 0) * 0.5 XLM
  });

  it('fails when the fee would push the balance below the minimum reserve', () => {
    const result = checkMinimumReserve({
      // Exactly at the 1 XLM reserve floor with nothing left over for a fee.
      nativeBalanceStroops: xlmToStroops('1'),
      subentryCount: 0,
      totalFeeStroops: '100',
    });
    expect(result.ok).toBe(false);
  });

  it('accounts for a native payment amount leaving the account, not just the fee', () => {
    const result = checkMinimumReserve({
      nativeBalanceStroops: xlmToStroops('10'),
      subentryCount: 0,
      totalFeeStroops: '100',
      nativeAmountSpentStroops: xlmToStroops('9.5'),
    });
    // 10 - 9.5 - (100 stroops) leaves just under 0.5 XLM, below the 1 XLM reserve.
    expect(result.ok).toBe(false);
  });

  it('raises the minimum reserve for each subentry (e.g. a trustline)', () => {
    const zeroSubentries = checkMinimumReserve({
      nativeBalanceStroops: xlmToStroops('2'),
      subentryCount: 0,
      totalFeeStroops: '0',
    });
    const threeSubentries = checkMinimumReserve({
      nativeBalanceStroops: xlmToStroops('2'),
      subentryCount: 3,
      totalFeeStroops: '0',
    });
    expect(zeroSubentries.ok).toBe(true); // needs 1 XLM, has 2
    expect(threeSubentries.ok).toBe(false); // needs (2+3)*0.5 = 2.5 XLM, has 2
  });

  it('is exactly at the boundary when balance equals the minimum reserve (still ok)', () => {
    const result = checkMinimumReserve({
      nativeBalanceStroops: xlmToStroops('2'), // (2 + 2) * 0.5 = 2 XLM minimum
      subentryCount: 2,
      totalFeeStroops: '0',
    });
    expect(result.ok).toBe(true);
    expect(result.remainingAfterStroops).toBe(result.minimumReserveStroops);
  });

  it('honors a custom base reserve override', () => {
    const result = checkMinimumReserve({
      nativeBalanceStroops: xlmToStroops('100'),
      subentryCount: 0,
      totalFeeStroops: '0',
      baseReserveStroops: BASE_RESERVE_STROOPS,
    });
    expect(result.minimumReserveXlm).toBe('1');
  });
});
