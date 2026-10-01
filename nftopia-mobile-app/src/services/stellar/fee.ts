import { Horizon } from 'stellar-sdk';

/**
 * Fee/reserve math for #471, kept as pure functions independent of any
 * live Horizon connection so they're cheap to unit test — wallet.service.ts
 * wires these to real network calls (feeStats/fetchBaseFee/loadAccount).
 */

export const STROOPS_PER_XLM = 10_000_000;

/** Network-wide protocol minimum fee per operation, in stroops. Used as the
 * final fallback when Horizon's fee stats are unavailable (degraded mode). */
export const DEFAULT_BASE_FEE_STROOPS = '100';

/** Protocol-wide base reserve per subentry, in stroops (0.5 XLM). Stable
 * since Stellar's mainnet genesis — not worth an extra network round trip
 * to fetch per estimate. */
export const BASE_RESERVE_STROOPS = '5000000';

export type FeeTierName = 'low' | 'medium' | 'high';

export interface FeeTierEstimate {
  tier: FeeTierName;
  feePerOperationStroops: string;
}

export interface OperationFeeBreakdownItem {
  label: string;
  feeStroops: string;
  feeXlm: string;
}

export interface FeeEstimate {
  operationCount: number;
  feePerOperationStroops: string;
  totalFeeStroops: string;
  totalFeeXlm: string;
  tiers: Record<FeeTierName, FeeTierEstimate>;
  breakdown: OperationFeeBreakdownItem[];
  /** True when the network's recommended fee is above the protocol
   * minimum — i.e. there's real congestion/surge pricing right now. */
  isSurge: boolean;
  /** True when live fee stats couldn't be fetched and this estimate falls
   * back to a simpler/default source — surfaced so the UI can say so
   * rather than silently presenting a possibly-stale number as current. */
  degraded: boolean;
}

/** stroops (integer, as a string or number) -> XLM decimal string, trimmed of trailing zeros. */
export function stroopsToXlm(stroops: string | number): string {
  const n = typeof stroops === 'string' ? Number(stroops) : stroops;
  if (!Number.isFinite(n)) return '0';
  const xlm = n / STROOPS_PER_XLM;
  const fixed = xlm.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
  return fixed || '0';
}

/** XLM decimal string (or number) -> stroops, rounded to the nearest integer. */
export function xlmToStroops(xlm: string | number): string {
  const n = typeof xlm === 'string' ? Number(xlm) : xlm;
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * STROOPS_PER_XLM));
}

/**
 * Derives low/medium/high per-operation fee tiers from Horizon's
 * /fee_stats response. `fee_charged` (what recent transactions actually
 * paid) is used rather than `max_fee` (what submitters were willing to
 * pay) — it's the more honest signal of what's actually required to land
 * a transaction right now.
 *
 * `fallbackBaseFeeStroops` is used verbatim for every tier when
 * `feeStats` is null (fully degraded — see estimateFee), and as the floor
 * every tier is clamped to otherwise: never recommend a fee Horizon would
 * reject as below the network minimum, even if a distribution value comes
 * back surprisingly low.
 */
export function deriveFeeTiers(
  feeStats: Horizon.HorizonApi.FeeStatsResponse | null,
  fallbackBaseFeeStroops: string = DEFAULT_BASE_FEE_STROOPS,
): Record<FeeTierName, FeeTierEstimate> {
  if (!feeStats) {
    return {
      low: { tier: 'low', feePerOperationStroops: fallbackBaseFeeStroops },
      medium: { tier: 'medium', feePerOperationStroops: fallbackBaseFeeStroops },
      high: { tier: 'high', feePerOperationStroops: fallbackBaseFeeStroops },
    };
  }

  const floor = Number(fallbackBaseFeeStroops);
  const clamp = (value: string | undefined): string =>
    String(Math.max(Number(value) || 0, floor));

  const low = feeStats.fee_charged.p10 || feeStats.fee_charged.min;
  const medium = feeStats.fee_charged.mode || feeStats.fee_charged.p50;
  const high = feeStats.fee_charged.p95 || feeStats.fee_charged.max;

  return {
    low: { tier: 'low', feePerOperationStroops: clamp(low) },
    medium: { tier: 'medium', feePerOperationStroops: clamp(medium) },
    high: { tier: 'high', feePerOperationStroops: clamp(high) },
  };
}

