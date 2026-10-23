import { PubSub } from 'graphql-subscriptions';
import type { Provider } from '@nestjs/common';

export const PUB_SUB = 'PUB_SUB';

/**
 * In-memory PubSub (#650). Like the DataLoader request cache and the AI
 * chat stream registry (see docs/ai-chat-streaming-reconnect.md), this only
 * fans out to subscribers connected to the *same* backend instance — fine
 * for a single-instance deployment, but a multi-instance deployment would
 * need a shared backend (e.g. graphql-redis-subscriptions) instead.
 */
export const pubSubProvider: Provider = {
  provide: PUB_SUB,
  useValue: new PubSub(),
};
