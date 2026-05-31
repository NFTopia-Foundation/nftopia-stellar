import { GLOBAL_ALLOWED_FIELDS, CATEGORY_ALLOWED_FIELDS, ALWAYS_BLOCKED_FIELDS } from "./allowlist";

export interface SanitizeOptions {
  category?: string;
  debug?: boolean;
  maxStringLength?: number;
}

const DEFAULT_MAX_STRING_LENGTH = 256;

function logStrip(category: string, key: string, reason: string, debug: boolean) {
  // Log if debug mode is enabled (option or env)
  if (debug || process.env.NEXT_PUBLIC_TELEMETRY_DEBUG === "true") {
    // eslint-disable-next-line no-console
    console.log(`[telemetry][strip] ${category}: ${key} (${reason})`);
  }
}

export function sanitizePayload<T extends Record<string, unknown>>(
  payload: T,
  options?: SanitizeOptions
): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const { category = "", debug = false, maxStringLength = DEFAULT_MAX_STRING_LENGTH } = options || {};
  // Only allow global fields and category fields for the current category
  const allowed = new Set<string>([...GLOBAL_ALLOWED_FIELDS]);
  if (category && CATEGORY_ALLOWED_FIELDS[category]) {
    for (const field of CATEGORY_ALLOWED_FIELDS[category]) {
      allowed.add(field);
    }
  }
  const blocked = new Set<string>(ALWAYS_BLOCKED_FIELDS);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.has(key)) {
      logStrip(category, key, "always-blocked", debug);
      continue;
    }
    if (!allowed.has(key)) {
      logStrip(category, key, "not-in-allowlist", debug);
      continue;
    }
    if (value === null || value === undefined) {
      logStrip(category, key, "null-or-undefined", debug);
      continue;
    }
    if (typeof value === "string" && value.length > maxStringLength) {
      logStrip(category, key, "string-truncated", debug);
      result[key] = value.slice(0, maxStringLength);
      continue;
    }
    result[key] = value;
  }
  return result;
}
