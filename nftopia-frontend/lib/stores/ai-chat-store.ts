import { create } from "zustand";
import {
  AiQuotaExceededError,
  checkAiHealth,
  deleteAiChatSession,
  fetchAiChatSessionMessages,
  fetchAiChatSessions,
  getAiUsage,
  sendAiChat,
  streamAiChat,
  type AiChatMessageDto,
  type AiChatRequest,
  type AiUsageSummary,
  type AnthropicHealthStatus,
  type AiChatSessionSummary,
} from "@/lib/api/ai-chat";

export type AiChatRole = "user" | "assistant";

export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt?: string;
};

export type { AiChatSessionSummary };

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
  /** Latest GET /ai/usage snapshot (daily/monthly quota), or null until loaded. */
  usage: AiUsageSummary | null;
  /** Whether a usage fetch is currently in flight. */
  isLoadingUsage: boolean;
  /** Set when the most recent send was rejected for being over the daily/monthly cap. */
  quotaExceeded: { code: string; resetsAt: string } | null;

  /** List of recent chat sessions. */
  sessions: AiChatSessionSummary[];
  isLoadingSessions: boolean;
  isLoadingHistory: boolean;
  isHistoryOpen: boolean;

  open: () => void;
  close: () => void;
  toggle: () => void;
  sendMessage: (message: string) => Promise<void>;
  /** Retries the most recent question after a failure. */
  retry: () => Promise<void>;
  /** Aborts an in-flight reply, keeping whatever was already streamed. */
  cancel: () => void;
  /** Aborts and clears the active conversation turn. */
  reset: () => void;
  /** Checks backend /ai/health and updates degraded state. */
  checkHealth: () => Promise<boolean>;
  /** Refreshes the daily/monthly usage snapshot from GET /ai/usage. */
  fetchUsage: () => Promise<void>;

  /** History & session management */
  loadSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  newConversation: () => void;
  toggleHistory: () => void;
  setHistoryOpen: (open: boolean) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  clearSessions: () => void;
};

const SESSIONS_STORAGE_KEY = "nftopia_ai_chat_sessions";
const MESSAGES_STORAGE_PREFIX = "nftopia_ai_chat_msgs_";

function safeLocalStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota exceeded or disabled
  }
}

function safeLocalStorageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

