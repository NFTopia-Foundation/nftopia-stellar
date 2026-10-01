import { Injectable, Logger } from '@nestjs/common';

/**
 * Result returned by PromptInjectionService.screen().
 */
export interface ScreeningResult {
  /** True when the message triggered at least one injection/jailbreak pattern. */
  flagged: boolean;
  /** The pattern category that first matched, or null when clean. */
  category: string | null;
  /** Human-readable reason for rejection, suitable for an error response. */
  reason: string | null;
}

/**
 * A single detection rule: a compiled regex and the category name it
 * represents.  Categories are intentionally coarse — they should name the
 * *class* of attack rather than any specific payload, so log entries don't
 * leak the exact injection text back through aggregation dashboards.
 */
interface DetectionRule {
  category: string;
  pattern: RegExp;
}

/**
 * Lightweight, heuristic prompt-injection / jailbreak pre-screener.
 *
 * This service runs *before* any message reaches the Anthropic API, catching
 * the most common attack families with a set of compiled regular expressions.
 * It is intentionally conservative on false-positives: patterns are anchored
 * to structural injection markers rather than surface topic words, so a
 * legitimate user asking *about* jailbreaks or system prompts in plain prose
 * is not blocked.
 *
 * ## Detection categories
 * | Category                  | What it catches                                      |
 * |---------------------------|------------------------------------------------------|
 * | `system-prompt-override`  | Attempts to replace or reveal the system prompt      |
 * | `role-play-jailbreak`     | "DAN", "pretend you are", "you are now X" framing    |
 * | `instruction-override`    | "ignore previous instructions", "disregard your…"   |
 * | `tool-exfiltration`       | Requests to list or reveal tool definitions          |
 * | `delimiter-injection`     | Raw XML/JSON/markdown structural delimiters          |
 * | `context-manipulation`    | Attempts to inject fake assistant/user turns         |
 *
 * ## Limitations
 * Heuristic matching is a mitigation layer, not a guarantee. A sufficiently
 * obfuscated message may evade these patterns. This service complements —
 * but does not replace — the model-level system prompt, tool-set allowlisting
 * (#492), and content-flag review pipeline.
 */
@Injectable()
export class PromptInjectionService {
  private readonly logger = new Logger(PromptInjectionService.name);

