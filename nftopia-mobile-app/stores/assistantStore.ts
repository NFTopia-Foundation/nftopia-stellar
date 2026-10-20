import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { streamChatMessage, sendChatMessage } from '@/src/services/ai/aiChat.service';

export const ASSISTANT_STORAGE_KEY = 'assistant-storage';
export const ASSISTANT_STORE_VERSION = 1;

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  streaming?: boolean;
}

export interface AssistantState {
  messages: ChatMessage[];
  sessionId: string | null;
  isStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;
  sendMessage: (text: string) => Promise<void>;
  cancelStream: () => void;
  clearConversation: () => void;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      messages: [],
      sessionId: null,
      isStreaming: false,
      error: null,
      abortController: null,

      cancelStream: () => {
        const { abortController } = get();
        abortController?.abort();
        set({ abortController: null, isStreaming: false });
      },

      clearConversation: () => {
        get().cancelStream();
        set({ messages: [], sessionId: null, error: null });
      },

      sendMessage: async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || get().isStreaming) return;

        const userMsg: ChatMessage = {
          id: uid(),
          role: 'user',
          content: trimmed,
          createdAt: Date.now(),
        };
        const assistantId = uid();
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          streaming: true,
        };

        set((s) => ({
          messages: [...s.messages, userMsg, assistantMsg],
          isStreaming: true,
          error: null,
        }));

        let controller: AbortController | null = null;
        controller = streamChatMessage(trimmed, get().sessionId, {
          onToken: (token) => {
            if (controller?.signal.aborted) return;
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + token } : m,
              ),
            }));
          },
          onSessionId: (sessionId) => {
            if (controller?.signal.aborted) return;
            set({ sessionId });
          },
          onDone: () => {
            if (controller?.signal.aborted) return;
            set((s) => ({
              isStreaming: false,
              abortController: null,
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, streaming: false } : m,
              ),
            }));
          },
          onError: (error) => {
            if (controller?.signal.aborted) return;
            // Check if the backend session has expired or is missing (404 / not found)
            const isSessionNotFound =
              Boolean(get().sessionId) &&
              ((/session/i.test(error.message) && /not found|expired|404/i.test(error.message)) ||
                (error.message.includes('404') &&
                  (/chat/i.test(error.message) ||
                    !/nft|user|listing|order|collection|token/i.test(error.message))));

            set((s) => ({
              isStreaming: false,
              abortController: null,
              sessionId: isSessionNotFound ? null : s.sessionId,
              error: error.message,
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      streaming: false,
                      content:
                        m.content ||
                        (isSessionNotFound
                          ? 'This chat session has expired. Please send your message again to start a new session.'
                          : `Sorry, something went wrong: ${error.message}`),
                    }
                  : m,
              ),
            }));
          },
        });

        set({ abortController: controller });
      },
    }),
    {
      name: ASSISTANT_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: ASSISTANT_STORE_VERSION,
      partialize: (state) => ({
        sessionId: state.sessionId,
        messages: state.messages
          .filter((m) => m.role !== 'assistant' || m.content.trim().length > 0)
          .map((m) => (m.streaming ? { ...m, streaming: false } : m)),
      }),
      merge: (persistedState, currentState) => {
        const typedPersisted = persistedState as Partial<AssistantState> | undefined;
        const rawMessages = typedPersisted?.messages;
        const sanitizedMessages: ChatMessage[] = Array.isArray(rawMessages)
          ? rawMessages
              .filter(
                (m): m is ChatMessage =>
                  Boolean(m) &&
                  typeof m.id === 'string' &&
                  typeof m.content === 'string' &&
                  (m.role !== 'assistant' || m.content.trim().length > 0),
              )
              .map((m) => ({
                ...m,
                streaming: false,
              }))
          : [];

        return {
          ...currentState,
          messages: sanitizedMessages,
          sessionId:
            typeof typedPersisted?.sessionId === 'string' ? typedPersisted.sessionId : null,
          isStreaming: false,
          error: null,
          abortController: null,
        };
      },
    },
  ),
);

/** Exposed for unit tests that prefer the blocking path. */
export async function sendBlockingForTest(
  message: string,
  sessionId?: string | null,
) {
  return sendChatMessage(message, sessionId);
}
