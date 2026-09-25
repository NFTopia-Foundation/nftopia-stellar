/**
 * AI marketplace assistant client.
 * Blocking: POST /ai/chat
 * Streaming: POST /ai/chat/stream (SSE) with fallback to blocking.
 */
import { config } from '@/src/config';
import apiClient from '@/lib/api/sample';

export interface ChatReply {
  reply: string;
  sessionId: string;
}

export interface StreamHandlers {
  onToken: (token: string) => void;
  onSessionId?: (sessionId: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json',
  };
  // apiClient keeps the bearer token; mirror it for raw fetch streams.
  // Use the public getter rather than accessing a private field.
  const token = typeof (apiClient as any).getToken === 'function' ? (apiClient as any).getToken() : undefined;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function baseUrl(): string {
  return config.api.baseUrl.replace(/\/+$/, '');
}

/** Blocking chat — POST /ai/chat */
export async function sendChatMessage(
  message: string,
  sessionId?: string | null,
  signal?: AbortSignal,
): Promise<ChatReply> {
  const response = await fetch(`${baseUrl()}/ai/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message, sessionId: sessionId ?? undefined }),
    signal,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(err.message || `Chat failed (${response.status})`);
  }
  return response.json();
}

/**
 * Streaming chat via POST /ai/chat/stream (SSE).
 * Parses `data: {...}` lines; falls back to sendChatMessage on failure.
 * Returns an AbortController so the caller can cancel on unmount.
 */
export function streamChatMessage(
  message: string,
  sessionId: string | null | undefined,
  handlers: StreamHandlers,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${baseUrl()}/ai/chat/stream`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ message, sessionId: sessionId ?? undefined }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream unavailable (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') {
            handlers.onDone?.();
            continue;
          }
          try {
            const parsed = JSON.parse(payload) as {
              token?: string;
              content?: string;
              sessionId?: string;
              done?: boolean;
            };
            if (parsed.sessionId) handlers.onSessionId?.(parsed.sessionId);
            const token = parsed.token ?? parsed.content;
            if (token) handlers.onToken(token);
            if (parsed.done) handlers.onDone?.();
          } catch {
            // plain-text token
            handlers.onToken(payload);
          }
        }
      }
      handlers.onDone?.();
    } catch (err) {
      if (controller.signal.aborted) return;
      // Fallback to blocking endpoint
      try {
        const result = await sendChatMessage(message, sessionId, controller.signal);
        if (result.sessionId) handlers.onSessionId?.(result.sessionId);
        if (result.reply) handlers.onToken(result.reply);
        handlers.onDone?.();
      } catch (fallbackErr) {
        handlers.onError?.(
          fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)),
        );
      }
    }
  })();

  return controller;
}
