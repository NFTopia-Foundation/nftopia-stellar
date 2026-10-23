import { SetMetadata } from '@nestjs/common';
import type { ToolSetName } from '../../modules/ai-agent/tools/tool-set.types';

export const TOOL_SET_KEY = 'ai_chat_tool_set';

/**
 * Declares which AI tool set a route targets, read by AiChatRateLimitGuard
 * (#645) to key its rate-limit bucket and budget independently per tool
 * set. A route with no `@ToolSet(...)` is treated as 'marketplace-assistant'
 * by the guard.
 */
export const ToolSet = (toolSet: ToolSetName) =>
  SetMetadata(TOOL_SET_KEY, toolSet);
