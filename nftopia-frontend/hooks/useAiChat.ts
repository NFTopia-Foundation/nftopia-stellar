"use client";

import { useEffect } from "react";
import {
  useAiChatStore,
  type AiChatMessage,
  type AiChatSessionSummary,
} from "@/lib/stores/ai-chat-store";

export type { AiChatMessage, AiChatSessionSummary };

/**
 * React binding for the AI chat store.
 *
 * All conversation state, history, and the request lifecycle live in
 * `useAiChatStore`; this hook adapts it to the shape the chat UI needs and
 * aborts an in-flight reply when the consumer unmounts.
 */
export function useAiChat() {
  const messages = useAiChatStore((state) => state.messages);
  const status = useAiChatStore((state) => state.status);
  const error = useAiChatStore((state) => state.error);
  const healthStatus = useAiChatStore((state) => state.healthStatus);
  const isDegraded = useAiChatStore((state) => state.isDegraded);
  const isCheckingHealth = useAiChatStore((state) => state.isCheckingHealth);
  const usage = useAiChatStore((state) => state.usage);
  const isLoadingUsage = useAiChatStore((state) => state.isLoadingUsage);
  const quotaExceeded = useAiChatStore((state) => state.quotaExceeded);
  const sessionId = useAiChatStore((state) => state.sessionId);
  const sessions = useAiChatStore((state) => state.sessions);
  const isLoadingSessions = useAiChatStore((state) => state.isLoadingSessions);
  const isLoadingHistory = useAiChatStore((state) => state.isLoadingHistory);
  const isHistoryOpen = useAiChatStore((state) => state.isHistoryOpen);

  const sendMessage = useAiChatStore((state) => state.sendMessage);
  const retry = useAiChatStore((state) => state.retry);
  const cancel = useAiChatStore((state) => state.cancel);
  const reset = useAiChatStore((state) => state.reset);
  const checkHealth = useAiChatStore((state) => state.checkHealth);
  const fetchUsage = useAiChatStore((state) => state.fetchUsage);
  const loadSessions = useAiChatStore((state) => state.loadSessions);
  const selectSession = useAiChatStore((state) => state.selectSession);
  const newConversation = useAiChatStore((state) => state.newConversation);
  const toggleHistory = useAiChatStore((state) => state.toggleHistory);
  const setHistoryOpen = useAiChatStore((state) => state.setHistoryOpen);
  const deleteSession = useAiChatStore((state) => state.deleteSession);
  const clearSessions = useAiChatStore((state) => state.clearSessions);

  useEffect(() => () => cancel(), [cancel]);

  return {
    messages,
    isStreaming: status === "sending",
    status,
    error,
    healthStatus,
    isDegraded,
    isCheckingHealth,
    usage,
    isLoadingUsage,
    quotaExceeded,
    sessionId,
    sessions,
    isLoadingSessions,
    isLoadingHistory,
    isHistoryOpen,
    sendMessage,
    retry,
    cancel,
    reset,
    checkHealth,
    fetchUsage,
    loadSessions,
    selectSession,
    newConversation,
    toggleHistory,
    setHistoryOpen,
    deleteSession,
    clearSessions,
  };
}
