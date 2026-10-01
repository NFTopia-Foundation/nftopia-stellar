// Pure data-shaping helpers for the Receive screen. No native imports, kept
// side-effect free so they're cheap to unit test independently of rendering.

export interface AcceptedAssetsBalance {
  tokens?: { asset_code: string }[] | null;
}

/** Every asset this account currently accepts — XLM always, plus one entry
 * per trustline already reflected in its loaded token balances. */
export function getAcceptedAssetCodes(balance: AcceptedAssetsBalance | null | undefined): string[] {
  const codes = ['XLM', ...(balance?.tokens?.map((t) => t.asset_code) ?? [])];
  return Array.from(new Set(codes));
}

/** Multi-wallet-aware label shown above the QR code. */
export function getWalletLabel(walletCount: number, activeIndex: number): string {
  if (walletCount <= 1 || activeIndex < 0) return 'Active Wallet';
  return `Wallet ${activeIndex + 1} of ${walletCount}`;
}

export type ReceiveNetwork = 'testnet' | 'mainnet';

export function getNetworkBadgeLabel(network: ReceiveNetwork): string {
  return network === 'mainnet' ? 'Mainnet' : 'Testnet';
}
