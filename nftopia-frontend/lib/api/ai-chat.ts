import { API_CONFIG } from "@/lib/config";

export type AiChatRequest = {
  message: string;
  sessionId?: string;
};

export type AiChatReply = {
  reply: string;
  sessionId: string;
};

export type AiChatSessionSummary = {
  id: string;
  title?: string;
  preview?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

export type AiChatMessageDto = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

type StreamEvent = {
  type?: string;
  data?: unknown;
};

export type AiChatStreamHandlers = {
  onText?: (text: string) => void;
  onToolCall?: (name: string) => void;
};

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
}

/**
 * Thrown when the backend rejects a chat request because the caller's
 * daily/monthly AI usage cap has already been reached. Mirrors the 403 body
 * AiUsageService.assertWithinCap throws on the backend: a machine-readable
 * `code` plus `resetsAt`, not just a prose message, so the UI can show a
 * specific "quota exhausted" state instead of a generic failure.
 */
export class AiQuotaExceededError extends Error {
  readonly code: string;
  readonly resetsAt: string;

  constructor(message: string, code: string, resetsAt: string) {
    super(message);
    this.name = "AiQuotaExceededError";
    this.code = code;
    this.resetsAt = resetsAt;
  }
}

type CapExceededBody = {
  code?: unknown;
  message?: unknown;
  resetsAt?: unknown;
};

/**
 * Builds the error to throw for a non-ok /ai/chat or /ai/chat/stream
 * response, distinguishing a cap-exceeded rejection (403 with a
 * `code`/`resetsAt` body) from any other failure. Falls back to a generic
 * status-based error whenever the body isn't readable or doesn't match
 * that shape, so this stays safe to call on any non-ok response.
 */
async function buildChatError(response: Response, fallback: string): Promise<Error> {
  if (response.status === 403) {
    try {
      const body = (await response.json()) as CapExceededBody;
      if (typeof body.code === "string" && typeof body.resetsAt === "string") {
        return new AiQuotaExceededError(
          typeof body.message === "string" ? body.message : fallback,
          body.code,
          body.resetsAt,
        );
      }
    } catch {
      // Body wasn't readable/JSON — fall through to the generic error below.
    }
  }
  return new Error(fallback);
}

function parseEvent(block: string): StreamEvent | null {
  const lines = block.split(/\r?\n/);
  const eventType = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data) return eventType ? { type: eventType } : null;

  try {
    return { type: eventType, data: JSON.parse(data) };
  } catch {
    throw new Error("AI stream returned invalid event data");
  }
}

function handleEvent(
  event: StreamEvent,
  handlers: AiChatStreamHandlers,
): AiChatReply | null {
  if (event.type === "error") {
    const message =
      typeof event.data === "string"
        ? event.data
        : "AI assistant stream failed";
    throw new Error(message);
  }

  if (event.type === "text") {
    const text = (event.data as { text?: unknown } | undefined)?.text;
    if (typeof text === "string") handlers.onText?.(text);
  }

  if (event.type === "tool_call") {
    const name = (event.data as { name?: unknown } | undefined)?.name;
    if (typeof name === "string") handlers.onToolCall?.(name);
  }

  if (event.type === "done") {
    const data = event.data as Partial<AiChatReply> | undefined;
    if (typeof data?.reply !== "string" || typeof data.sessionId !== "string") {
      throw new Error("AI stream returned an invalid completion");
    }
    return { reply: data.reply, sessionId: data.sessionId };
  }

  return null;
}

export async function streamAiChat(
  request: AiChatRequest,
  handlers: AiChatStreamHandlers = {},
  signal?: AbortSignal,
): Promise<AiChatReply> {
  const token = getAccessToken();
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_CONFIG.baseUrl}/ai/chat/stream`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw await buildChatError(response, `AI stream failed with status ${response.status}`);
  }
  if (!response.body) throw new Error("AI stream has no readable body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completion: AiChatReply | null = null;

  while (!completion) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const event = parseEvent(block);
      if (event) completion = handleEvent(event, handlers);
      if (completion) break;
    }

    if (done) {
      const event = parseEvent(buffer);
      if (event) completion = handleEvent(event, handlers);
      if (!completion) throw new Error("AI stream ended before completion");
    }
  }

  return completion;
}

export async function sendAiChat(
  request: AiChatRequest,
  signal?: AbortSignal,
): Promise<AiChatReply> {
  const token = getAccessToken();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_CONFIG.baseUrl}/ai/chat`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw await buildChatError(response, `AI request failed with status ${response.status}`);
  }
  return response.json() as Promise<AiChatReply>;
}

