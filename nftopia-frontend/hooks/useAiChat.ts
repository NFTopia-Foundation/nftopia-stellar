"use client";

import { useEffect } from "react";
import { useAiChatStore } from "@/lib/stores/ai-chat-store";

export type { AiChatMessage } from "@/lib/stores/ai-chat-store";

/**
 * React binding for the AI chat store.
 *
 * All conversation state and the request lifecycle live in
 * `useAiChatStore`; this hook only adapts it to the shape the chat UI wants and
 * aborts an in-flight reply when the consumer unmounts.
 */
export function useAiChat() {
  const messages = useAiChatStore((state) => state.messages);
  const status = useAiChatStore((state) => state.status);
  const error = useAiChatStore((state) => state.error);
  const sendMessage = useAiChatStore((state) => state.sendMessage);
  const retry = useAiChatStore((state) => state.retry);
  const cancel = useAiChatStore((state) => state.cancel);

  useEffect(() => () => cancel(), [cancel]);

  return {
    messages,
    isStreaming: status === "sending",
    error,
    sendMessage,
    retry,
    cancel,
  };
}
