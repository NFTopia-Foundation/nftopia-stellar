import { create } from 'zustand';
import { streamChatMessage, sendChatMessage } from '@/src/services/ai/aiChat.service';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  streaming?: boolean;
}

interface AssistantState {
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

export const useAssistantStore = create<AssistantState>((set, get) => ({
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

    const controller = streamChatMessage(trimmed, get().sessionId, {
      onToken: (token) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + token } : m,
          ),
        }));
      },
      onSessionId: (sessionId) => set({ sessionId }),
      onDone: () => {
        set((s) => ({
          isStreaming: false,
          abortController: null,
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m,
          ),
        }));
      },
      onError: (error) => {
        set((s) => ({
          isStreaming: false,
          abortController: null,
          error: error.message,
          messages: s.messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  content: m.content || `Sorry, something went wrong: ${error.message}`,
                }
              : m,
          ),
        }));
      },
    });

    set({ abortController: controller });
  },
}));

/** Exposed for unit tests that prefer the blocking path. */
export async function sendBlockingForTest(
  message: string,
  sessionId?: string | null,
) {
  return sendChatMessage(message, sessionId);
}
