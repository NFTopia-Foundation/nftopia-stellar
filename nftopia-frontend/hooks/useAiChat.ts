"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  sendAiChat,
  streamAiChat,
  type AiChatRequest,
} from "@/lib/api/ai-chat";

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useAiChat() {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (message: string, sessionId?: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || controllerRef.current) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}`;
    const request: AiChatRequest = {
      message: trimmedMessage,
      sessionId: sessionId || sessionIdRef.current,
    };
    setError(null);
    setIsStreaming(true);
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: trimmedMessage },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    let receivedContent = false;
    try {
      const completion = await streamAiChat(
        request,
        {
          onText: (text) => {
            receivedContent = true;
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId
                  ? { ...item, content: item.content + text }
                  : item,
              ),
            );
          },
        },
        controller.signal,
      );
      sessionIdRef.current = completion.sessionId;
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId ? { ...item, content: completion.reply } : item,
        ),
      );
    } catch (streamError) {
      if (isAbortError(streamError) || controller.signal.aborted) return;

      if (!receivedContent) {
        try {
          const completion = await sendAiChat(request, controller.signal);
          sessionIdRef.current = completion.sessionId;
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId ? { ...item, content: completion.reply } : item,
            ),
          );
        } catch (fallbackError) {
          if (!isAbortError(fallbackError) && !controller.signal.aborted) {
            setError(fallbackError instanceof Error ? fallbackError.message : "AI assistant failed");
          }
        }
      } else {
        setError(streamError instanceof Error ? streamError.message : "AI stream failed");
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setIsStreaming(false);
      }
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return { messages, isStreaming, error, sendMessage, cancel };
}