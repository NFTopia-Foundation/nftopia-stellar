import { ForbiddenException } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { AiAgentService } from './ai-agent.service';
import type { NftService } from '../nft/nft.service';
import type { ListingService } from '../listing/listing.service';
import type { CollectionService } from '../collection/collection.service';
import type { OrderService } from '../order/order.service';
import type { AuctionService } from '../auction/auction.service';
import type { AiUsageService } from './ai-usage.service';
import type { ChatSessionService } from './chat-session.service';
import type { Repository } from 'typeorm';
import type { AiToolCallLog } from './entities/ai-tool-call-log.entity';

// Anthropic() reads ANTHROPIC_API_KEY at construction time — see
// ai-agent.service.spec.ts for why this must be set before import.
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

interface FakeStreamEvent {
  type: string;
  [key: string]: unknown;
}

/** Minimal stand-in for Anthropic's BetaMessageStream. */
function makeFakeMessageStream(
  events: FakeStreamEvent[],
  finalMessage: Record<string, unknown>,
) {
  return {
    [Symbol.asyncIterator]: () => {
      let i = 0;
      return {
        next: () =>
          Promise.resolve(
            i < events.length
              ? { value: events[i++], done: false }
              : { value: undefined, done: true },
          ),
      };
    },
    finalMessage: () => Promise.resolve(finalMessage),
  };
}

/** Minimal stand-in for Anthropic's streaming BetaToolRunner. */
function makeFakeStreamingRunner(
  iterations: Array<{
    events: FakeStreamEvent[];
    finalMessage: Record<string, unknown>;
  }>,
) {
  const pushMessages = jest.fn();
  let index = 0;

  return {
    pushMessages,
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (index < iterations.length) {
          const it = iterations[index++];
          return Promise.resolve({
            value: makeFakeMessageStream(it.events, it.finalMessage),
            done: false,
          });
        }
        return Promise.resolve({ value: undefined, done: true });
      },
    }),
    done: jest.fn(() =>
      Promise.resolve(iterations[iterations.length - 1].finalMessage),
    ),
  };
}

function collect(
  observable: Observable<MessageEvent>,
): Promise<{ events: MessageEvent[]; error?: unknown }> {
  return new Promise((resolve) => {
    const events: MessageEvent[] = [];
    observable.subscribe({
      next: (event) => events.push(event),
      error: (error: unknown) => resolve({ events, error }),
      complete: () => resolve({ events }),
    });
  });
}

const textDelta = (text: string): FakeStreamEvent => ({
  type: 'content_block_delta',
  delta: { type: 'text_delta', text },
});

const toolUseStart = (id: string, name: string): FakeStreamEvent => ({
  type: 'content_block_start',
  content_block: { type: 'tool_use', id, name, input: {} },
});

