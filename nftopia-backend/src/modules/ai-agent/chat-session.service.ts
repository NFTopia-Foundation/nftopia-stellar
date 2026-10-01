import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, LessThan, Repository } from 'typeorm';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatTurnDto } from './dto/chat-request.dto';

export interface LoadedChatSession {
  session: ChatSession;
  history: ChatTurnDto[];
}

export interface PruneSessionsResult {
  deletedSessions: number;
  cutoffDate: Date;
}

/**
 * Estimates token count for a text string using the standard LLM rule-of-thumb (~4 chars/token).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Condenses a list of older chat messages into a concise summary pair to reduce
 * token usage while maintaining context and proper user/assistant turn alternation.
 */
export function summarizeHistory(olderMessages: ChatMessage[]): ChatTurnDto[] {
  if (!olderMessages || olderMessages.length === 0) {
    return [];
  }

  const summaries: string[] = [];
  for (let i = 0; i < olderMessages.length; i++) {
    const msg = olderMessages[i];
    const rolePrefix = msg.role === 'user' ? 'User' : 'Assistant';
    const contentPreview =
      msg.content.length > 120
        ? `${msg.content.slice(0, 117)}...`
        : msg.content;
    summaries.push(
      `- ${rolePrefix}: "${contentPreview.replace(/\r?\n+/g, ' ')}"`,
    );
  }

  return [
    {
      role: 'user',
      content: `[Summary of earlier conversation in this session]\n${summaries.join('\n')}`,
    },
    {
      role: 'assistant',
      content:
        'Understood. I have the context of our earlier discussion and will continue assisting you.',
    },
  ];
}

/**
 * Owns chat_sessions and chat_messages persistence, lifecycle management, and
 * token-efficient history preparation for the AI assistant.
 *
 * Retention & Pruning Policy:
 * ----------------------------
 * 1. Stale Session Eviction:
 *    Chat sessions inactive for longer than AI_CHAT_SESSION_RETENTION_DAYS (default: 30 days)
 *    are automatically pruned by a daily scheduled cleanup job (`handleScheduledCleanup`).
 *    Associated messages and tool call logs are cascaded and deleted. This prevents unbounded
 *    database table growth and satisfies user privacy/PII data minimization requirements.
 *
 * 2. Per-Session Message Cap:
 *    A single conversation session is capped at AI_CHAT_MAX_SESSION_MESSAGES (default: 50).
 *    When new exchanges are appended beyond this cap, the oldest messages are pruned from the
 *    database, preventing runaway table growth for long-lived sessions.
 *
 * 3. In-Context History Summarization & Truncation:
 *    When preparing conversation history for LLM invocation, if message count exceeds
 *    AI_CHAT_SUMMARIZATION_THRESHOLD (default: 10) or estimated token count exceeds
 *    AI_CHAT_MAX_HISTORY_TOKENS (default: 4000), older turns are condensed into a structured
 *    summary while keeping the most recent AI_CHAT_RECENT_MESSAGES_COUNT (default: 6) messages
 *    intact. This drastically reduces per-turn token consumption and spend.
 */
@Injectable()
export class ChatSessionService {
  private readonly logger = new Logger(ChatSessionService.name);

