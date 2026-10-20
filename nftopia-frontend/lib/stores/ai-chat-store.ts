import { create } from "zustand";
import {
  checkAiHealth,
  sendAiChat,
  streamAiChat,
  type AiChatRequest,
  type AnthropicHealthStatus,
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
  /** Status reported by GET /ai/health ('up' | 'down' | 'unconfigured' | null) */
  healthStatus: AnthropicHealthStatus | null;
  /** Whether the AI assistant is in a degraded/unavailable state. */
  isDegraded: boolean;
  /** Whether a health check is currently in flight. */
  isCheckingHealth: boolean;

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
  /** Checks backend /ai/health and updates degraded state. */
  checkHealth: () => Promise<boolean>;
};

/**
 * Module-scoped (not part of the store snapshot) so aborting never triggers a
 * re-render, and so a single turn can be in flight at a time.
 */
let activeController: AbortController | null = null;
let activeHealthPromise: Promise<boolean> | null = null;

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
  healthStatus: null,
  isDegraded: false,
  isCheckingHealth: false,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),

  checkHealth: async () => {
    if (activeHealthPromise) {
      return activeHealthPromise;
    }

    if (typeof checkAiHealth !== "function") {
      set({ isDegraded: false, isCheckingHealth: false, healthStatus: "up" });
      return true;
    }

    set({ isCheckingHealth: true });

    activeHealthPromise = (async () => {
      try {
        const result = await checkAiHealth();
        const isDegraded = result.status !== "up";
        set({
          healthStatus: result.status,
          isDegraded,
          isCheckingHealth: false,
        });
        return !isDegraded;
      } catch (err) {
        if (isAbortError(err)) {
          set({ isCheckingHealth: false });
          return false;
        }
        set({
          healthStatus: "down",
          isDegraded: true,
          isCheckingHealth: false,
        });
        return false;
      } finally {
        activeHealthPromise = null;
      }
    })();

    return activeHealthPromise;
  },

  cancel: () => {
    activeController?.abort();
    activeController = null;
    set((state) => (state.status === "sending" ? { status: "idle" } : {}));
  },

  reset: () => {
    activeController?.abort();
    activeController = null;
    activeHealthPromise = null;
    set({
      messages: [],
      sessionId: null,
      status: "idle",
      error: null,
      healthStatus: null,
      isDegraded: false,
      isCheckingHealth: false,
    });
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
    // Ignore empty input, sends while degraded, and extra sends while a turn is already in flight.
    if (!trimmed || activeController || get().isDegraded) return;

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
      void get().checkHealth();
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

