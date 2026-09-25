import { ForbiddenException, NotFoundException } from '@nestjs/common';

// Anthropic() reads ANTHROPIC_API_KEY at construction time. Without one it
// kicks off an async credential-chain lookup (profile files, WIF env vars)
// that outlives the test — set a dummy key so the real request path (which
// every test mocks out anyway) never needs it.
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

import { AiAgentService } from './ai-agent.service';
import { registerToolSet, unregisterToolSet } from './tools/tool-set.registry';
import { MARKETPLACE_TOOL_NAMES } from './tools/marketplace.tools';
import type { RunnableToolLike } from './tools/tool-set.types';
import type { NftService } from '../nft/nft.service';
import type { ListingService } from '../listing/listing.service';
import type { CollectionService } from '../collection/collection.service';
import type { OrderService } from '../order/order.service';
import type { AuctionService } from '../auction/auction.service';
import type { AiUsageService } from './ai-usage.service';
import type { ChatSessionService } from './chat-session.service';
import type { Repository } from 'typeorm';
import type { AiToolCallLog } from './entities/ai-tool-call-log.entity';

describe('AiAgentService', () => {
  let service: AiAgentService;

  const aiUsageService = {
    assertWithinCap: jest.fn(),
    recordUsage: jest.fn(),
  };

  const chatSessionService = {
    loadOrCreateSession: jest.fn(),
    appendExchange: jest.fn(),
  };

  const defaultLoadedSession = { session: { id: 'session-1' }, history: [] };

  beforeEach(() => {
    jest.clearAllMocks();
    aiUsageService.assertWithinCap.mockResolvedValue(undefined);
    aiUsageService.recordUsage.mockResolvedValue(undefined);
    chatSessionService.loadOrCreateSession.mockResolvedValue(
      defaultLoadedSession,
    );
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

  const mockToolRunner = (finalMessage: unknown) => {
    const client = (service as unknown as { client: unknown }).client as {
      beta: { messages: { toolRunner: jest.Mock } };
    };
    client.beta.messages.toolRunner = jest.fn().mockResolvedValue(finalMessage);
    return client.beta.messages.toolRunner;
  };

  const makeFinalMessage = (overrides: Record<string, unknown> = {}) => ({
    model: 'claude-opus-5',
    content: [{ type: 'text', text: 'Here are the top listings.' }],
    usage: { input_tokens: 500, output_tokens: 150 },
    ...overrides,
  });

  describe('cap enforcement', () => {
    it('rejects with ForbiddenException without calling the Anthropic API when the cap is reached', async () => {
      aiUsageService.assertWithinCap.mockRejectedValue(
        new ForbiddenException('Daily AI usage cap reached (200000 tokens).'),
      );
      const toolRunner = mockToolRunner(makeFinalMessage());

      await expect(
        service.chat(
          'user-1',
          'marketplace-assistant',
          'What NFTs are trending?',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(aiUsageService.assertWithinCap).toHaveBeenCalledWith('user-1');
      expect(chatSessionService.loadOrCreateSession).not.toHaveBeenCalled();
      expect(toolRunner).not.toHaveBeenCalled();
      expect(aiUsageService.recordUsage).not.toHaveBeenCalled();
    });

    it('proceeds to call the Anthropic API when the caller is under their cap', async () => {
      const toolRunner = mockToolRunner(makeFinalMessage());

      const result = await service.chat(
        'user-1',
        'marketplace-assistant',
        'What NFTs are trending?',
      );

      expect(aiUsageService.assertWithinCap).toHaveBeenCalledWith('user-1');
      expect(toolRunner).toHaveBeenCalled();
      expect(result.reply).toBe('Here are the top listings.');
    });
  });

  describe('usage recording', () => {
    it('records usage from finalMessage.usage after a successful reply', async () => {
      mockToolRunner(
        makeFinalMessage({
          model: 'claude-opus-5',
          usage: { input_tokens: 1234, output_tokens: 567 },
        }),
      );

      await service.chat(
        'user-42',
        'marketplace-assistant',
        'Find me a rare NFT',
      );

      expect(aiUsageService.recordUsage).toHaveBeenCalledWith(
        'user-42',
        'claude-opus-5',
        1234,
        567,
      );
    });

    it('does not record usage when the cap check throws', async () => {
      aiUsageService.assertWithinCap.mockRejectedValue(
        new ForbiddenException('cap reached'),
      );
      mockToolRunner(makeFinalMessage());

      await expect(
        service.chat('user-1', 'marketplace-assistant', 'hi'),
      ).rejects.toThrow();

      expect(aiUsageService.recordUsage).not.toHaveBeenCalled();
    });

    it('does not block the reply on recordUsage resolving', async () => {
      let resolveRecord!: () => void;
      aiUsageService.recordUsage.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveRecord = resolve;
        }),
      );
      mockToolRunner(makeFinalMessage());

      const result = await service.chat(
        'user-1',
        'marketplace-assistant',
        'hi',
      );

      expect(result.reply).toBe('Here are the top listings.');
      // recordUsage's promise is still pending — proves chat() didn't await it.
      resolveRecord();
    });

    it('returns the joined text content from the final message', async () => {
      mockToolRunner(
        makeFinalMessage({
          content: [
            { type: 'text', text: 'First line.' },
            { type: 'tool_use', id: 't1', name: 'search_nfts', input: {} },
            { type: 'text', text: 'Second line.' },
          ],
        }),
      );

      const result = await service.chat(
        'user-1',
        'marketplace-assistant',
        'hi',
      );

      expect(result.reply).toBe('First line.\nSecond line.');
    });
  });

  describe('conversation persistence (#487)', () => {
    it('starts a new session when no sessionId is given, and returns its id', async () => {
      chatSessionService.loadOrCreateSession.mockResolvedValue({
        session: { id: 'new-session-1' },
        history: [],
      });
      mockToolRunner(makeFinalMessage());

      const result = await service.chat(
        'user-1',
        'marketplace-assistant',
        'hi',
      );

      expect(chatSessionService.loadOrCreateSession).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
      expect(result.sessionId).toBe('new-session-1');
    });

    it('passes an existing sessionId through to load its history', async () => {
      chatSessionService.loadOrCreateSession.mockResolvedValue({
        session: { id: 'session-42' },
        history: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello, how can I help?' },
        ],
      });
      const toolRunner = mockToolRunner(makeFinalMessage());

      const result = await service.chat(
        'user-1',
        'marketplace-assistant',
        'Tell me more',
        'session-42',
      );

      expect(chatSessionService.loadOrCreateSession).toHaveBeenCalledWith(
        'user-1',
        'session-42',
      );
      const [requestArgs] = toolRunner.mock.calls[0] as [
        { messages: { role: string; content: string }[] },
      ];
      expect(requestArgs.messages).toEqual([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello, how can I help?' },
        { role: 'user', content: 'Tell me more' },
      ]);
      expect(result.sessionId).toBe('session-42');
    });

    it('never builds the model request from client-supplied history — only from what loadOrCreateSession returns', async () => {
      chatSessionService.loadOrCreateSession.mockResolvedValue({
        session: { id: 'session-1' },
        history: [{ role: 'assistant', content: 'DB-backed prior turn' }],
      });
      const toolRunner = mockToolRunner(makeFinalMessage());

      await service.chat('user-1', 'marketplace-assistant', 'next message');

      const [requestArgs] = toolRunner.mock.calls[0] as [
        { messages: { role: string; content: string }[] },
      ];
      expect(requestArgs.messages[0]).toEqual({
        role: 'assistant',
        content: 'DB-backed prior turn',
      });
    });

    it('persists the user message and assistant reply after a successful call', async () => {
      chatSessionService.loadOrCreateSession.mockResolvedValue({
        session: { id: 'session-7' },
        history: [],
      });
      mockToolRunner(
        makeFinalMessage({ content: [{ type: 'text', text: 'The reply.' }] }),
      );

      await service.chat('user-1', 'marketplace-assistant', 'The question.');

      expect(chatSessionService.appendExchange).toHaveBeenCalledWith(
        'session-7',
        'The question.',
        'The reply.',
      );
    });

    it('does not persist an exchange when the Anthropic call fails', async () => {
      chatSessionService.loadOrCreateSession.mockResolvedValue(
        defaultLoadedSession,
      );
      const client = (service as unknown as { client: unknown }).client as {
        beta: { messages: { toolRunner: jest.Mock } };
      };
      client.beta.messages.toolRunner = jest
        .fn()
        .mockRejectedValue(new Error('boom'));

      await expect(
        service.chat('user-1', 'marketplace-assistant', 'hi'),
      ).rejects.toThrow();

      expect(chatSessionService.appendExchange).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException for a sessionId that does not exist', async () => {
      chatSessionService.loadOrCreateSession.mockRejectedValue(
        new NotFoundException('Chat session missing-session not found'),
      );

      await expect(
        service.chat(
          'user-1',
          'marketplace-assistant',
          'hi',
          'missing-session',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates ForbiddenException when the session belongs to another user, without calling the Anthropic API', async () => {
      chatSessionService.loadOrCreateSession.mockRejectedValue(
        new ForbiddenException('You do not have access to this chat session'),
      );
      const toolRunner = mockToolRunner(makeFinalMessage());

      await expect(
        service.chat('user-2', 'marketplace-assistant', 'hi', 'user-1-session'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(toolRunner).not.toHaveBeenCalled();
    });
  });

  describe('tool set scoping (#492)', () => {
    afterEach(() => {
      unregisterToolSet('creator-copilot');
    });

    it('never passes tools from another registered tool set to the Anthropic API', async () => {
      registerToolSet(
        'creator-copilot',
        () => [{ name: 'draft_listing' } as unknown as RunnableToolLike],
        ['draft_listing'],
      );
      const toolRunner = mockToolRunner(makeFinalMessage());

      await service.chat('user-1', 'marketplace-assistant', 'hi');

      const [requestArgs] = toolRunner.mock.calls[0] as [
        { tools: RunnableToolLike[] },
      ];
      const requestedToolNames = requestArgs.tools.map((tool) => tool.name);

      expect(requestedToolNames).not.toContain('draft_listing');
      expect(requestedToolNames.sort()).toEqual(
        [...MARKETPLACE_TOOL_NAMES].sort(),
      );
    });

    it('rejects a request for a tool set with no registered builder', async () => {
      await expect(
        service.chat('user-1', 'creator-copilot', 'hi'),
      ).rejects.toThrow(/not registered/);
    });
  });
});
