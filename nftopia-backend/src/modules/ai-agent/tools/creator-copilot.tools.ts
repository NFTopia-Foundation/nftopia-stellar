import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

/**
 * The exact tool names this builder is allowed to return — see
 * marketplace.tools.ts for why this list exists and how it's enforced.
 */
export const CREATOR_COPILOT_TOOL_NAMES = ['draft_listing'] as const;

export interface DraftListingResult {
  nftId: string;
  title: string;
  description: string;
  suggestedPrice: number;
  currency: 'XLM' | 'USDC';
  reasoning: string;
}

export interface CreatorCopilotToolsDeps {
  /**
   * The NFT this drafting call is for — resolved and ownership-checked by
   * AiAgentService.draftListing *before* the model is ever called, then
   * closed over here so draft_listing can verify the model's answer is
   * actually about the requested NFT rather than trusting an `nftId` the
   * model could otherwise supply for a different (possibly not-owned) one.
   * Same "never trust identity/scope from tool input" pattern as `userId`
   * in marketplace.tools.ts's search_orders/get_order.
   */
  expectedNftId: string;
  toolLogger?: import('./tool-set.types').ToolLogger;
}

/**
 * Write-capable tool surface for the creator co-pilot only — registered
 * under the 'creator-copilot' tool set, never 'marketplace-assistant' or
 * 'moderation' (#528).
 *
 * `draft_listing` doesn't persist anything: it captures the model's
 * structured suggestion (title/description/price/reasoning) and hands it
 * back for the creator to review and edit. Actually creating the listing
 * is a separate, explicit action the creator takes afterwards (via the
 * existing listing-creation endpoint) — this tool set never auto-publishes.
 */
export function buildCreatorCopilotTools(deps: CreatorCopilotToolsDeps) {
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

  const draftListing = createTool({
    name: 'draft_listing',
    description:
      "Submit your drafted marketplace listing for the NFT described in the prompt: a concise, compelling title, a description, and a suggested price with your reasoning (e.g. grounded in the collection floor price or the NFT's own last sale price, when given). This is a DRAFT for the creator to review and edit before anything is published — you are not listing the NFT yourself.",
    inputSchema: z.object({
      nftId: z
        .string()
        .uuid()
        .describe(
          'The id of the NFT this draft is for — must match the NFT given in the prompt.',
        ),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      suggestedPrice: z.number().positive(),
      currency: z.enum(['XLM', 'USDC']).default('XLM'),
      reasoning: z
        .string()
        .min(1)
        .max(1000)
        .describe(
          'Brief explanation of the suggested price — what it was grounded in.',
        ),
    }),
    run: (input) => {
      if (input.nftId !== deps.expectedNftId) {
        throw new Error(
          `Drafted listing is for a different NFT (${input.nftId}) than the one requested (${deps.expectedNftId}).`,
        );
      }

      const draft: DraftListingResult = {
        nftId: input.nftId,
        title: input.title,
        description: input.description,
        suggestedPrice: input.suggestedPrice,
        currency: input.currency,
        reasoning: input.reasoning,
      };
      return Promise.resolve(JSON.stringify(draft));
    },
  });

  return [draftListing];
}
