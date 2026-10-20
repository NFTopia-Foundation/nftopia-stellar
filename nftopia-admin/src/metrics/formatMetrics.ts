/**
 * Pure formatting helpers for platform metrics.
 * Designed with O(1) time and space complexity.
 */

/**
 * Formats an integer count with thousands separators using en-US locale.
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export function formatCount(count: number | null | undefined): string {
  if (count === null || count === undefined || !Number.isFinite(count) || count < 0) {
    return '0'
  }
  return new Intl.NumberFormat('en-US').format(Math.floor(count))
}

/**
 * Formats a trading volume amount in Stellar native currency (XLM) or provided asset.
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export function formatVolume(volume: number | null | undefined, currency = 'XLM'): string {
  if (volume === null || volume === undefined || !Number.isFinite(volume) || volume < 0) {
    return `0.00 ${currency}`
  }
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(volume)
  return `${formatted} ${currency}`
}