describe('AiAgentService.chatStream', () => {
  let service: AiAgentService;

  const aiUsageService = {
    assertWithinCap: jest.fn(),
    recordUsage: jest.fn(),
  };

  const chatSessionService = {
    loadOrCreateSession: jest.fn(),
    appendExchange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    aiUsageService.assertWithinCap.mockResolvedValue(undefined);
    aiUsageService.recordUsage.mockResolvedValue(undefined);
    chatSessionService.loadOrCreateSession.mockResolvedValue({
      session: { id: 'session-1' },
      history: [],
    });
    chatSessionService.appendExchange.mockResolvedValue(undefined);

    service = new AiAgentService(
      {} as NftService,
      {} as ListingService,
      {} as CollectionService,
      {} as OrderService,
      {} as AuctionService,
      aiUsageService as unknown as AiUsageService,
      chatSessionService as unknown as ChatSessionService,
      {
        save: jest.fn().mockResolvedValue(undefined),
        createQueryBuilder: jest.fn(),
      } as unknown as Repository<AiToolCallLog>,
    );
  });

  const mockToolRunner = (runner: unknown) => {
    const client = (service as unknown as { client: unknown }).client as {
      beta: { messages: { toolRunner: jest.Mock } };
    };
    client.beta.messages.toolRunner = jest.fn().mockReturnValue(runner);
    return client.beta.messages.toolRunner;
  };

  describe('incremental text and tool-call events', () => {
    it('emits text deltas followed by a terminal done event', async () => {
      const runner = makeFakeStreamingRunner([
        {
          events: [
            textDelta('Here '),
            textDelta('are '),
            textDelta('results.'),
          ],
          finalMessage: {
            model: 'claude-opus-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 100, output_tokens: 20 },
          },
        },
      ]);
      mockToolRunner(runner);

      const { events, error } = await collect(
        service.chatStream(
          'user-1',
          'marketplace-assistant',
          'What NFTs are trending?',
        ),
      );

      expect(error).toBeUndefined();
      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.map((e) => (e.data as { text: string }).text)).toEqual([
        'Here ',
        'are ',
        'results.',
      ]);

      const doneEvent = events[events.length - 1];
      expect(doneEvent.type).toBe('done');
      expect(doneEvent.data).toEqual({
        reply: 'Here are results.',
        sessionId: 'session-1',
      });
    });

    it('emits a distinct tool_call event when the model starts a tool_use block', async () => {
      const runner = makeFakeStreamingRunner([
        {
          events: [
            toolUseStart('tool-1', 'search_nfts'),
            textDelta('Found some listings.'),
          ],
          finalMessage: {
            model: 'claude-opus-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 100, output_tokens: 20 },
          },
        },
      ]);
      mockToolRunner(runner);

      const { events } = await collect(
        service.chatStream('user-1', 'marketplace-assistant', 'Find rare NFTs'),
      );

      const toolCallEvents = events.filter((e) => e.type === 'tool_call');
      expect(toolCallEvents).toHaveLength(1);
      expect(toolCallEvents[0].data).toEqual({
        id: 'tool-1',
        name: 'search_nfts',
      });

      // tool_call and text events must be distinguishable by type.
      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents).toHaveLength(1);
    });

    it('records usage from the final message without blocking completion', async () => {
      const runner = makeFakeStreamingRunner([
        {
          events: [textDelta('ok')],
          finalMessage: {
            model: 'claude-opus-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 42, output_tokens: 7 },
          },
        },
      ]);
      mockToolRunner(runner);

      await collect(
        service.chatStream('user-7', 'marketplace-assistant', 'hi'),
      );

      expect(aiUsageService.recordUsage).toHaveBeenCalledWith(
        'user-7',
        'claude-opus-5',
        42,
        7,
      );
    });
  });

  describe('conversation persistence (#487)', () => {
    it('loads history from the session and builds the model request from it, not from a history param', async () => {
      chatSessionService.loadOrCreateSession.mockResolvedValue({
        session: { id: 'session-99' },
        history: [{ role: 'user', content: 'Earlier turn from the database' }],
      });
      const runner = makeFakeStreamingRunner([
        {
          events: [textDelta('ok')],
          finalMessage: {
            model: 'claude-opus-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        },
      ]);
      const toolRunner = mockToolRunner(runner);

      await collect(
        service.chatStream(
          'user-1',
          'marketplace-assistant',
          'next message',
          'session-99',
        ),
      );

      expect(chatSessionService.loadOrCreateSession).toHaveBeenCalledWith(
        'user-1',
        'session-99',
      );
      const [requestArgs] = toolRunner.mock.calls[0] as [
        { messages: { role: string; content: string }[] },
      ];
      expect(requestArgs.messages[0]).toEqual({
        role: 'user',
        content: 'Earlier turn from the database',
      });
    });

    it('persists the exchange before emitting the terminal done event', async () => {
      chatSessionService.loadOrCreateSession.mockResolvedValue({
        session: { id: 'session-5' },
        history: [],
      });
      const runner = makeFakeStreamingRunner([
        {
          events: [textDelta('The reply.')],
          finalMessage: {
            model: 'claude-opus-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        },
      ]);
      mockToolRunner(runner);

      await collect(
        service.chatStream('user-1', 'marketplace-assistant', 'The question.'),
      );

      expect(chatSessionService.appendExchange).toHaveBeenCalledWith(
        'session-5',
        'The question.',
        'The reply.',
      );
    });

    it('propagates ForbiddenException when the session belongs to another user', async () => {
      chatSessionService.loadOrCreateSession.mockRejectedValue(
        new ForbiddenException('You do not have access to this chat session'),
      );
      const toolRunner = mockToolRunner(makeFakeStreamingRunner([]));

      const { events, error } = await collect(
        service.chatStream(
          'user-2',
          'marketplace-assistant',
          'hi',
          'user-1-session',
        ),
      );

      expect(events).toHaveLength(0);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(toolRunner).not.toHaveBeenCalled();
    });
  });

  describe('pause_turn resume', () => {
    it('pushes the paused turn back and continues without truncating the reply', async () => {
      const runner = makeFakeStreamingRunner([
        {
          events: [textDelta('Partial answer before pausing.')],
          finalMessage: {
            model: 'claude-opus-5',
            stop_reason: 'pause_turn',
            content: [{ type: 'text', text: 'Partial answer before pausing.' }],
            usage: { input_tokens: 500, output_tokens: 100 },
          },
        },
        {
          events: [textDelta(' Rest of the answer after resuming.')],
          finalMessage: {
            model: 'claude-opus-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 50, output_tokens: 30 },
          },
        },
      ]);
      mockToolRunner(runner);

      const { events, error } = await collect(
        service.chatStream(
          'user-1',
          'marketplace-assistant',
          'Do a deep multi-source search',
        ),
      );

      expect(error).toBeUndefined();
      expect(runner.pushMessages).toHaveBeenCalledWith({
        role: 'assistant',
        content: [{ type: 'text', text: 'Partial answer before pausing.' }],
      });

      const doneEvent = events[events.length - 1];
      expect(doneEvent.type).toBe('done');
      expect(doneEvent.data).toEqual({
        reply:
          'Partial answer before pausing. Rest of the answer after resuming.',
        sessionId: 'session-1',
      });

      // Usage is recorded from the final (post-resume) message, not the
      // paused intermediate one.
      expect(aiUsageService.recordUsage).toHaveBeenCalledWith(
        'user-1',
        'claude-opus-5',
        50,
        30,
      );
    });

    it('resumes multiple consecutive pauses without dropping text', async () => {
      const runner = makeFakeStreamingRunner([
        {
          events: [textDelta('One. ')],
          finalMessage: {
            stop_reason: 'pause_turn',
            content: [{ type: 'text', text: 'One. ' }],
          },
        },
        {
          events: [textDelta('Two. ')],
          finalMessage: {
            stop_reason: 'pause_turn',
            content: [{ type: 'text', text: 'One. Two. ' }],
          },
        },
        {
          events: [textDelta('Three.')],
          finalMessage: {
            model: 'claude-opus-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 10 },
          },
        },
      ]);
      mockToolRunner(runner);

      const { events, error } = await collect(
        service.chatStream(
          'user-1',
          'marketplace-assistant',
          'Long multi-step task',
        ),
      );

      expect(error).toBeUndefined();
      expect(runner.pushMessages).toHaveBeenCalledTimes(2);

      const doneEvent = events[events.length - 1];
      expect(doneEvent.data).toEqual({
        reply: 'One. Two. Three.',
        sessionId: 'session-1',
      });
    });
  });

  describe('errors', () => {
    it('propagates a cap-exceeded error before calling the Anthropic API', async () => {
      aiUsageService.assertWithinCap.mockRejectedValue(
        new ForbiddenException('Daily AI usage cap reached (200000 tokens).'),
      );
      const toolRunner = mockToolRunner(makeFakeStreamingRunner([]));

      const { events, error } = await collect(
        service.chatStream('user-1', 'marketplace-assistant', 'hi'),
      );

      expect(events).toHaveLength(0);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(toolRunner).not.toHaveBeenCalled();
    });

    it('surfaces a mid-stream Anthropic error as a terminal error after partial text', async () => {
      const failingStream = {
        [Symbol.asyncIterator]: () => ({
          next: () => {
            throw Object.assign(new Error('rate limited'), {
              constructor: { name: 'RateLimitError' },
            });
          },
        }),
        finalMessage: () => {
          throw new Error('should not be reached');
        },
      };
      const runner = {
        pushMessages: jest.fn(),
        [Symbol.asyncIterator]: () => {
          let yielded = false;
          return {
            next: () => {
              if (yielded)
                return Promise.resolve({ value: undefined, done: true });
              yielded = true;
              return Promise.resolve({ value: failingStream, done: false });
            },
          };
        },
        done: jest.fn(),
      };
      mockToolRunner(runner);

      const { events, error } = await collect(
        service.chatStream('user-1', 'marketplace-assistant', 'hi'),
      );

      expect(events).toHaveLength(0);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
