import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, Subject } from 'rxjs';

/** One already-emitted event in a stream's buffer, numbered in emission order. */
interface BufferedEvent {
  seq: number;
  event: MessageEvent;
}

interface ActiveStream {
  userId: string;
  sessionId: string;
  buffer: BufferedEvent[];
  /** Live multicast: every already-attached listener (if any) gets pushed to as the generation runs. */
  subject: Subject<MessageEvent>;
  nextSeq: number;
  completed: boolean;
  error: Error | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * How long a completed (or failed) stream's buffer is kept so a
 * reconnecting client can still resume it (#644). Bounded so memory doesn't
 * grow unboundedly across many chat turns. See
 * docs/ai-chat-streaming-reconnect.md for the client-facing contract.
 */
export const STREAM_RESUME_WINDOW_MS = 2 * 60 * 1000;

/**
 * Safety net: a stream that somehow never calls complete()/fail() (a bug, a
 * hung Anthropic call) is still evicted after this long, so a leak there
 * can't grow the registry forever.
 */
export const MAX_STREAM_LIFETIME_MS = 10 * 60 * 1000;

/**
 * Decouples a chatStream() generation from any single client connection
 * (#644): the generation registers itself once per stream id, broadcasting
 * every event into a buffer plus a live Subject, so a client that drops
 * mid-stream can reconnect — via `attach()` with the sequence number it last
 * saw — and catch up on everything emitted after that point, then keep
 * receiving live events, without the generation itself ever restarting.
 *
 * Single-instance, in-memory by design: a stream can only be resumed
 * against the same backend process that started it (no cross-instance
 * broker). See docs/ai-chat-streaming-reconnect.md for what that means for
 * a multi-instance deployment.
 */
@Injectable()
export class AiChatStreamRegistryService {
  private readonly logger = new Logger(AiChatStreamRegistryService.name);
  private readonly streams = new Map<string, ActiveStream>();

  /**
   * Registers a brand-new stream and returns its id plus the handles the
   * generation loop drives it with. Call `append` for every event as it's
   * produced, and exactly one of `complete`/`fail` once the generation ends.
   */
  start(
    userId: string,
    sessionId: string,
  ): {
    streamId: string;
    append: (event: MessageEvent) => void;
    complete: () => void;
    fail: (error: Error) => void;
  } {
    const streamId = randomUUID();
    const stream: ActiveStream = {
      userId,
      sessionId,
      buffer: [],
      subject: new Subject<MessageEvent>(),
      nextSeq: 0,
      completed: false,
      error: null,
      cleanupTimer: null,
    };
    this.streams.set(streamId, stream);
    stream.cleanupTimer = setTimeout(() => {
      this.logger.warn(
        `Evicting chat stream ${streamId}: never completed within ${MAX_STREAM_LIFETIME_MS}ms`,
      );
      this.evict(streamId);
    }, MAX_STREAM_LIFETIME_MS);
    // Eviction timers are cleanup housekeeping, not real work — never hold
    // the process (or a test run) open just waiting on one of these.
    stream.cleanupTimer.unref?.();

    return {
      streamId,
      append: (event) => this.append(streamId, event),
      complete: () => this.complete(streamId),
      fail: (error) => this.fail(streamId, error),
    };
  }

  /**
   * Attaches to a stream from `afterSeq` onward (-1 to receive everything,
   * i.e. "from the start" — used for the original caller of chatStream()).
   * Synchronously replays any buffered events past that point, then — if
   * the stream hasn't finished — forwards live events until it
   * completes/errors.
   */
  attach(
    streamId: string,
    userId: string,
    afterSeq: number,
  ): Observable<MessageEvent> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new NotFoundException(
        `Chat stream ${streamId} not found or has expired`,
      );
    }
    if (stream.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this chat stream',
      );
    }

    return new Observable<MessageEvent>((subscriber) => {
      for (const buffered of stream.buffer) {
        if (buffered.seq > afterSeq) {
          subscriber.next(buffered.event);
        }
      }

      if (stream.completed) {
        if (stream.error) {
          subscriber.error(stream.error);
        } else {
          subscriber.complete();
        }
        return;
      }

      const subscription = stream.subject.subscribe({
        next: (event) => subscriber.next(event),
        error: (error: Error) => subscriber.error(error),
        complete: () => subscriber.complete(),
      });

      return () => subscription.unsubscribe();
    });
  }

  private append(streamId: string, event: MessageEvent): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    stream.buffer.push({ seq: stream.nextSeq, event });
    stream.nextSeq += 1;
    stream.subject.next(event);
  }

  private complete(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    stream.completed = true;
    stream.subject.complete();
    this.scheduleEviction(streamId);
  }

  private fail(streamId: string, error: Error): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    stream.completed = true;
    stream.error = error;
    stream.subject.error(error);
    this.scheduleEviction(streamId);
  }

  private scheduleEviction(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    if (stream.cleanupTimer) clearTimeout(stream.cleanupTimer);
    stream.cleanupTimer = setTimeout(() => {
      this.evict(streamId);
    }, STREAM_RESUME_WINDOW_MS);
    stream.cleanupTimer.unref?.();
  }

  private evict(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (stream?.cleanupTimer) clearTimeout(stream.cleanupTimer);
    this.streams.delete(streamId);
  }
}
