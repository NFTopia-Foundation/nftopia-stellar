// Simple telemetry payload sanitizer (stub)
/**
 * Removes common PII and sensitive fields from telemetry payloads.
 * - Removes keys like 'email', 'password', 'token', 'ssn', 'creditCard', 'phone', 'address', 'name', 'dob', 'birthdate', 'userInput', 'formValue'.
 * - Recursively sanitizes nested objects and arrays.
 */
const SENSITIVE_KEYS = [
  'email', 'password', 'token', 'ssn', 'creditCard', 'phone', 'address', 'name', 'dob', 'birthdate', 'userInput', 'formValue',
];

export function sanitizeTelemetryPayload<T>(payload: T): T {
  function sanitize(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const clean: any = {};
      for (const key of Object.keys(obj)) {
        if (SENSITIVE_KEYS.includes(key)) continue;
        clean[key] = sanitize(obj[key]);
      }
      return clean;
    }
    return obj;
  }
  return sanitize(payload);
}