/** True when the network's current recommended (medium-tier) fee is above the protocol minimum — surge/congestion pricing is in effect. */
export function isSurgePricing(
  tiers: Record<FeeTierName, FeeTierEstimate>,
  baseFeeStroops: string = DEFAULT_BASE_FEE_STROOPS,
): boolean {
  return Number(tiers.medium.feePerOperationStroops) > Number(baseFeeStroops);
}

export function isValidCustomFeeStroops(value: string, minimumStroops: string): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  return Number(value) >= Number(minimumStroops);
}

export interface BuildFeeEstimateParams {
  /** One label per operation in the transaction, e.g. ['Add Trustline', 'Send Payment'] — length determines the operation count. Defaults to a single generic operation if empty. */
  operationLabels: string[];
  feeStats: Horizon.HorizonApi.FeeStatsResponse | null;
  fallbackBaseFeeStroops?: string;
  tier?: FeeTierName;
  /** Advanced/power-user override — takes precedence over `tier` when given. Clamped to the network minimum, never allowed to go lower (Horizon would reject it). */
  customFeePerOperationStroops?: string;
  degraded?: boolean;
}

export function buildFeeEstimate({
  operationLabels,
  feeStats,
  fallbackBaseFeeStroops = DEFAULT_BASE_FEE_STROOPS,
  tier = 'medium',
  customFeePerOperationStroops,
  degraded = false,
}: BuildFeeEstimateParams): FeeEstimate {
  const labels = operationLabels.length > 0 ? operationLabels : ['Transaction'];
  const operationCount = labels.length;

  const tiers = deriveFeeTiers(feeStats, fallbackBaseFeeStroops);

  const feePerOperationStroops = customFeePerOperationStroops
    ? String(Math.max(Number(customFeePerOperationStroops) || 0, Number(fallbackBaseFeeStroops)))
    : tiers[tier].feePerOperationStroops;

  const totalFeeStroops = String(Number(feePerOperationStroops) * operationCount);

  const breakdown: OperationFeeBreakdownItem[] = labels.map((label) => ({
    label,
    feeStroops: feePerOperationStroops,
    feeXlm: stroopsToXlm(feePerOperationStroops),
  }));

  return {
    operationCount,
    feePerOperationStroops,
    totalFeeStroops,
    totalFeeXlm: stroopsToXlm(totalFeeStroops),
    tiers,
    breakdown,
    isSurge: isSurgePricing(tiers, fallbackBaseFeeStroops),
    degraded,
  };
}

export interface ReserveCheckParams {
  nativeBalanceStroops: string;
  subentryCount: number;
  totalFeeStroops: string;
  /** Native XLM leaving the account as part of the operation itself (e.g. a native-asset payment amount, or create_account's starting balance) — 0 for anything that doesn't spend XLM directly (a non-native payment, a trustline change). */
  nativeAmountSpentStroops?: string;
  baseReserveStroops?: string;
}

export interface ReserveCheckResult {
  ok: boolean;
  minimumReserveStroops: string;
  minimumReserveXlm: string;
  remainingAfterStroops: string;
  remainingAfterXlm: string;
}

/** (2 + subentry_count) * base_reserve — see https://developers.stellar.org/docs/learn/fundamentals/lumens#minimum-balance */
export function checkMinimumReserve({
  nativeBalanceStroops,
  subentryCount,
  totalFeeStroops,
  nativeAmountSpentStroops = '0',
  baseReserveStroops = BASE_RESERVE_STROOPS,
}: ReserveCheckParams): ReserveCheckResult {
  const minimumReserveStroops = (2 + subentryCount) * Number(baseReserveStroops);
  const spent = Number(totalFeeStroops) + Number(nativeAmountSpentStroops);
  const remainingAfterStroops = Number(nativeBalanceStroops) - spent;

  return {
    ok: remainingAfterStroops >= minimumReserveStroops,
    minimumReserveStroops: String(minimumReserveStroops),
    minimumReserveXlm: stroopsToXlm(minimumReserveStroops),
    remainingAfterStroops: String(remainingAfterStroops),
    remainingAfterXlm: stroopsToXlm(remainingAfterStroops),
  };
}