  /**
   * Ordered list of detection rules.  Rules are checked in order; the first
   * match wins and short-circuits the rest.
   */
  private readonly rules: DetectionRule[] = [
    // ── delimiter-injection ───────────────────────────────────────────────
    // Checked FIRST so markdown section headers (## System, ### Instructions)
    // are caught by this category before the more-general instruction-override
    // patterns below pick them up.
    {
      category: 'delimiter-injection',
      pattern: /<\/?(?:system|instructions?|prompt|assistant|user|tool)\b/i,
    },
    {
      category: 'delimiter-injection',
      // Markdown "## System" / "### Instructions" style section headers
      pattern: /^#{1,6}\s*(?:system|instructions?|prompt|override)\b/im,
    },
    // ── context-manipulation ──────────────────────────────────────────────
    // Injecting fake conversation turns by prefixing with "SYSTEM:", "Human:",
    // "Assistant:" etc. at the start of a line.
    {
      category: 'context-manipulation',
      pattern:
        /^(?:system|human|assistant|ai|bot|user|instructions?)\s*:/im,
    },
    // ── system-prompt-override ────────────────────────────────────────────
    // Attempts to view, replace, or append to the system prompt.
    {
      category: 'system-prompt-override',
      // Catches: "ignore/reveal/show/override [the|your] system instructions/prompt"
      // and "reveal/show [me] your [hidden/initial/original] instructions" etc.
      pattern:
        /(?:ignore|disregard|forget|override|bypass|replace|reveal|print|show|output|repeat|display|leak)\s+(?:(?:me|us)\s+)?(?:the\s+|your\s+)?(?:hidden\s+|initial\s+|original\s+)?(?:system\s+(?:prompt|instructions?)|instructions?|your\s+instructions?|hidden\s+instructions?)/i,
    },
    {
      category: 'system-prompt-override',
      pattern:
        /(?:what(?:'s|\s+is|\s+are)?\s+(?:your|the)\s+(?:system\s+prompt|system\s+instructions?|hidden\s+instructions?|initial\s+prompt))/i,
    },
    // ── instruction-override ──────────────────────────────────────────────
    // "Ignore all previous instructions" and close variants.
    {
      category: 'instruction-override',
      pattern:
        /(?:ignore|disregard|forget|bypass|override|skip)\s+(?:all\s+)?(?:previous|prior|above|earlier|preceding|the\s+(?:above|previous|prior))\s+(?:instructions?|directives?|rules?|prompts?|context|constraints?)/i,
    },
    {
      category: 'instruction-override',
      pattern:
        /(?:do\s+not\s+follow|stop\s+following|you\s+(?:must\s+not|should\s+not|don'?t\s+need\s+to)\s+follow)\s+(?:your\s+)?(?:instructions?|rules?|guidelines?|constraints?)/i,
    },
    // ── role-play-jailbreak ───────────────────────────────────────────────
    // "DAN", "pretend you have no restrictions", "you are now X" etc.
    {
      category: 'role-play-jailbreak',
      pattern: /\bDAN\b|\bdo\s+anything\s+now\b/i,
    },
    {
      category: 'role-play-jailbreak',
      pattern:
        /(?:pretend|act|behave|respond)\s+(?:as\s+if|like|as\s+though)\s+(?:you\s+(?:have\s+no|are\s+free\s+from|are\s+without)\s+(?:restrictions?|limitations?|guidelines?|rules?|filters?))/i,
    },
    {
      category: 'role-play-jailbreak',
      // "you are now an unrestricted AI model", "you are now a jailbroken AI model", etc.
      // The noun phrase after the adjective is optional and may span multiple words.
      pattern:
        /you\s+are\s+now\s+(?:an?\s+)?(?:different|new|unrestricted|unfiltered|uncensored|evil|malicious|jailbroken|free)(?:\s+(?:AI\s+)?(?:model|assistant|bot|version))?/i,
    },
    {
      category: 'role-play-jailbreak',
      pattern:
        /(?:switch\s+(?:to|into)|enter|activate|enable)\s+(?:developer|god|unrestricted|jailbreak|bypass|override|raw)\s+mode/i,
    },
    // ── tool-exfiltration ─────────────────────────────────────────────────
    // Requests to enumerate, reveal, or describe available tools/functions.
    {
      category: 'tool-exfiltration',
      pattern:
        /(?:list|show|reveal|print|output|enumerate|describe|what\s+are|tell\s+me\s+(?:about\s+)?(?:all|your))\s+(?:all\s+)?(?:your\s+)?(?:available\s+)?(?:tools?|functions?|capabilities|endpoints?|api\s+calls?|tool\s+definitions?)/i,
    },
    {
      category: 'tool-exfiltration',
      // "show me your functions" — verb + me/us + possessive + noun
      pattern:
        /(?:show|give|tell)\s+(?:me|us)\s+(?:your\s+)?(?:tools?|functions?|capabilities|api\s+calls?|tool\s+definitions?)/i,
    },
    {
      category: 'tool-exfiltration',
      pattern:
        /(?:what\s+tools?|which\s+tools?)\s+(?:do\s+you\s+have|are\s+(?:available|you\s+using|defined))/i,
    },
  ];

  /**
   * Screens `message` against all detection rules.
   *
   * Returns as soon as the first rule fires (short-circuit evaluation).
   * A clean message returns `{ flagged: false, category: null, reason: null }`.
   */
  screen(message: string): ScreeningResult {
    for (const rule of this.rules) {
      if (rule.pattern.test(message)) {
        return {
          flagged: true,
          category: rule.category,
          reason: `Message blocked: detected ${rule.category.replace(/-/g, ' ')} pattern.`,
        };
      }
    }

    return { flagged: false, category: null, reason: null };
  }

  /**
   * Logs a flagged message audit record without storing the raw message
   * text beyond a short, fixed-length prefix (to limit inadvertent PII
   * or abuse-payload retention in the log stream).
   */
  logFlagged(
    userId: string,
    sessionId: string,
    category: string,
    messagePrefix: string,
  ): void {
    // Truncate to 80 chars so the log entry is human-readable without
    // retaining the full injection payload.
    const preview = messagePrefix.slice(0, 80).replace(/\n/g, '\\n');
    this.logger.warn(
      `Prompt injection attempt blocked — userId=${userId} sessionId=${sessionId} ` +
        `category=${category} preview="${preview}${messagePrefix.length > 80 ? '…' : ''}"`,
    );
  }
}
