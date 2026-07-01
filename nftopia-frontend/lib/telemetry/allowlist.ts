// Telemetry payload allowlist and blocklist definitions

export const GLOBAL_ALLOWED_FIELDS = [
  "latency_ms",
  "error_code",
  "status",
  "has_image",
  "field_count",
  "validation_error_count",
  "cta_id",
  "placement",
  "destination_route",
  "surface",
  "component_name",
  "error_message",
] as const;

export const CATEGORY_ALLOWED_FIELDS: Record<string, readonly string[]> = {
  wallet: [
    "provider",
    "surface",
    "latency_ms",
    "error_code",
  ],
  auth: [
    "auth_method",
    "validation_error_count",
    "server_error_code",
    "latency_ms",
  ],
  creator: [
    "has_image",
    "field_count",
    "error_code",
    "latency_ms",
  ],
  marketplace: [
    "listing_type",
    "field_count",
    "error_code",
    "latency_ms",
  ],
  navigation: [
    "cta_id",
    "placement",
    "destination_route",
  ],
};

export const ALWAYS_BLOCKED_FIELDS = [
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "password",
  "secret",
  "private_key",
  "seed_phrase",
  "mnemonic",
  "email",
  "username",
  "bio",
  "wallet_address",
  "account_id",
  "credit_card",
  "ip_address",
  "stack_trace",
  "full_error",
] as const;
