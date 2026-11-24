/**
 * Redaction applied to AI chat message content before it's persisted to
 * `chat_messages` (#646). This runs only on the copy written to the
 * database — `AiAgentService` calls `ChatSessionService.appendExchange`
 * (which applies this) only *after* the live Anthropic request/response
 * has already completed with the original, unredacted text, so redaction
 * never affects the model's own input or the reply shown to the user. It
 * only reduces what a database compromise, backup leak, or admin tool-log
 * view could expose.
 *
 * Scope: this targets a few structurally-distinctive PII patterns —
 * email addresses, phone numbers, long digit runs shaped like card
 * numbers, and Stellar secret seeds (never public `G...` addresses, which
 * are routinely and legitimately discussed in marketplace questions).
 * It is a best-effort scrub, not a guarantee: free-text PII that doesn't
 * match one of these shapes (a name, a home address written in prose,
 * a partially-typed secret) will not be caught. Treat this as reducing
 * exposure, not as a compliance control on its own.
 */

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Stellar secret seed: 'S' followed by 55 base32 characters. Never matches
// a public address ('G...'), which is fine to discuss in chat. Run before
// the digit-run pattern below so a secret's digit characters never get
// mistaken for a phone/card number.
const STELLAR_SECRET_KEY_PATTERN = /\bS[A-Z2-7]{55}\b/g;

// One digit, then 6-18 more units of "optional separator(s) + digit" — so
// every match starts and ends on an actual digit and never swallows a
// trailing space or punctuation mark. Total digits per match: 7-19,
// covering both phone numbers and card numbers in one pass so a single
// long run is classified once instead of double-matched by two patterns.
// `()` and `-` cover common phone grouping; prices ("15.5") and ordinary
// short numbers ("42", a token id) never reach the 7-digit minimum.
const DIGIT_RUN_PATTERN = /\+?\d(?:[\s().-]*\d){6,18}/g;

function classifyDigitRun(match: string): string | null {
  const digitCount = match.replace(/\D/g, '').length;
  if (digitCount >= 13 && digitCount <= 19) return '[REDACTED_CARD_NUMBER]';
  if (digitCount >= 7 && digitCount <= 12) return '[REDACTED_PHONE]';
  return null;
}

/**
 * Scrubs PII-shaped substrings from `text`, replacing each with a
 * `[REDACTED_<KIND>]` marker. Safe to call on content with no PII at all -
 * it returns the input unchanged in that case.
 */
export function redactPii(text: string): string {
  if (!text) {
    return text;
  }

  return text
    .replace(STELLAR_SECRET_KEY_PATTERN, '[REDACTED_SECRET_KEY]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(DIGIT_RUN_PATTERN, (match) => classifyDigitRun(match) ?? match);
}