  readonly retentionDays: number;
  readonly maxSessionMessages: number;
  readonly summarizationThreshold: number;
  readonly maxHistoryTokens: number;
  readonly recentMessagesCount: number;

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly configService?: ConfigService,
  ) {
    this.retentionDays = Number(
      this.configService?.get('AI_CHAT_SESSION_RETENTION_DAYS') ?? 30,
    );
    this.maxSessionMessages = Number(
      this.configService?.get('AI_CHAT_MAX_SESSION_MESSAGES') ?? 50,
    );
    this.summarizationThreshold = Number(
      this.configService?.get('AI_CHAT_SUMMARIZATION_THRESHOLD') ?? 10,
    );
    this.maxHistoryTokens = Number(
      this.configService?.get('AI_CHAT_MAX_HISTORY_TOKENS') ?? 4000,
    );
    this.recentMessagesCount = Number(
      this.configService?.get('AI_CHAT_RECENT_MESSAGES_COUNT') ?? 6,
    );
  }

  /**
   * Prepares conversation history for LLM consumption, performing summarization
   * and truncation if message count or estimated token limits are exceeded.
   */
  prepareModelHistory(messages: ChatMessage[]): ChatTurnDto[] {
    if (!messages || messages.length === 0) {
      return [];
    }

    const totalTokens = messages.reduce(
      (acc, m) => acc + estimateTokens(m.content),
      0,
    );

    const shouldSummarize =
      messages.length > this.summarizationThreshold ||
      totalTokens > this.maxHistoryTokens;

    if (!shouldSummarize) {
      return messages.map((m) => ({ role: m.role, content: m.content }));
    }

    // Determine how many recent messages to keep verbatim
    let recentCount = Math.min(this.recentMessagesCount, messages.length);
    if (recentCount % 2 !== 0) {
      recentCount -= 1;
    }

    // If recentCount covers all messages but we still need to summarize (e.g. token limit exceeded),
    // reduce recentCount to leave older turns to be summarized
    if (recentCount >= messages.length && messages.length >= 4) {
      recentCount = 2;
    }

    if (recentCount >= messages.length) {
      return messages.map((m) => ({ role: m.role, content: m.content }));
    }

    const older = messages.slice(0, messages.length - recentCount);
    const recent = messages.slice(messages.length - recentCount);

    const summaryTurns = summarizeHistory(older);
    const recentTurns: ChatTurnDto[] = recent.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    return [...summaryTurns, ...recentTurns];
  }

  /**
   * With no sessionId, starts a new (empty) session. With one, loads it —
   * throwing NotFoundException if it doesn't exist, or ForbiddenException
   * if it belongs to a different user — and returns its history (summarized
   * if long), ready to feed straight into the model.
   */
  async loadOrCreateSession(
    userId: string,
    sessionId?: string,
  ): Promise<LoadedChatSession> {
    if (!sessionId) {
      const session = await this.sessionRepo.save(
        this.sessionRepo.create({ userId }),
      );
      return { session, history: [] };
    }

    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException(`Chat session ${sessionId} not found`);
    }
    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this chat session',
      );
    }

    const messages = await this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });

    return {
      session,
      history: this.prepareModelHistory(messages),
    };
  }

  /**
   * Persists both turns of a completed exchange, bumps updatedAt, and prunes
   * older messages if the session message cap is exceeded.
   */
  async appendExchange(
    sessionId: string,
    userMessage: string,
    assistantReply: string,
  ): Promise<void> {
    try {
      await this.messageRepo.save([
        this.messageRepo.create({
          sessionId,
          role: 'user',
          content: userMessage,
        }),
        this.messageRepo.create({
          sessionId,
          role: 'assistant',
          content: assistantReply,
        }),
      ]);
      await this.sessionRepo.update(sessionId, { updatedAt: new Date() });

      // Enforce per-session database message cap
      await this.pruneSessionMessages(sessionId);
    } catch (error) {
      this.logger.error(
        `Failed to persist chat exchange for session=${sessionId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Removes oldest messages exceeding maxSessionMessages cap for a specific session.
   */
  async pruneSessionMessages(sessionId: string): Promise<number> {
    try {
      const totalCount = await this.messageRepo.count({
        where: { sessionId },
      });

      if (totalCount > this.maxSessionMessages) {
        const excessCount = totalCount - this.maxSessionMessages;
        const oldestMessages = await this.messageRepo.find({
          where: { sessionId },
          order: { createdAt: 'ASC' },
          take: excessCount,
          select: ['id'],
        });

        if (oldestMessages && oldestMessages.length > 0) {
          const idsToDelete = oldestMessages.map((m) => m.id);
          await this.messageRepo.delete(idsToDelete);
          this.logger.debug?.(
            `Pruned ${idsToDelete.length} excess message(s) from session=${sessionId} (cap: ${this.maxSessionMessages})`,
          );
          return idsToDelete.length;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to prune excess messages for session=${sessionId}: ${(error as Error).message}`,
      );
    }
    return 0;
  }

  /**
   * Archives or deletes chat sessions that have not been updated within the
   * configured retention window (default 30 days).
   *
   * @param retentionDays Optional retention window override in days
   * @returns Object containing the count of deleted sessions and the cutoff date
   */
  async pruneInactiveSessions(
    retentionDays?: number,
  ): Promise<PruneSessionsResult> {
    const days = retentionDays ?? this.retentionDays;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const staleSessions = await this.sessionRepo.find({
      where: { updatedAt: LessThan(cutoffDate) },
      select: ['id'],
    });

    if (!staleSessions || staleSessions.length === 0) {
      return { deletedSessions: 0, cutoffDate };
    }

    const sessionIds = staleSessions.map((s) => s.id);

    // Clean up associated messages
    try {
      await this.messageRepo.delete({ sessionId: In(sessionIds) });
    } catch (err) {
      this.logger.warn(
        `Bulk message deletion error, relying on cascade: ${(err as Error).message}`,
      );
    }

    let deletedSessions = sessionIds.length;
    try {
      const deleteResult = await this.sessionRepo.delete({
        id: In(sessionIds),
      });
      deletedSessions = deleteResult?.affected ?? sessionIds.length;
    } catch (err) {
      this.logger.error(
        `Failed to delete stale sessions from database: ${(err as Error).message}`,
      );
      throw err;
    }

    this.logger.log(
      `Pruned ${deletedSessions} stale chat session(s) inactive since ${cutoffDate.toISOString()} (> ${days} days)`,
    );

    return { deletedSessions, cutoffDate };
  }

  /**
   * Daily cron job triggering cleanup of sessions past the retention window.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleScheduledCleanup(): Promise<void> {
    try {
      this.logger.log('Starting scheduled chat session pruning job');
      const result = await this.pruneInactiveSessions();
      this.logger.log(
        `Scheduled chat session cleanup complete: deleted ${result.deletedSessions} session(s) inactive for >${this.retentionDays} days`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled chat session cleanup failed: ${(error as Error).message}`,
      );
    }
  }
}
