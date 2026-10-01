import { create } from "zustand";
import {
  sendAiChat,
  streamAiChat,
  type AiChatRequest,
} from "@/lib/api/ai-chat";

export type AiChatRole = "user" | "assistant";

export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  content: string;
};

/**
 * Request lifecycle of the single in-flight chat turn.
 * `sending` covers both "awaiting first token" and "streaming".
 */
export type AiChatStatus = "idle" | "sending" | "error";

export type AiChatStore = {
  /** Whether the floating panel is visible. */
  isOpen: boolean;
  messages: AiChatMessage[];
  /** Server-issued conversation id, reused for every later turn. */
  sessionId: string | null;
  status: AiChatStatus;
  error: string | null;

  open: () => void;
  close: () => void;
  toggle: () => void;
  sendMessage: (message: string) => Promise<void>;
  /** Retries the most recent question after a failure. */
  retry: () => Promise<void>;
  /** Aborts an in-flight reply, keeping whatever was already streamed. */
  cancel: () => void;
  /** Aborts and clears the conversation. */
  reset: () => void;
};

/**
 * Module-scoped (not part of the store snapshot) so aborting never triggers a
 * re-render, and so a single turn can be in flight at a time.
 */
let activeController: AbortController | null = null;

let messageCounter = 0;

function createMessageId(role: AiChatRole): string {
  messageCounter += 1;
  return `${role}-${Date.now()}-${messageCounter}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export const selectIsSending = (state: AiChatStore): boolean =>
  state.status === "sending";

/**
 * Conversation state for the marketplace assistant widget.
 *
 * Living in a store (rather than inside the panel component) means the
 * transcript, the server `sessionId` and the request state all survive the
 * panel being closed and reopened, so a multi-turn conversation is not lost.
 */
export const useAiChatStore = create<AiChatStore>()((set, get) => ({
  isOpen: false,
  messages: [],
  sessionId: null,
  status: "idle",
  error: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),

  cancel: () => {
    activeController?.abort();
    activeController = null;
    set((state) => (state.status === "sending" ? { status: "idle" } : {}));
  },

  reset: () => {
    activeController?.abort();
    activeController = null;
    set({ messages: [], sessionId: null, status: "idle", error: null });
  },

  retry: async () => {
    const lastQuestion = [...get().messages]
      .reverse()
      .find((message) => message.role === "user");
    if (!lastQuestion) return;
    await get().sendMessage(lastQuestion.content);
  },

  sendMessage: async (message: string) => {
    const trimmed = message.trim();
    // Ignore empty input, and extra sends while a turn is already in flight.
    if (!trimmed || activeController) return;

    const controller = new AbortController();
    activeController = controller;

    const request: AiChatRequest = {
      message: trimmed,
      // Reuse the server-issued session so context carries across turns.
      sessionId: get().sessionId ?? undefined,
    };
    const userMessage: AiChatMessage = {
      id: createMessageId("user"),
      role: "user",
      content: trimmed,
    };
    // Placeholder bubble so the loading state has somewhere to stream into.
    const assistantMessage: AiChatMessage = {
      id: createMessageId("assistant"),
      role: "assistant",
      content: "",
    };

    set((state) => ({
      status: "sending",
      error: null,
      messages: [...state.messages, userMessage, assistantMessage],
    }));

    const setAssistantContent = (content: string, append = false) =>
      set((state) => ({
        messages: state.messages.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: append ? item.content + content : content }
            : item,
        ),
      }));

    const dropEmptyAssistant = () =>
      set((state) => ({
        messages: state.messages.filter(
          (item) => item.id !== assistantMessage.id || item.content.length > 0,
        ),
      }));

    const fail = (error: unknown, fallbackMessage: string) => {
      dropEmptyAssistant();
      set({
        status: "error",
        error: error instanceof Error ? error.message : fallbackMessage,
      });
    };

    let receivedContent = false;
    try {
      const completion = await streamAiChat(
        request,
        {
          onText: (text) => {
            receivedContent = true;
            setAssistantContent(text, true);
          },
        },
        controller.signal,
      );
      setAssistantContent(completion.reply);
      set({ sessionId: completion.sessionId });
    } catch (streamError) {
      if (isAbortError(streamError) || controller.signal.aborted) {
        // Stopped by the user: keep the partial reply, drop a bare placeholder.
        dropEmptyAssistant();
        return;
      }

      if (!receivedContent) {
        // Streaming is unavailable (proxy/browser) - fall back to the plain
        // POST /ai/chat endpoint so the user still gets an answer.
        try {
          const completion = await sendAiChat(request, controller.signal);
          setAssistantContent(completion.reply);
          set({ sessionId: completion.sessionId });
        } catch (fallbackError) {
          if (!isAbortError(fallbackError) && !controller.signal.aborted) {
            fail(fallbackError, "AI assistant failed");
          }
        }
      } else {
        fail(streamError, "AI stream failed");
      }
    } finally {
      if (activeController === controller) {
        activeController = null;
        set((state) => (state.status === "sending" ? { status: "idle" } : {}));
      }
    }
  },
}));
