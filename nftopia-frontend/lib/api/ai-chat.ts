import { API_CONFIG } from "@/lib/config";

export type AiChatRequest = {
  message: string;
  sessionId?: string;
};

export type AiChatReply = {
  reply: string;
  sessionId: string;
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

  if (!response.ok) throw new Error(`AI stream failed with status ${response.status}`);
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

  if (!response.ok) throw new Error(`AI request failed with status ${response.status}`);
  return response.json() as Promise<AiChatReply>;
}