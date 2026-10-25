import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { streamChatMessage, sendChatMessage } from '@/src/services/ai/aiChat.service';
import apiClient from '@/lib/api/sample';

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

export interface UsageWindow {
  totalTokens: number;
  estimatedCostUsd: number;
  cap: number;
  remaining: number;
  spendCapUsd: number | null;
  spendRemaining: number | null;
  percentUsed: number;
  approachingCap: boolean;
  resetsAt: string;
}

export interface AIUsage {
  daily: UsageWindow;
  monthly: UsageWindow;
  hasOverride: boolean;
}

interface AssistantState {
  messages: ChatMessage[];
  sessionId: string | null;
  isStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;
  usage: AIUsage | null;
  isQuotaExhausted: boolean;
  fetchUsage: () => Promise<void>;
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
      usage: null,
      isQuotaExhausted: false,

      fetchUsage: async () => {
        try {
          const usage = await apiClient.getAIUsage();
          const isQuotaExhausted = usage.daily.remaining === 0 || usage.monthly.remaining === 0;
          set({ usage, isQuotaExhausted });
        } catch (err) {
          // Silently fail usage fetch - non-critical
          console.error('Failed to fetch AI usage:', err);
        }
      },

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
            // Refresh usage after successful message
            get().fetchUsage();
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

            let errorMessage = error.message;
            // Check if it's a quota-exhausted error
            if (error.message.includes('AI_DAILY_TOKEN_CAP_REACHED') ||
                error.message.includes('AI_MONTHLY_TOKEN_CAP_REACHED') ||
                error.message.includes('AI_DAILY_SPEND_CAP_REACHED') ||
                error.message.includes('AI_MONTHLY_SPEND_CAP_REACHED')) {
              errorMessage = 'You have reached your AI chat quota. Please try again later.';
            }

            set((s) => ({
              isStreaming: false,
              abortController: null,
              sessionId: isSessionNotFound ? null : s.sessionId,
              error: errorMessage,
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      streaming: false,
                      content:
                        m.content ||
                        (isSessionNotFound
                          ? 'This chat session has expired. Please send your message again to start a new session.'
                          : errorMessage),
                    }
                  : m,
              ),
            }));
            // Refresh usage on error to show updated quota
            get().fetchUsage();
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
          usage: null,
          isQuotaExhausted: false,
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
