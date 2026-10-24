import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { ContentFlagService } from '../content-flag.service';
import type { ContentFlagEntityType } from '../entities/content-flag.entity';
import type { ToolLogger } from './tool-set.types';

/**
 * The exact tool names this builder is allowed to return — see
 * marketplace.tools.ts for why this list exists and how it's enforced.
 */
export const MODERATION_TOOL_NAMES = ['flag_content'] as const;

/**
 * Default moderation confidence threshold. Results at or above this value
 * create a reviewable flag; results below are auto-cleared. Overridable via
 * ConfigService (MODERATION_CONFIDENCE_THRESHOLD).
 */
export const DEFAULT_MODERATION_CONFIDENCE_THRESHOLD = 0.7;

export interface ModerationToolsDeps {
  contentFlagService: ContentFlagService;
  /**
   * The entity this moderation call is actually reviewing — closed over
   * here so flag_content can't record a flag against a different entity
   * than the one it was asked to review, even if the model echoes a
   * different entityType/entityId. Same "never trust identity from tool
   * input" pattern as creator-copilot.tools.ts's expectedNftId (#528).
   */
  expectedEntity: { entityType: ContentFlagEntityType; entityId: string };
  toolLogger?: ToolLogger;
}

export interface ModerationFlagResult {
  flagged: boolean;
  flag?: { id: string; status: string; entityType: ContentFlagEntityType; entityId: string };
  threshold: number;
}

/**
 * Write-capable tool surface for the moderation agent only — registered
 * under the 'moderation' tool set, never 'marketplace-assistant' or
 * 'creator-copilot', so read-only assistants can't reach a persistence
 * side effect.
 */
export function buildModerationTools(deps: ModerationToolsDeps) {
  const { contentFlagService } = deps;

  const createTool = <T extends z.ZodTypeAny>(config: {
    name: string;
    description: string;
    inputSchema: T;
    run: (input: z.infer<T>) => Promise<string>;
  }) => {
    const originalRun = config.run;
    config.run = async (input: z.infer<T>) => {
      const start = Date.now();
      try {
        const res = await originalRun(input);
        if (deps.toolLogger) {
          const resStr = typeof res === 'string' ? res : JSON.stringify(res);
          const summary =
            resStr.substring(0, 100) + (resStr.length > 100 ? '...' : '');
          deps.toolLogger(
            config.name,
            input as Record<string, unknown>,
            summary,
            Date.now() - start,
          );
        }
        return res;
      } catch (err) {
        if (deps.toolLogger) {
          deps.toolLogger(
            config.name,
            input as Record<string, unknown>,
            `Error: ${(err as Error).message}`,
            Date.now() - start,
          );
        }
        throw err;
      }
    };
    return betaZodTool(config);
  };

  const flagContent = createTool({
    name: 'flag_content',
    description:
      'Flag a listing, NFT, or collection for human moderation review — e.g. prohibited imagery, scam indicators, or IT infringement. This does NOT hide or remove the content; it only queues it in content_flags for a human moderator to act on via the admin flags queue. Results below the configured confidence threshold are auto-cleared and not queued.',
    inputSchema: z.object({
      entityType: z.enum(['listing', 'nft', 'collection']),
      entityId: z.string().uuid(),
      reason: z
        .string()
        .min(1)
        .max(2000)
        .describe(
          'Why this content was flagged, in enough detail for a human reviewer to act on it.',
        ),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe(
          'Model confidence that this content violates policy, from 0 to 1.',
        ),
    }),
    run: async (input) => {
      if (
        input.entityType !== deps.expectedEntity.entityType ||
        input.entityId !== deps.expectedEntity.entityId
      ) {
        throw new Error(
          `Flagged content (${input.entityType}:${input.entityId}) does not match ` +
            `the entity under review (${deps.expectedEntity.entityType}:${deps.expectedEntity.entityId}).`,
        );
      }

      const result = await contentFlagService.createFlagIfAboveThreshold(input);
      if (!result.flagged || !result.flag) {
        return JSON.stringify({
          flagged: false,
          autoCleared: true,
          confidence: input.confidence,
          threshold: result.threshold,
          entityType: input.entityType,
          entityId: input.entityId,
        });
      }
      return JSON.stringify({
        flagged: true,
        id: result.flag.id,
        status: result.flag.status,
        entityType: result.flag.entityType,
        entityId: result.flag.entityId,
        threshold: result.threshold,
      });
    },
  });

  return [flagContent];
}
