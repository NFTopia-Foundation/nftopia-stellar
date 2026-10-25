// ── Mocks ─────────────────────────────────────────────────────────────────────

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const asyncStorageStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(asyncStorageStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    asyncStorageStore[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete asyncStorageStore[key];
    return Promise.resolve();
  }),
  mergeItem: jest.fn(),
  clear: jest.fn(() => {
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(asyncStorageStore))),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('@/src/services/ai/aiChat.service', () => ({
  streamChatMessage: jest.fn(),
  sendChatMessage: jest.fn(),
}));


jest.mock('@/lib/api/sample', () => ({
  __esModule: true,
  default: {
    getAIUsage: jest.fn().mockResolvedValue({
      daily: { remaining: 100 },
      monthly: { remaining: 100 },
    }),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useAssistantStore, ASSISTANT_STORAGE_KEY } from '../assistantStore';
import { streamChatMessage, sendChatMessage } from '@/src/services/ai/aiChat.service';

const mockedStreamChatMessage = streamChatMessage as jest.MockedFunction<typeof streamChatMessage>;
const mockedSendChatMessage = sendChatMessage as jest.MockedFunction<typeof sendChatMessage>;

function getStore() {
  return useAssistantStore.getState();
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('assistantStore persistence and lifecycle', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    useAssistantStore.setState({
      messages: [],
      sessionId: null,
      isStreaming: false,
      error: null,
      abortController: null,
    });
    await flushPromises();
  });

  describe('message sending and persistence', () => {
    it('persists user message, assistant response, and sessionId to AsyncStorage', async () => {
      let capturedHandlers: any;
      const abortController = new AbortController();

      mockedStreamChatMessage.mockImplementation((message, sessionId, handlers) => {
        capturedHandlers = handlers;
        return abortController;
      });

      const sendPromise = getStore().sendMessage('Hello AI');

      // Check immediate state
      expect(getStore().isStreaming).toBe(true);
      expect(getStore().messages).toHaveLength(2);
      expect(getStore().messages[0].content).toBe('Hello AI');
      expect(getStore().messages[1].role).toBe('assistant');
      expect(getStore().messages[1].streaming).toBe(true);

      // Simulate streaming events
      capturedHandlers.onSessionId('session-xyz');
      capturedHandlers.onToken('Hello ');
      capturedHandlers.onToken('there!');
      capturedHandlers.onDone();

      await sendPromise;
      await flushPromises();

      // Verify in-memory state
      expect(getStore().isStreaming).toBe(false);
      expect(getStore().sessionId).toBe('session-xyz');
      expect(getStore().messages[1].content).toBe('Hello there!');
      expect(getStore().messages[1].streaming).toBe(false);

      // Verify persisted state in AsyncStorage
      const rawStored = asyncStorageStore[ASSISTANT_STORAGE_KEY];
      expect(rawStored).toBeDefined();

      const parsed = JSON.parse(rawStored);
      expect(parsed.state.sessionId).toBe('session-xyz');
      expect(parsed.state.messages).toHaveLength(2);
      expect(parsed.state.messages[0].content).toBe('Hello AI');
      expect(parsed.state.messages[1].content).toBe('Hello there!');
      expect(parsed.state.messages[1].streaming).toBe(false);
    });

    it('subsequent messages reuse the restored session ID', async () => {
      useAssistantStore.setState({
        sessionId: 'existing-session-456',
        messages: [{ id: '1', role: 'user', content: 'prior query', createdAt: 100 }],
      });

      const abortController = new AbortController();
      mockedStreamChatMessage.mockImplementation((_message, _sessionId, handlers) => {
        handlers.onDone?.();
        return abortController;
      });

      await getStore().sendMessage('Next question');

      expect(mockedStreamChatMessage).toHaveBeenCalledWith(
        'Next question',
        'existing-session-456',
        expect.any(Object),
      );
    });
  });

  describe('rehydration across app restarts', () => {
    it('rehydrates saved messages and sessionId while resetting transient states', async () => {
      // Seed persisted data as if saved from a previous app run
      const savedData = {
        state: {
          sessionId: 'persisted-session-123',
          messages: [
            { id: 'msg-1', role: 'user', content: 'What is Stellar?', createdAt: 1000 },
            { id: 'msg-2', role: 'assistant', content: 'Stellar is a blockchain.', createdAt: 1001, streaming: false },
          ],
        },
        version: 1,
      };
      asyncStorageStore[ASSISTANT_STORAGE_KEY] = JSON.stringify(savedData);

      // Trigger rehydration via persist API
      await useAssistantStore.persist.rehydrate();
      await flushPromises();

      const state = getStore();
      expect(state.sessionId).toBe('persisted-session-123');
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].content).toBe('What is Stellar?');
      expect(state.messages[1].content).toBe('Stellar is a blockchain.');
      expect(state.isStreaming).toBe(false);
      expect(state.error).toBeNull();
      expect(state.abortController).toBeNull();
    });

    it('sanitizes interrupted streaming messages: clears streaming flag and removes empty placeholders', async () => {
      // Simulate state where app was killed mid-stream:
      // - msg-2 was interrupted with partial content and streaming: true
      // - msg-3 was interrupted with empty placeholder and streaming: true
      const interruptedData = {
        state: {
          sessionId: 'session-interrupted',
          messages: [
            { id: 'msg-1', role: 'user', content: 'Explain NFTs', createdAt: 100 },
            { id: 'msg-2', role: 'assistant', content: 'NFTs are non-fungible', createdAt: 101, streaming: true },
            { id: 'msg-3', role: 'assistant', content: '', createdAt: 102, streaming: true },
          ],
        },
        version: 1,
      };
      asyncStorageStore[ASSISTANT_STORAGE_KEY] = JSON.stringify(interruptedData);

      await useAssistantStore.persist.rehydrate();
      await flushPromises();

      const state = getStore();
      // Empty assistant placeholder msg-3 should be stripped
      expect(state.messages).toHaveLength(2);
      expect(state.messages[1].id).toBe('msg-2');
      expect(state.messages[1].content).toBe('NFTs are non-fungible');
      // streaming flag must be reset to false so UI doesn't spin forever
      expect(state.messages[1].streaming).toBe(false);
      expect(state.isStreaming).toBe(false);
    });
  });

  describe('clearConversation (New Conversation)', () => {
    it('aborts active stream, clears messages and sessionId, and persists cleared state', async () => {
      const abortSpy = jest.fn();
      const mockController = { abort: abortSpy } as unknown as AbortController;

      useAssistantStore.setState({
        messages: [{ id: '1', role: 'user', content: 'Old chat', createdAt: 100 }],
        sessionId: 'session-to-clear',
        isStreaming: true,
        error: 'Prior error',
        abortController: mockController,
      });

      getStore().clearConversation();
      await flushPromises();

      expect(abortSpy).toHaveBeenCalled();
      expect(getStore().messages).toEqual([]);
      expect(getStore().sessionId).toBeNull();
      expect(getStore().error).toBeNull();
      expect(getStore().isStreaming).toBe(false);
      expect(getStore().abortController).toBeNull();

      // Verify cleared state is persisted to storage so old messages cannot reappear
      const rawStored = asyncStorageStore[ASSISTANT_STORAGE_KEY];
      const parsed = JSON.parse(rawStored);
      expect(parsed.state.messages).toEqual([]);
      expect(parsed.state.sessionId).toBeNull();
    });
  });

  describe('error handling and session expiration', () => {
    it('resets sessionId when backend returns 404 session not found', async () => {
      let capturedHandlers: any;
      mockedStreamChatMessage.mockImplementation((_msg, _sess, handlers) => {
        capturedHandlers = handlers;
        return new AbortController();
      });

      useAssistantStore.setState({
        sessionId: 'expired-session-999',
        messages: [],
      });

      const sendPromise = getStore().sendMessage('Hi again');

      // Backend returns 404 not found error
      capturedHandlers.onError(new Error('Chat session expired-session-999 not found (HTTP 404)'));
      await sendPromise;
      await flushPromises();

      expect(getStore().sessionId).toBeNull();
      expect(getStore().isStreaming).toBe(false);
      expect(getStore().error).toContain('not found');
      expect(getStore().messages[1].content).toContain('expired');
    });

    it('does NOT reset sessionId on general network/transient error', async () => {
      let capturedHandlers: any;
      mockedStreamChatMessage.mockImplementation((_msg, _sess, handlers) => {
        capturedHandlers = handlers;
        return new AbortController();
      });

      useAssistantStore.setState({
        sessionId: 'valid-session-111',
        messages: [],
      });

      const sendPromise = getStore().sendMessage('Hi again');

      capturedHandlers.onError(new Error('Network request failed'));
      await sendPromise;
      await flushPromises();

      // Session ID should be preserved
      expect(getStore().sessionId).toBe('valid-session-111');
      expect(getStore().error).toBe('Network request failed');
    });

    it('does NOT reset sessionId on unrelated not-found error (e.g. NFT or User not found)', async () => {
      let capturedHandlers: any;
      mockedStreamChatMessage.mockImplementation((_msg, _sess, handlers) => {
        capturedHandlers = handlers;
        return new AbortController();
      });

      useAssistantStore.setState({
        sessionId: 'valid-session-222',
        messages: [],
      });

      const sendPromise = getStore().sendMessage('Check this NFT');

      capturedHandlers.onError(new Error('NFT listing #1234 not found'));
      await sendPromise;
      await flushPromises();

      // Session ID should be preserved because the error is about a domain entity, not the chat session
      expect(getStore().sessionId).toBe('valid-session-222');
      expect(getStore().error).toBe('NFT listing #1234 not found');
    });
  });

  describe('cancelStream and concurrency protection', () => {
    it('aborts active controller and sets isStreaming to false without wiping history', () => {
      const abortSpy = jest.fn();
      const mockController = { abort: abortSpy } as unknown as AbortController;

      useAssistantStore.setState({
        messages: [{ id: '1', role: 'user', content: 'Keep this', createdAt: 100 }],
        sessionId: 'keep-session',
        isStreaming: true,
        abortController: mockController,
      });

      getStore().cancelStream();

      expect(abortSpy).toHaveBeenCalled();
      expect(getStore().isStreaming).toBe(false);
      expect(getStore().abortController).toBeNull();
      expect(getStore().sessionId).toBe('keep-session');
      expect(getStore().messages).toHaveLength(1);
    });

    it('ignores stale stream callbacks after stream is cancelled or cleared', async () => {
      let capturedHandlers: any;
      const abortController = new AbortController();

      mockedStreamChatMessage.mockImplementation((_msg, _sess, handlers) => {
        capturedHandlers = handlers;
        return abortController;
      });

      const sendPromise = getStore().sendMessage('First message');
      expect(getStore().isStreaming).toBe(true);

      // User clears conversation while stream is in flight
      getStore().clearConversation();
      expect(getStore().messages).toHaveLength(0);
      expect(getStore().sessionId).toBeNull();

      // Late callbacks arrive from network after abort
      capturedHandlers.onToken('Late arriving token');
      capturedHandlers.onSessionId('stale-session-id');
      capturedHandlers.onDone();
      capturedHandlers.onError(new Error('Stream failed'));

      await sendPromise;
      await flushPromises();

      // Ensure state was not corrupted by stale callbacks
      expect(getStore().messages).toHaveLength(0);
      expect(getStore().sessionId).toBeNull();
      expect(getStore().isStreaming).toBe(false);
      expect(getStore().error).toBeNull();
    });
  });
});
