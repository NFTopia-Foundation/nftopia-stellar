import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LessThan, In } from 'typeorm';
import {
  ChatSessionService,
  estimateTokens,
  summarizeHistory,
} from './chat-session.service';
import { ChatMessage } from './entities/chat-message.entity';

describe('ChatSessionService', () => {
  let service: ChatSessionService;

  const sessionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const messageRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    messageRepo.save.mockResolvedValue([]);
    sessionRepo.save.mockResolvedValue({});
    sessionRepo.update.mockResolvedValue({});

    configService.get.mockImplementation((key: string) => {
      if (key === 'AI_CHAT_SESSION_RETENTION_DAYS') return 30;
      if (key === 'AI_CHAT_MAX_SESSION_MESSAGES') return 50;
      if (key === 'AI_CHAT_SUMMARIZATION_THRESHOLD') return 10;
      if (key === 'AI_CHAT_MAX_HISTORY_TOKENS') return 4000;
      if (key === 'AI_CHAT_RECENT_MESSAGES_COUNT') return 6;
      return undefined;
    });

    service = new ChatSessionService(
      sessionRepo as never,
      messageRepo as never,
      configService as never,
    );
  });

  describe('estimateTokens and summarizeHistory utilities', () => {
    it('estimates token count accurately using rule-of-thumb', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('abcdefgh')).toBe(2);
      expect(estimateTokens('a'.repeat(100))).toBe(25);
    });

    it('returns empty array when olderMessages is empty', () => {
      expect(summarizeHistory([])).toEqual([]);
    });

    it('creates summary turns with user summary and assistant acknowledgment', () => {
      const olderMessages = [
        {
          id: '1',
          sessionId: 's-1',
          role: 'user',
          content: 'Show me Bored Ape NFTs under 50 XLM',
          createdAt: new Date(),
        } as ChatMessage,
        {
          id: '2',
          sessionId: 's-1',
          role: 'assistant',
          content: 'I found 3 listings matching your criteria.',
          createdAt: new Date(),
        } as ChatMessage,
      ];

      const summary = summarizeHistory(olderMessages);
      expect(summary).toHaveLength(2);
      expect(summary[0].role).toBe('user');
      expect(summary[0].content).toContain(
        '[Summary of earlier conversation in this session]',
      );
      expect(summary[0].content).toContain('Show me Bored Ape NFTs');
      expect(summary[0].content).toContain(
        'I found 3 listings matching your criteria.',
      );

      expect(summary[1].role).toBe('assistant');
      expect(summary[1].content).toContain('Understood');
    });

    it('truncates very long message content in summary previews', () => {
      const longContent = 'x'.repeat(200);
      const olderMessages = [
        {
          id: '1',
          sessionId: 's-1',
          role: 'user',
          content: longContent,
          createdAt: new Date(),
        } as ChatMessage,
      ];

      const summary = summarizeHistory(olderMessages);
      expect(summary[0].content).toContain('...');
    });
  });

  describe('loadOrCreateSession', () => {
    it('creates a new session when no sessionId is given', async () => {
      sessionRepo.create.mockReturnValue({ userId: 'user-1' });
      sessionRepo.save.mockResolvedValue({
        id: 'new-session-1',
        userId: 'user-1',
      });

      const result = await service.loadOrCreateSession('user-1');

      expect(sessionRepo.create).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(sessionRepo.save).toHaveBeenCalled();
      expect(result.session).toEqual({ id: 'new-session-1', userId: 'user-1' });
      expect(result.history).toEqual([]);
      expect(messageRepo.find).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the given sessionId does not exist', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.loadOrCreateSession('user-1', 'missing-session'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(messageRepo.find).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the session belongs to a different user', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      });

      await expect(
        service.loadOrCreateSession('user-2', 'session-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(messageRepo.find).not.toHaveBeenCalled();
    });

    it('loads and returns unsummarized history in chronological order when under threshold', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      });
      messageRepo.find.mockResolvedValue([
        {
          role: 'user',
          content: 'Hi',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          role: 'assistant',
          content: 'Hello, how can I help?',
          createdAt: new Date('2026-01-01T00:00:01Z'),
        },
      ]);

      const result = await service.loadOrCreateSession('user-1', 'session-1');

      expect(messageRepo.find).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        order: { createdAt: 'ASC' },
      });
      expect(result.history).toEqual([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello, how can I help?' },
      ]);
      expect(result.session).toEqual({ id: 'session-1', userId: 'user-1' });
    });

    it('summarizes older messages when total message count exceeds summarization threshold', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      });

      // 12 messages: exceeds default summarizationThreshold (10)
      // recentMessagesCount is 6, so older = 6 messages, recent = 6 messages
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> =
        [];
      for (let i = 1; i <= 6; i++) {
        messages.push({ role: 'user', content: `Question ${i}` });
        messages.push({ role: 'assistant', content: `Answer ${i}` });
      }

      messageRepo.find.mockResolvedValue(messages);

      const result = await service.loadOrCreateSession('user-1', 'session-1');

      // History should have 2 summary turns + 6 recent turns = 8 turns total
      expect(result.history.length).toBe(8);
      expect(result.history[0].role).toBe('user');
      expect(result.history[0].content).toContain(
        '[Summary of earlier conversation in this session]',
      );
      expect(result.history[0].content).toContain('Question 1');
      expect(result.history[0].content).toContain('Answer 3');

      expect(result.history[1].role).toBe('assistant');
      expect(result.history[1].content).toContain('Understood');

      // Check recent messages intact
      expect(result.history[2]).toEqual({
        role: 'user',
        content: 'Question 4',
      });
      expect(result.history[3]).toEqual({
        role: 'assistant',
        content: 'Answer 4',
      });
      expect(result.history[6]).toEqual({
        role: 'user',
        content: 'Question 6',
      });
      expect(result.history[7]).toEqual({
        role: 'assistant',
        content: 'Answer 6',
      });
    });

    it('summarizes history when estimated token count exceeds maxHistoryTokens', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      });

      // 6 messages (below count threshold of 10), but each message has 4,000 characters (~1,000 tokens each)
      // Total tokens = ~6,000 tokens > maxHistoryTokens (4,000)
      const messages = [
        { role: 'user', content: 'U1: ' + 'a'.repeat(4000) },
        { role: 'assistant', content: 'A1: ' + 'b'.repeat(4000) },
        { role: 'user', content: 'U2: ' + 'c'.repeat(4000) },
        { role: 'assistant', content: 'A2: ' + 'd'.repeat(4000) },
        { role: 'user', content: 'U3: ' + 'e'.repeat(4000) },
        { role: 'assistant', content: 'A3: ' + 'f'.repeat(4000) },
      ];

      messageRepo.find.mockResolvedValue(messages);

      const result = await service.loadOrCreateSession('user-1', 'session-1');

      // Should trigger summarization because token limit is exceeded
      expect(result.history[0].role).toBe('user');
      expect(result.history[0].content).toContain(
        '[Summary of earlier conversation in this session]',
      );
    });
  });

  describe('appendExchange & pruneSessionMessages', () => {
    it('persists a user turn and an assistant turn, and bumps updatedAt', async () => {
      messageRepo.create.mockImplementation((input: unknown) => input);
      messageRepo.count.mockResolvedValue(2);

      await service.appendExchange('session-1', 'The question.', 'The reply.');

      expect(messageRepo.save).toHaveBeenCalledWith([
        { sessionId: 'session-1', role: 'user', content: 'The question.' },
        { sessionId: 'session-1', role: 'assistant', content: 'The reply.' },
      ]);
      expect(sessionRepo.update).toHaveBeenCalledTimes(1);
      const [updatedId, updatePayload] = sessionRepo.update.mock.calls[0] as [
        string,
        { updatedAt: Date },
      ];
      expect(updatedId).toBe('session-1');
      expect(updatePayload.updatedAt).toBeInstanceOf(Date);
      expect(messageRepo.delete).not.toHaveBeenCalled();
    });

    it('prunes oldest messages when session message count exceeds maxSessionMessages', async () => {
      messageRepo.create.mockImplementation((input: unknown) => input);
      // Assume total count is 54, cap is 50 -> excess is 4
      messageRepo.count.mockResolvedValue(54);
      messageRepo.find.mockResolvedValue([
        { id: 'msg-1' },
        { id: 'msg-2' },
        { id: 'msg-3' },
        { id: 'msg-4' },
      ]);
      messageRepo.delete.mockResolvedValue({ affected: 4 });

      await service.appendExchange('session-1', 'Latest Q', 'Latest A');

      expect(messageRepo.count).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
      });
      expect(messageRepo.find).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        order: { createdAt: 'ASC' },
        take: 4,
        select: ['id'],
      });
      expect(messageRepo.delete).toHaveBeenCalledWith([
        'msg-1',
        'msg-2',
        'msg-3',
        'msg-4',
      ]);
    });

    it('does not throw when persistence fails (already-generated reply must not be lost)', async () => {
      messageRepo.create.mockImplementation((input: unknown) => input);
      messageRepo.save.mockRejectedValue(new Error('db down'));

      await expect(
        service.appendExchange('session-1', 'q', 'a'),
      ).resolves.toBeUndefined();
    });

    it('does not touch updatedAt or delete when the message save fails', async () => {
      messageRepo.create.mockImplementation((input: unknown) => input);
      messageRepo.save.mockRejectedValue(new Error('db down'));

      await service.appendExchange('session-1', 'q', 'a');

      expect(sessionRepo.update).not.toHaveBeenCalled();
      expect(messageRepo.delete).not.toHaveBeenCalled();
    });

    it('handles pruning error gracefully without failing appendExchange', async () => {
      messageRepo.create.mockImplementation((input: unknown) => input);
      messageRepo.save.mockResolvedValue([]);
      messageRepo.count.mockRejectedValue(new Error('count failed'));

      await expect(
        service.appendExchange('session-1', 'q', 'a'),
      ).resolves.toBeUndefined();
      expect(sessionRepo.update).toHaveBeenCalled();
    });
  });

  describe('pruneInactiveSessions', () => {
    it('deletes sessions inactive past the retention window and returns deletion count', async () => {
      const mockStaleSessions = [
        { id: 'stale-1', updatedAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'stale-2', updatedAt: new Date('2026-01-02T00:00:00Z') },
      ];

      sessionRepo.find.mockResolvedValue(mockStaleSessions);
      messageRepo.delete.mockResolvedValue({ affected: 20 });
      sessionRepo.delete.mockResolvedValue({ affected: 2 });

      const result = await service.pruneInactiveSessions(30);

      expect(sessionRepo.find).toHaveBeenCalledWith({
        where: { updatedAt: LessThan(expect.any(Date)) },
        select: ['id'],
      });
      expect(messageRepo.delete).toHaveBeenCalledWith({
        sessionId: In(['stale-1', 'stale-2']),
      });
      expect(sessionRepo.delete).toHaveBeenCalledWith({
        id: In(['stale-1', 'stale-2']),
      });
      expect(result.deletedSessions).toBe(2);
      expect(result.cutoffDate).toBeInstanceOf(Date);
    });

    it('returns 0 deletedSessions when no stale sessions exist', async () => {
      sessionRepo.find.mockResolvedValue([]);

      const result = await service.pruneInactiveSessions(30);

      expect(result.deletedSessions).toBe(0);
      expect(sessionRepo.delete).not.toHaveBeenCalled();
      expect(messageRepo.delete).not.toHaveBeenCalled();
    });

    it('uses configured default retentionDays if not specified', async () => {
      sessionRepo.find.mockResolvedValue([]);

      const beforeCall = Date.now();
      const result = await service.pruneInactiveSessions();
      const afterCall = Date.now();

      expect(service.retentionDays).toBe(30);
      const expectedCutoffApprox = beforeCall - 30 * 24 * 60 * 60 * 1000;
      expect(result.cutoffDate.getTime()).toBeGreaterThanOrEqual(
        expectedCutoffApprox - 1000,
      );
      expect(result.cutoffDate.getTime()).toBeLessThanOrEqual(afterCall);
    });

    it('propagates error if sessionRepo.delete throws', async () => {
      sessionRepo.find.mockResolvedValue([{ id: 'stale-1' }]);
      messageRepo.delete.mockResolvedValue({});
      sessionRepo.delete.mockRejectedValue(new Error('db constraint error'));

      await expect(service.pruneInactiveSessions(30)).rejects.toThrow(
        'db constraint error',
      );
    });
  });

  describe('handleScheduledCleanup', () => {
    it('executes scheduled cleanup and logs results successfully', async () => {
      jest.spyOn(service, 'pruneInactiveSessions').mockResolvedValue({
        deletedSessions: 5,
        cutoffDate: new Date(),
      });

      await expect(service.handleScheduledCleanup()).resolves.toBeUndefined();
      expect(service.pruneInactiveSessions).toHaveBeenCalled();
    });

    it('handles scheduled cleanup failure gracefully without unhandled rejection', async () => {
      jest
        .spyOn(service, 'pruneInactiveSessions')
        .mockRejectedValue(new Error('cron error'));

      await expect(service.handleScheduledCleanup()).resolves.toBeUndefined();
    });
  });

  describe('ConfigService overrides', () => {
    it('reads custom configuration values properly', () => {
      const customConfig = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'AI_CHAT_SESSION_RETENTION_DAYS') return '14';
          if (key === 'AI_CHAT_MAX_SESSION_MESSAGES') return '25';
          if (key === 'AI_CHAT_SUMMARIZATION_THRESHOLD') return '8';
          if (key === 'AI_CHAT_MAX_HISTORY_TOKENS') return '2000';
          if (key === 'AI_CHAT_RECENT_MESSAGES_COUNT') return '4';
          return undefined;
        }),
      };

      const customService = new ChatSessionService(
        sessionRepo as never,
        messageRepo as never,
        customConfig as never,
      );

      expect(customService.retentionDays).toBe(14);
      expect(customService.maxSessionMessages).toBe(25);
      expect(customService.summarizationThreshold).toBe(8);
      expect(customService.maxHistoryTokens).toBe(2000);
      expect(customService.recentMessagesCount).toBe(4);
    });

    it('falls back to defaults when ConfigService is not provided or keys are missing', () => {
      const defaultService = new ChatSessionService(
        sessionRepo as never,
        messageRepo as never,
      );

      expect(defaultService.retentionDays).toBe(30);
      expect(defaultService.maxSessionMessages).toBe(50);
      expect(defaultService.summarizationThreshold).toBe(10);
      expect(defaultService.maxHistoryTokens).toBe(4000);
      expect(defaultService.recentMessagesCount).toBe(6);
    });
  });
});
