import * as Handlebars from 'handlebars';
import { EmailTemplateService } from './template.service';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  it('renders the verification-email template with interpolated values', () => {
    const { html } = service.render('verification-email', {
      username: 'builder',
      verificationUrl: 'https://nftopia.com/verify-email?token=abc123',
    });

    expect(html).toContain('builder');
    expect(html).toContain('https://nftopia.com/verify-email?token=abc123');
    expect(html).toContain('Confirm your email address');
  });

  it('renders the password-reset template with interpolated values', () => {
    const { html } = service.render('password-reset', {
      username: 'builder',
      resetUrl: 'https://nftopia.com/reset-password?token=xyz789',
    });

    expect(html).toContain('https://nftopia.com/reset-password?token=xyz789');
    expect(html).toContain('Reset your password');
  });

  it('renders the password-changed security notification', () => {
    const { html, text } = service.render('password-changed', {
      username: 'builder',
    });

    expect(html).toContain('Hi builder');
    expect(html).toContain('password for your NFTopia account was changed');
    expect(text).toContain('contact NFTopia support');
  });

  it('renders the bid-notification template with interpolated values', () => {
    const { html } = service.render('bid-notification', {
      username: 'seller1',
      auctionId: 'auction-42',
      amount: '150.00',
      auctionUrl: 'https://nftopia.com/auctions/auction-42',
    });

    expect(html).toContain('150.00 XLM');
    expect(html).toContain('auction-42');
  });

  it('renders the auction-won template with interpolated values', () => {
    const { html } = service.render('auction-won', {
      username: 'bidder1',
      auctionId: 'auction-42',
      nftName: 'Stellar Punk #7',
      auctionUrl: 'https://nftopia.com/auctions/auction-42',
    });

    expect(html).toContain('Stellar Punk #7');
  });

  it('derives a plain-text fallback stripped of HTML tags', () => {
    const { text } = service.render('verification-email', {
      username: 'builder',
      verificationUrl: 'https://nftopia.com/verify-email?token=abc123',
    });

    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
    expect(text).toContain('builder');
  });

  it('caches compiled templates across repeated renders', () => {
    const compileSpy = jest.spyOn(Handlebars, 'compile');

    service.render('verification-email', {
      username: 'a',
      verificationUrl: 'https://x',
    });
    expect(compileSpy).toHaveBeenCalledTimes(1);

    service.render('verification-email', {
      username: 'b',
      verificationUrl: 'https://y',
    });

    // Second render reuses the cached compiled template — no extra compile call.
    expect(compileSpy).toHaveBeenCalledTimes(1);
    compileSpy.mockRestore();
  });

  it('throws when the template does not exist', () => {
    expect(() => service.render('does-not-exist', {})).toThrow();
  });
});
