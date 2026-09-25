import { RequestMethod, UnauthorizedException } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  SSE_METADATA,
} from '@nestjs/common/constants';
import { of } from 'rxjs';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiUsageService } from './ai-usage.service';
import { AiAgentHealthService } from './ai-agent-health.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AiChatRateLimitGuard } from '../../common/guards/ai-chat-rate-limit.guard';

describe('AiAgentController', () => {
  const aiAgentService = {
    chat: jest.fn(),
    chatStream: jest.fn(),
    getToolLogs: jest.fn(),
  };

  const aiUsageService = {
    getUsageSummary: jest.fn(),
  };

  const aiAgentHealthService = {
    getHealth: jest.fn(),
  };

  const controller = new AiAgentController(
    aiAgentService as unknown as AiAgentService,
    aiUsageService as unknown as AiUsageService,
    aiAgentHealthService as unknown as AiAgentHealthService,
  );

  const makeRequest = (userId?: string) =>
    ({ user: userId ? { userId } : undefined }) as unknown as Parameters<
      typeof controller.chat
    >[0];

  afterEach(() => jest.clearAllMocks());

  it('applies no class-level guard (health must stay reachable without a JWT)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AiAgentController) as
      | unknown[]
      | undefined;

    expect(guards).toBeUndefined();
  });

  it('applies JwtAuthGuard and AiChatRateLimitGuard to the chat route', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller.chat) as
      | unknown[]
      | undefined;

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(AiChatRateLimitGuard);
  });

  it('applies JwtAuthGuard to the usage route', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller.getUsage) as
      | unknown[]
      | undefined;

    expect(guards).toContain(JwtAuthGuard);
  });

  it('applies no guard to the health route', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller.getHealth,
    ) as unknown[] | undefined;

    expect(guards).toBeUndefined();
  });

  describe('chat', () => {
    it('delegates to AiAgentService.chat with the authenticated user id and returns the reply + sessionId', async () => {
      aiAgentService.chat.mockResolvedValue({
        reply: 'Here are the top listings.',
        sessionId: 'session-1',
      });

      const result = await controller.chat(makeRequest('user-1'), {
        message: 'What NFTs are trending?',
      });

      expect(aiAgentService.chat).toHaveBeenCalledWith(
        'user-1',
        'marketplace-assistant',
        'What NFTs are trending?',
        undefined,
      );
      expect(result).toEqual({
        reply: 'Here are the top listings.',
        sessionId: 'session-1',
      });
    });

    it('forwards sessionId to AiAgentService.chat to continue an existing conversation', async () => {
      aiAgentService.chat.mockResolvedValue({
        reply: 'Sure, here is more detail.',
        sessionId: 'session-42',
      });

      await controller.chat(makeRequest('user-1'), {
        message: 'Tell me more',
        sessionId: 'session-42',
      });

      expect(aiAgentService.chat).toHaveBeenCalledWith(
        'user-1',
        'marketplace-assistant',
        'Tell me more',
        'session-42',
      );
    });

    it('ignores a client-supplied history array (deprecated — server loads history from the session)', async () => {
      aiAgentService.chat.mockResolvedValue({
        reply: 'Sure, here is more detail.',
        sessionId: 'session-1',
      });
      const history = [
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello, how can I help?' },
      ];

      await controller.chat(makeRequest('user-1'), {
        message: 'Tell me more',
        history,
      });

      expect(aiAgentService.chat).toHaveBeenCalledWith(
        'user-1',
        'marketplace-assistant',
        'Tell me more',
        undefined,
      );
    });

    it('rejects with UnauthorizedException when no authenticated user is present', async () => {
      await expect(
        controller.chat(makeRequest(undefined), { message: 'hi' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(aiAgentService.chat).not.toHaveBeenCalled();
    });
  });

  describe('chatStream', () => {
    it('is registered as an SSE route on POST chat/stream', () => {
      expect(Reflect.getMetadata(SSE_METADATA, controller.chatStream)).toBe(
        true,
      );
      expect(Reflect.getMetadata(PATH_METADATA, controller.chatStream)).toBe(
        'chat/stream',
      );
      expect(Reflect.getMetadata(METHOD_METADATA, controller.chatStream)).toBe(
        RequestMethod.POST,
      );
    });

    it('applies JwtAuthGuard and AiChatRateLimitGuard to the stream route', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        controller.chatStream,
      ) as unknown[] | undefined;

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(AiChatRateLimitGuard);
    });

    it('delegates to AiAgentService.chatStream with the authenticated user id', () => {
      const observable = of();
      aiAgentService.chatStream.mockReturnValue(observable);

      const result = controller.chatStream(makeRequest('user-1'), {
        message: 'What NFTs are trending?',
      });

      expect(aiAgentService.chatStream).toHaveBeenCalledWith(
        'user-1',
        'marketplace-assistant',
        'What NFTs are trending?',
        undefined,
      );
      expect(result).toBe(observable);
    });

    it('forwards sessionId to AiAgentService.chatStream to continue an existing conversation', () => {
      aiAgentService.chatStream.mockReturnValue(of());

      controller.chatStream(makeRequest('user-1'), {
        message: 'Tell me more',
        sessionId: 'session-42',
      });

      expect(aiAgentService.chatStream).toHaveBeenCalledWith(
        'user-1',
        'marketplace-assistant',
        'Tell me more',
        'session-42',
      );
    });

    it('ignores a client-supplied history array (deprecated — server loads history from the session)', () => {
      aiAgentService.chatStream.mockReturnValue(of());
      const history = [{ role: 'user' as const, content: 'Hi' }];

      controller.chatStream(makeRequest('user-1'), {
        message: 'Tell me more',
        history,
      });

      expect(aiAgentService.chatStream).toHaveBeenCalledWith(
        'user-1',
        'marketplace-assistant',
        'Tell me more',
        undefined,
      );
    });

    it('throws UnauthorizedException when no authenticated user is present', () => {
      expect(() =>
        controller.chatStream(makeRequest(undefined), { message: 'hi' }),
      ).toThrow(UnauthorizedException);
      expect(aiAgentService.chatStream).not.toHaveBeenCalled();
    });
  });

  describe('getUsage', () => {
    it('returns the authenticated user usage summary', async () => {
      const summary = {
        daily: {
          totalTokens: 100,
          estimatedCostUsd: 0.5,
          cap: 1000,
          remaining: 900,
        },
        monthly: {
          totalTokens: 100,
          estimatedCostUsd: 0.5,
          cap: 10000,
          remaining: 9900,
        },
      };
      aiUsageService.getUsageSummary.mockResolvedValue(summary);

      const result = await controller.getUsage(makeRequest('user-1'));

      expect(aiUsageService.getUsageSummary).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(summary);
    });

    it('rejects with UnauthorizedException when no authenticated user is present', async () => {
      await expect(
        controller.getUsage(makeRequest(undefined)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(aiUsageService.getUsageSummary).not.toHaveBeenCalled();
    });
  });

  describe('health', () => {
    it('delegates to AiAgentHealthService.getHealth', async () => {
      aiAgentHealthService.getHealth.mockResolvedValue({
        status: 'up',
        timestamp: '2026-08-27T00:00:00.000Z',
      });

      const result = await controller.getHealth();

      expect(aiAgentHealthService.getHealth).toHaveBeenCalledWith();
      expect(result).toEqual({
        status: 'up',
        timestamp: '2026-08-27T00:00:00.000Z',
      });
    });

    it('does not require an authenticated user (no user on the request at all)', async () => {
      aiAgentHealthService.getHealth.mockResolvedValue({
        status: 'unconfigured',
        timestamp: '2026-08-27T00:00:00.000Z',
      });

      // getHealth() takes no request/user argument, unlike every other route.
      await expect(controller.getHealth()).resolves.toEqual({
        status: 'unconfigured',
        timestamp: '2026-08-27T00:00:00.000Z',
      });
    });
  });
  describe('getToolLogs', () => {
    it('applies JwtAuthGuard and Roles guard to the tool logs route', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        controller.getToolLogs,
      ) as unknown[] | undefined;

      expect(guards).toContain(JwtAuthGuard);
    });

    it('delegates to AiAgentService.getToolLogs with defaults', async () => {
      const expectedResult = { data: [], total: 0 };
      aiAgentService.getToolLogs.mockResolvedValue(expectedResult);

      const result = await controller.getToolLogs();

      expect(aiAgentService.getToolLogs).toHaveBeenCalledWith({
        userId: undefined,
        sessionId: undefined,
        toolName: undefined,
        page: 1,
        limit: 50,
      });
      expect(result).toEqual(expectedResult);
    });

    it('delegates to AiAgentService.getToolLogs parsing page and limit', async () => {
      const expectedResult = { data: [], total: 0 };
      aiAgentService.getToolLogs.mockResolvedValue(expectedResult);

      const result = await controller.getToolLogs(
        'user-1',
        'session-1',
        'tool-1',
        '2',
        '20',
      );

      expect(aiAgentService.getToolLogs).toHaveBeenCalledWith({
        userId: 'user-1',
        sessionId: 'session-1',
        toolName: 'tool-1',
        page: 2,
        limit: 20,
      });
      expect(result).toEqual(expectedResult);
    });
  });
});
