import type { MessageEvent } from '@nestjs/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AiChatStreamRegistryService,
  MAX_STREAM_LIFETIME_MS,
  STREAM_RESUME_WINDOW_MS,
} from './ai-chat-stream-registry.service';

function collect(observable: {
  subscribe: (observer: {
    next: (event: MessageEvent) => void;
    error: (error: unknown) => void;
    complete: () => void;
  }) => { unsubscribe: () => void };
}) {
  const events: MessageEvent[] = [];
  let error: unknown;
  let completed = false;
  const subscription = observable.subscribe({
    next: (event) => events.push(event),
    error: (err) => {
      error = err;
    },
    complete: () => {
      completed = true;
    },
  });
  return {
    events,
    get error() {
      return error;
    },
    get completed() {
      return completed;
    },
    subscription,
  };
}

describe('AiChatStreamRegistryService', () => {
  let registry: AiChatStreamRegistryService;

  beforeEach(() => {
    registry = new AiChatStreamRegistryService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('start() returns a unique streamId per call', () => {
    const a = registry.start('user-1', 'session-1');
    const b = registry.start('user-1', 'session-1');

    expect(a.streamId).not.toBe(b.streamId);
  });

  it('a live subscriber receives events appended after it attaches', () => {
    const { streamId, append } = registry.start('user-1', 'session-1');

    const result = collect(registry.attach(streamId, 'user-1', -1));
    append({ type: 'text', data: { text: 'hello' } });
    append({ type: 'text', data: { text: ' world' } });

    expect(result.events.map((e) => e.data)).toEqual([
      { text: 'hello' },
      { text: ' world' },
    ]);
  });

  it('replays the buffer so far to a late attach, then continues live', () => {
    const { streamId, append } = registry.start('user-1', 'session-1');
    append({ type: 'text', data: { text: 'first' } });
    append({ type: 'text', data: { text: 'second' } });

    const result = collect(registry.attach(streamId, 'user-1', -1));
    append({ type: 'text', data: { text: 'third' } });

    expect(result.events.map((e) => e.data)).toEqual([
      { text: 'first' },
      { text: 'second' },
      { text: 'third' },
    ]);
  });

  describe('drop-and-resume (#644)', () => {
    it('resuming from the last seen seq delivers exactly what was missed, with no duplicates', () => {
      const { streamId, append, complete } = registry.start(
        'user-1',
        'session-1',
      );

      const first = collect(registry.attach(streamId, 'user-1', -1));
      append({ type: 'text', data: { text: 'one' } }); // seq 0
      append({ type: 'text', data: { text: 'two' } }); // seq 1

      // Connection drops: unsubscribe the first listener. The generation
      // keeps running regardless (it never knows or cares who's listening).
      first.subscription.unsubscribe();
      const lastSeqSeen = first.events.length - 1; // 1

      append({ type: 'text', data: { text: 'three' } }); // seq 2, missed by `first`
      append({ type: 'text', data: { text: 'four' } }); // seq 3, missed by `first`
      complete();

      const resumed = collect(registry.attach(streamId, 'user-1', lastSeqSeen));

      expect(resumed.events.map((e) => e.data)).toEqual([
        { text: 'three' },
        { text: 'four' },
      ]);
      expect(resumed.completed).toBe(true);

      // No duplication: between what `first` already received and what
      // `resumed` caught up on, every emitted chunk appears exactly once.
      const allDelivered = [...first.events, ...resumed.events].map(
        (e) => (e.data as { text: string }).text,
      );
      expect(allDelivered).toEqual(['one', 'two', 'three', 'four']);
    });

    it('attaching to an already-completed stream immediately replays the full buffer and completes', () => {
      const { streamId, append, complete } = registry.start(
        'user-1',
        'session-1',
      );
      append({ type: 'text', data: { text: 'hi' } });
      append({ type: 'done', data: { reply: 'hi', sessionId: 'session-1' } });
      complete();

      const result = collect(registry.attach(streamId, 'user-1', -1));

      expect(result.events).toHaveLength(2);
      expect(result.completed).toBe(true);
    });

    it('attaching to a failed stream replays the buffer then surfaces the stored error', () => {
      const { streamId, append, fail } = registry.start('user-1', 'session-1');
      append({ type: 'text', data: { text: 'partial' } });
      const failure = new Error('Anthropic rate limited');
      fail(failure);

      const result = collect(registry.attach(streamId, 'user-1', -1));

      expect(result.events).toHaveLength(1);
      expect(result.error).toBe(failure);
    });

    it('resuming past the buffer (afterSeq beyond what exists) yields nothing extra, not an error', () => {
      const { streamId, append, complete } = registry.start(
        'user-1',
        'session-1',
      );
      append({ type: 'text', data: { text: 'only' } });
      complete();

      const result = collect(registry.attach(streamId, 'user-1', 999));

      expect(result.events).toHaveLength(0);
      expect(result.completed).toBe(true);
    });
  });

  describe('ownership and existence', () => {
    it('throws ForbiddenException when a different user tries to attach', () => {
      const { streamId } = registry.start('user-1', 'session-1');

      expect(() => registry.attach(streamId, 'user-2', -1)).toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for an unknown streamId', () => {
      expect(() => registry.attach('does-not-exist', 'user-1', -1)).toThrow(
        NotFoundException,
      );
    });
  });

  describe('eviction', () => {
    it('evicts a completed stream after STREAM_RESUME_WINDOW_MS', () => {
      jest.useFakeTimers();
      const { streamId, complete } = registry.start('user-1', 'session-1');
      complete();

      jest.advanceTimersByTime(STREAM_RESUME_WINDOW_MS + 1);

      expect(() => registry.attach(streamId, 'user-1', -1)).toThrow(
        NotFoundException,
      );
    });

    it('does not evict a completed stream before the resume window elapses', () => {
      jest.useFakeTimers();
      const { streamId, complete } = registry.start('user-1', 'session-1');
      complete();

      jest.advanceTimersByTime(STREAM_RESUME_WINDOW_MS - 1);

      expect(() => registry.attach(streamId, 'user-1', -1)).not.toThrow();
    });

    it('evicts a stream that never completes after MAX_STREAM_LIFETIME_MS (safety net)', () => {
      jest.useFakeTimers();
      const { streamId } = registry.start('user-1', 'session-1');

      jest.advanceTimersByTime(MAX_STREAM_LIFETIME_MS + 1);

      expect(() => registry.attach(streamId, 'user-1', -1)).toThrow(
        NotFoundException,
      );
    });
  });
});
