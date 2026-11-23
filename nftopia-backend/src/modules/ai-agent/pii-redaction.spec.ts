import { redactPii } from './pii-redaction';

describe('redactPii (#646)', () => {
  it('redacts an email address', () => {
    expect(redactPii('Contact me at jane.doe@example.com please')).toBe(
      'Contact me at [REDACTED_EMAIL] please',
    );
  });

  it('redacts a phone number', () => {
    expect(redactPii('Call me at 555-123-4567 tomorrow')).toBe(
      'Call me at [REDACTED_PHONE] tomorrow',
    );
    expect(redactPii('My number is +1 (555) 123-4567')).toBe(
      'My number is [REDACTED_PHONE]',
    );
  });

  it('redacts a card-number-shaped digit run', () => {
    expect(redactPii('My card is 4111111111111111 expiring soon')).toBe(
      'My card is [REDACTED_CARD_NUMBER] expiring soon',
    );
    expect(redactPii('4111 1111 1111 1111')).toBe('[REDACTED_CARD_NUMBER]');
  });

  it('redacts a Stellar secret seed but never a public address', () => {
    const secret = 'S' + 'A'.repeat(55);
    const pub = 'G' + 'A'.repeat(55);

    expect(redactPii(`my seed is ${secret}`)).toBe(
      'my seed is [REDACTED_SECRET_KEY]',
    );
    expect(redactPii(`send it to ${pub}`)).toBe(`send it to ${pub}`);
  });

  it('does not mangle ordinary marketplace questions', () => {
    const question =
      'What is the floor price for collection #42 and does it support offers under 10 XLM?';
    expect(redactPii(question)).toBe(question);
  });

  it('does not redact a short token id or auction amount', () => {
    expect(redactPii('Token id 42 sold for 15.5 XLM')).toBe(
      'Token id 42 sold for 15.5 XLM',
    );
  });

  it('does not redact a transaction hash (hex, not a run of decimal digits)', () => {
    const txHash =
      'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
    expect(redactPii(`tx ${txHash} confirmed`)).toBe(`tx ${txHash} confirmed`);
  });

  it('handles empty and null-ish input without throwing', () => {
    expect(redactPii('')).toBe('');
  });

  it('redacts multiple PII instances across different kinds in one message', () => {
    const input =
      'Email me at a@b.com or call 555-987-6543, my card is 4000123456789010.';
    expect(redactPii(input)).toBe(
      'Email me at [REDACTED_EMAIL] or call [REDACTED_PHONE], my card is [REDACTED_CARD_NUMBER].',
    );
  });
});