export function getStoredSessions(): AiChatSessionSummary[] {
  const data = safeLocalStorageGet(SESSIONS_STORAGE_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredSessions(sessions: AiChatSessionSummary[]): void {
  safeLocalStorageSet(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
}

export function getStoredMessages(sessionId: string): AiChatMessage[] {
  const data = safeLocalStorageGet(`${MESSAGES_STORAGE_PREFIX}${sessionId}`);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredMessages(sessionId: string, messages: AiChatMessage[]): void {
  safeLocalStorageSet(`${MESSAGES_STORAGE_PREFIX}${sessionId}`, JSON.stringify(messages));
}

export function removeStoredMessages(sessionId: string): void {
  safeLocalStorageRemove(`${MESSAGES_STORAGE_PREFIX}${sessionId}`);
}

export function clearStoredSessions(): void {
  const sessions = getStoredSessions();
  for (const s of sessions) {
    removeStoredMessages(s.id);
  }
  safeLocalStorageRemove(SESSIONS_STORAGE_KEY);
}

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

/**
 * `instanceof AiQuotaExceededError` guarded against the class being absent —
 * tests that `jest.mock("@/lib/api/ai-chat")` without re-exporting it would
 * otherwise make the right-hand side `undefined` and throw.
 */
function isQuotaExceededError(error: unknown): error is AiQuotaExceededError {
  return typeof AiQuotaExceededError === "function" && error instanceof AiQuotaExceededError;
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
  usage: null,
  isLoadingUsage: false,
  quotaExceeded: null,
  sessions: [],
  isLoadingSessions: false,
  isLoadingHistory: false,
  isHistoryOpen: false,

  open: () => {
    set({ isOpen: true });
    void get().loadSessions();
  },
  close: () => set({ isOpen: false }),
  toggle: () => {
    const nextOpen = !get().isOpen;
    set({ isOpen: nextOpen });
    if (nextOpen) {
      void get().loadSessions();
    }
  },

  toggleHistory: () => set((state) => ({ isHistoryOpen: !state.isHistoryOpen })),
  setHistoryOpen: (open: boolean) => set({ isHistoryOpen: open }),

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

  fetchUsage: async () => {
    if (typeof getAiUsage !== "function") return;

    set({ isLoadingUsage: true });
    try {
      const usage = await getAiUsage();
      set({ usage, isLoadingUsage: false });
    } catch {
      // Usage display is best-effort: a failed fetch just leaves the
      // previous (or no) snapshot in place rather than surfacing an error.
      set({ isLoadingUsage: false });
    }
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
      usage: null,
      isLoadingUsage: false,
      quotaExceeded: null,
      isHistoryOpen: false,
    });
  },

  newConversation: () => {
    activeController?.abort();
    activeController = null;
    set({
      messages: [],
      sessionId: null,
      status: "idle",
      error: null,
      isHistoryOpen: false,
    });
  },

  clearSessions: () => {
    clearStoredSessions();
    set({ sessions: [] });
  },

  loadSessions: async () => {
    const local = getStoredSessions();
    if (local.length > 0 && get().sessions.length === 0) {
      set({ sessions: local });
    }
    set({ isLoadingSessions: true });
    try {
      const remote = await fetchAiChatSessions();
      const sessionMap = new Map<string, AiChatSessionSummary>();
      for (const s of remote) {
        sessionMap.set(s.id, s);
      }
      for (const s of local) {
        if (!sessionMap.has(s.id)) {
          sessionMap.set(s.id, s);
        } else {
          const existing = sessionMap.get(s.id)!;
          if (new Date(s.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
            sessionMap.set(s.id, { ...existing, ...s });
          }
        }
      }
      const merged = Array.from(sessionMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      set({ sessions: merged });
      saveStoredSessions(merged);
    } catch {
      if (local.length > 0) {
        set({ sessions: local });
      }
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  selectSession: async (sessionId: string) => {
    if (get().sessionId === sessionId && !get().isHistoryOpen) {
      return;
    }
    activeController?.abort();
    activeController = null;

    set({
      isLoadingHistory: true,
      error: null,
      isHistoryOpen: false,
      status: "idle",
    });

    const localMsgs = getStoredMessages(sessionId);
    if (localMsgs.length > 0) {
      set({ sessionId, messages: localMsgs });
    }

    try {
      const serverMsgs = await fetchAiChatSessionMessages(sessionId);
      if (serverMsgs && serverMsgs.length > 0) {
        const formatted: AiChatMessage[] = serverMsgs.map((m: AiChatMessageDto) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        }));
        set({ sessionId, messages: formatted });
        saveStoredMessages(sessionId, formatted);
      } else if (localMsgs.length > 0) {
        set({ sessionId, messages: localMsgs });
      } else {
        set({ sessionId, messages: [] });
      }
    } catch {
      if (localMsgs.length > 0) {
        set({ sessionId, messages: localMsgs });
      } else {
        set({ sessionId, messages: [] });
      }
    } finally {
      set({ isLoadingHistory: false });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await deleteAiChatSession(sessionId);
    } catch {
      // Ignore if server endpoint fails or does not exist
    }
    removeStoredMessages(sessionId);
    const updated = get().sessions.filter((s) => s.id !== sessionId);
    saveStoredSessions(updated);
    set((state) => ({
      sessions: updated,
      ...(state.sessionId === sessionId
        ? { sessionId: null, messages: [], isHistoryOpen: false }
        : {}),
    }));
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
      createdAt: new Date().toISOString(),
    };
    // Placeholder bubble so the loading state has somewhere to stream into.
    const assistantMessage: AiChatMessage = {
      id: createMessageId("assistant"),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      status: "sending",
      error: null,
      quotaExceeded: null,
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

    const recordSessionExchange = (sessionId: string, assistantReply: string) => {
      const currentSessions = get().sessions;
      const existing = currentSessions.find((s) => s.id === sessionId);
      const title =
        existing?.title ||
        (trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed);
      const preview =
        assistantReply.length > 70
          ? `${assistantReply.slice(0, 70)}…`
          : assistantReply;
      const updatedSession: AiChatSessionSummary = {
        id: sessionId,
        title,
        preview,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: get().messages.length,
      };
      const nextSessions = [
        updatedSession,
        ...currentSessions.filter((s) => s.id !== sessionId),
      ];
      set({ sessionId, sessions: nextSessions });
      saveStoredSessions(nextSessions);
      saveStoredMessages(sessionId, get().messages);
    };

    const fail = (error: unknown, fallbackMessage: string) => {
      dropEmptyAssistant();
      if (isQuotaExceededError(error)) {
        // A cap rejection is not a transient failure - it's a known,
        // specific state, so it skips the health check (the assistant
        // itself is fine) and gets its own field for a distinct UI message.
        set({
          status: "error",
          error: error.message,
          quotaExceeded: { code: error.code, resetsAt: error.resetsAt },
        });
        void get().fetchUsage();
        return;
      }
      set({
        status: "error",
        error: error instanceof Error ? error.message : fallbackMessage,
        quotaExceeded: null,
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
      recordSessionExchange(completion.sessionId, completion.reply);
      void get().fetchUsage();
    } catch (streamError) {
      if (isAbortError(streamError) || controller.signal.aborted) {
        // Stopped by the user: keep the partial reply, drop a bare placeholder.
        dropEmptyAssistant();
        return;
      }

      if (isQuotaExceededError(streamError)) {
        // Thrown before any content streamed (assertWithinCap runs up front) -
        // no point falling back to POST /ai/chat, it enforces the same cap.
        fail(streamError, "AI assistant failed");
        return;
      }

      if (!receivedContent) {
        // Streaming is unavailable (proxy/browser) - fall back to the plain
        // POST /ai/chat endpoint so the user still gets an answer.
        try {
          const completion = await sendAiChat(request, controller.signal);
          setAssistantContent(completion.reply);
          recordSessionExchange(completion.sessionId, completion.reply);
          void get().fetchUsage();
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

