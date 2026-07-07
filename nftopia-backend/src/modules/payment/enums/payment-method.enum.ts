export enum PaymentMethod {
  XLM = 'XLM',
  USDC = 'USDC',
  BUNDLE = 'BUNDLE',
  CREDIT_CARD = 'CREDIT_CARD',
  STRIPE = 'STRIPE',
}

export const SUPPORTED_PAYMENT_METHODS = [
  PaymentMethod.XLM,
  PaymentMethod.USDC,
  PaymentMethod.BUNDLE,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.STRIPE,
] as const;

export const NATIVE_PAYMENT_METHODS = [
  PaymentMethod.XLM,
  PaymentMethod.USDC,
] as const;

export const OFFCHAIN_PAYMENT_METHODS = [
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.STRIPE,
] as const;