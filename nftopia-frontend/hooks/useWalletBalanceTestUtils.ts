import type { WalletAssetBalance } from "./useWalletBalance";

export function getBalanceFromList(
  balances: WalletAssetBalance[],
  assetCode: string,
): number | null {
  const code = assetCode.toUpperCase() === "NATIVE" ? "XLM" : assetCode.toUpperCase();
  const row = balances.find((b) => b.asset.toUpperCase() === code);
  if (!row) return null;
  const n = parseFloat(row.balance);
  return Number.isFinite(n) ? n : null;
}
