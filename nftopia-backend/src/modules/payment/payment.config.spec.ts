import { getPaymentConfig } from './payment.config';

describe('getPaymentConfig', () => {
  it('is not configured when both Stripe vars are absent', () => {
    const config = getPaymentConfig({});
    expect(config.stripeConfigured).toBe(false);
    expect(config.stripeSecretKey).toBeUndefined();
    expect(config.stripeWebhookSecret).toBeUndefined();
  });

  it('is not configured when only the secret key is present', () => {
    const config = getPaymentConfig({
      STRIPE_SECRET_KEY: 'sk_test_123',
    });
    expect(config.stripeConfigured).toBe(false);
  });

  it('is not configured when only the webhook secret is present', () => {
    const config = getPaymentConfig({
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
    });
    expect(config.stripeConfigured).toBe(false);
  });

  it('is configured when both Stripe vars are present', () => {
    const config = getPaymentConfig({
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
    });
    expect(config.stripeConfigured).toBe(true);
    expect(config.stripeSecretKey).toBe('sk_test_123');
    expect(config.stripeWebhookSecret).toBe('whsec_123');
  });

  it('treats an empty string as absent', () => {
    const config = getPaymentConfig({
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
    });
    expect(config.stripeConfigured).toBe(false);
  });
});