export type AnthropicHealthStatus = "up" | "down" | "unconfigured";

export type AiHealthResponse = {
  status: AnthropicHealthStatus;
  timestamp: string;
};

export async function checkAiHealth(
  signal?: AbortSignal,
): Promise<AiHealthResponse> {
  const response = await fetch(`${API_CONFIG.baseUrl}/ai/health`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`AI health check failed with status ${response.status}`);
  }

  return response.json() as Promise<AiHealthResponse>;
}

/**
 * One usage window (today, or the current calendar month) as reported by
 * GET /ai/usage. Field names mirror the backend's UsageWindow
 * (AiUsageService) exactly, so no mapping is needed on this side.
 */
export type AiUsageWindow = {
  totalTokens: number;
  estimatedCostUsd: number;
  /** Token cap currently in effect for this window. */
  cap: number;
  remaining: number;
  /** USD spend cap currently in effect, or null when none is configured. */
  spendCapUsd: number | null;
  spendRemaining: number | null;
  /** 0-100. The higher of the token-cap and (if configured) spend-cap percentage. */
  percentUsed: number;
  /** True once usage crosses the warning threshold but before the cap is reached. */
  approachingCap: boolean;
  /** ISO timestamp this window's usage resets at. */
  resetsAt: string;
};

export type AiUsageSummary = {
  daily: AiUsageWindow;
  monthly: AiUsageWindow;
  /** Whether an admin-granted cap override is currently active for this user. */
  hasOverride: boolean;
};

export async function getAiUsage(signal?: AbortSignal): Promise<AiUsageSummary> {
  const token = getAccessToken();
  const headers = new Headers({ Accept: "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_CONFIG.baseUrl}/ai/usage`, {
    method: "GET",
    headers,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`AI usage request failed with status ${response.status}`);
  }

  return response.json() as Promise<AiUsageSummary>;
}

export async function fetchAiChatSessions(
  signal?: AbortSignal,
): Promise<AiChatSessionSummary[]> {
  const token = getAccessToken();
  const headers = new Headers({ Accept: "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_CONFIG.baseUrl}/ai/sessions`, {
    method: "GET",
    headers,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AI chat sessions with status ${response.status}`);
  }

  const data = await response.json();
  const rawSessions = Array.isArray(data)
    ? data
    : Array.isArray(data?.sessions)
    ? data.sessions
    : [];

  return rawSessions.map((s: Record<string, unknown>) => ({
    id: String(s.id),
    title: (s.title as string | undefined) || (s.preview ? String(s.preview).slice(0, 45) : undefined),
    preview: (s.preview as string | undefined) || (s.lastMessage as string | undefined) || (s.content as string | undefined),
    createdAt: (s.createdAt as string | undefined) || (s.created_at as string | undefined) || new Date().toISOString(),
    updatedAt: (s.updatedAt as string | undefined) || (s.updated_at as string | undefined) || (s.createdAt as string | undefined) || new Date().toISOString(),
    messageCount: typeof s.messageCount === "number" ? s.messageCount : (typeof s.messages_count === "number" ? s.messages_count : undefined),
  }));
}

export async function fetchAiChatSessionMessages(
  sessionId: string,
  signal?: AbortSignal,
): Promise<AiChatMessageDto[]> {
  const token = getAccessToken();
  const headers = new Headers({ Accept: "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_CONFIG.baseUrl}/ai/sessions/${sessionId}/messages`, {
    method: "GET",
    headers,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch AI chat session messages with status ${response.status}`);
  }

  const data = await response.json();
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
    ? data.messages
    : Array.isArray(data?.history)
    ? data.history
    : [];

  return rawList.map((m: Record<string, unknown>, index: number) => ({
    id: (m.id as string | undefined) || `${m.role || "turn"}-${index}-${Date.now()}`,
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: typeof m.content === "string" ? m.content : "",
    createdAt: (m.createdAt as string | undefined) || (m.created_at as string | undefined),
  }));
}

export async function deleteAiChatSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<void> {
  const token = getAccessToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_CONFIG.baseUrl}/ai/sessions/${sessionId}`, {
    method: "DELETE",
    headers,
    credentials: "include",
    signal,
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete AI chat session with status ${response.status}`);
  }
}
