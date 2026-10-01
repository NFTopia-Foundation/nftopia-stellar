/**
 * Config resolution for the payment module's Stripe webhook integration
 * (#532). Pure function over an env-like object — same convention as
 * email.config.ts / stellar.config.ts — so it's unit-testable without
 * constructing the Stripe SDK.
 */
export interface PaymentConfig {
  /** Required to verify a Stripe webhook signature. Without it, the
   * webhook endpoint refuses to process events rather than skip
   * verification. */
  stripeWebhookSecret?: string;
  /** Required to construct the Stripe SDK client at all (even though
   * signature verification itself doesn't call the Stripe API). */
  stripeSecretKey?: string;
  /** True only when both of the above are present. */
  stripeConfigured: boolean;
}

export function getPaymentConfig(
  env: NodeJS.ProcessEnv = process.env,
): PaymentConfig {
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET || undefined;
  const stripeSecretKey = env.STRIPE_SECRET_KEY || undefined;

  return {
    stripeWebhookSecret,
    stripeSecretKey,
    stripeConfigured: Boolean(stripeWebhookSecret && stripeSecretKey),
  };
}
