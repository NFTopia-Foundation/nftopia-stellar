import { getAcceptedAssetCodes, getWalletLabel, getNetworkBadgeLabel } from './receiveViewModel';

describe('getAcceptedAssetCodes', () => {
  it('always includes XLM', () => {
    expect(getAcceptedAssetCodes(null)).toEqual(['XLM']);
  });

  it('includes each trustline asset code alongside XLM', () => {
    expect(
      getAcceptedAssetCodes({ tokens: [{ asset_code: 'USDC' }, { asset_code: 'AQUA' }] }),
    ).toEqual(['XLM', 'USDC', 'AQUA']);
  });

  it('de-duplicates asset codes', () => {
    expect(
      getAcceptedAssetCodes({ tokens: [{ asset_code: 'USDC' }, { asset_code: 'USDC' }] }),
    ).toEqual(['XLM', 'USDC']);
  });

  it('handles an undefined tokens array', () => {
    expect(getAcceptedAssetCodes({})).toEqual(['XLM']);
  });

  it('handles undefined balance entirely', () => {
    expect(getAcceptedAssetCodes(undefined)).toEqual(['XLM']);
  });
});

describe('getWalletLabel', () => {
  it('labels a single wallet generically', () => {
    expect(getWalletLabel(1, 0)).toBe('Active Wallet');
  });

  it('labels one of several wallets by position', () => {
    expect(getWalletLabel(3, 1)).toBe('Wallet 2 of 3');
  });

  it('falls back to generic when the active wallet is not found', () => {
    expect(getWalletLabel(3, -1)).toBe('Active Wallet');
  });

  it('labels generically when there are zero wallets', () => {
    expect(getWalletLabel(0, -1)).toBe('Active Wallet');
  });
});

describe('getNetworkBadgeLabel', () => {
  it('labels mainnet', () => {
    expect(getNetworkBadgeLabel('mainnet')).toBe('Mainnet');
  });

  it('labels testnet', () => {
    expect(getNetworkBadgeLabel('testnet')).toBe('Testnet');
  });
});
