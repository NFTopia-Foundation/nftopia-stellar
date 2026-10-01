import { isWalletConnectUri, parseWalletConnectUri } from './walletConnectUri';

describe('isWalletConnectUri', () => {
  it('accepts a v1-style pairing URI', () => {
    expect(
      isWalletConnectUri(
        'wc:8a5e5bdc-a0e4-47b3@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=41791102',
      ),
    ).toBe(true);
  });

  it('accepts a v2-style pairing URI', () => {
    expect(
      isWalletConnectUri('wc:7f6e504bfad@2?relay-protocol=irn&symKey=587d5484ce'),
    ).toBe(true);
  });

  it('rejects a Stellar address', () => {
    expect(
      isWalletConnectUri('GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX'),
    ).toBe(false);
  });

  it('rejects an arbitrary string', () => {
    expect(isWalletConnectUri('not a qr code at all')).toBe(false);
  });

  it('rejects a wc: uri missing the version/params', () => {
    expect(isWalletConnectUri('wc:topic-only')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isWalletConnectUri('')).toBe(false);
  });
});

describe('parseWalletConnectUri', () => {
  it('extracts topic, version, and params from a v1 URI', () => {
    const parsed = parseWalletConnectUri(
      'wc:8a5e5bdc-a0e4-47b3@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=41791102',
    );
    expect(parsed).toEqual({
      topic: '8a5e5bdc-a0e4-47b3',
      version: 1,
      params: {
        bridge: 'https://bridge.walletconnect.org',
        key: '41791102',
      },
    });
  });

  it('extracts topic, version, and params from a v2 URI', () => {
    const parsed = parseWalletConnectUri('wc:7f6e504bfad@2?relay-protocol=irn&symKey=587d5484ce');
    expect(parsed).toEqual({
      topic: '7f6e504bfad',
      version: 2,
      params: { 'relay-protocol': 'irn', symKey: '587d5484ce' },
    });
  });

  it('returns null for malformed input', () => {
    expect(parseWalletConnectUri('wc:no-version-or-params')).toBeNull();
  });

  it('returns null for a non-WalletConnect string', () => {
    expect(parseWalletConnectUri('https://nftopia.io/nft/abc')).toBeNull();
  });
});
