import { classifyQrContent } from './qrScan';

// A syntactically valid Ed25519 Stellar public key (StrKey checksum-valid).
const VALID_ADDRESS = 'GD354666HPEK53O4KYM2M56LNBYLO4O5VANRCFHWJHEQGFCUJ6MNLDDA';

describe('classifyQrContent', () => {
  it('classifies a valid Stellar address', () => {
    expect(classifyQrContent(VALID_ADDRESS)).toEqual({
      type: 'stellar-address',
      address: VALID_ADDRESS,
      raw: VALID_ADDRESS,
    });
  });

  it('trims whitespace before validating an address', () => {
    const result = classifyQrContent(`  ${VALID_ADDRESS}  `);
    expect(result.type).toBe('stellar-address');
    expect(result.address).toBe(VALID_ADDRESS);
  });

  it('classifies a WalletConnect pairing URI', () => {
    const uri = 'wc:8a5e5bdc-a0e4-47b3@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=41791102';
    expect(classifyQrContent(uri)).toEqual({
      type: 'wallet-connect-uri',
      uri,
      raw: uri,
    });
  });

  it('classifies unrecognized content as unknown, not a crash', () => {
    expect(classifyQrContent('https://example.com/not-a-wallet-thing')).toEqual({
      type: 'unknown',
      raw: 'https://example.com/not-a-wallet-thing',
    });
  });

  it('classifies an address with an invalid checksum as unknown', () => {
    const almostValid = VALID_ADDRESS.slice(0, -1) + (VALID_ADDRESS.endsWith('Y') ? 'X' : 'Y');
    expect(classifyQrContent(almostValid).type).toBe('unknown');
  });

  it('classifies empty content as unknown', () => {
    expect(classifyQrContent('').type).toBe('unknown');
  });
});
