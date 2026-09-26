"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader2, Send, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/hooks/useAiChat";

export const AI_CHAT_PANEL_ID = "ai-chat-panel";

const SUGGESTIONS = [
  "What is trending in the marketplace?",
  "Show me auctions ending soon",
  "How do creator royalties work?",
];

export type ChatPanelProps = {
  /** Matches the launcher's `aria-controls`. */
  id?: string;
  /** Called when the user dismisses the panel (Escape or the close button). */
  onClose?: () => void;
};

export function ChatPanel({ id = AI_CHAT_PANEL_ID, onClose }: ChatPanelProps) {
  const { messages, isStreaming, error, sendMessage, retry, cancel } =
    useAiChat();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const titleId = `${id}-title`;
  const inputId = `${id}-input`;
  const lastMessageId = messages[messages.length - 1]?.id;

  // Focus management: move focus into the panel as soon as it opens.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || isStreaming) return;
    setDraft("");
    await sendMessage(message);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && onClose) {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <section
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={handlePanelKeyDown}
      className="flex max-h-[70vh] w-full flex-col gap-3 rounded-xl border border-white/10 bg-[#181359] p-4 text-white shadow-2xl"
    >
      <header className="flex items-center justify-between gap-2">
        <h2
          id={titleId}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <Sparkles aria-hidden className="h-4 w-4 text-[#9747ff]" />
          NFTopia assistant
        </h2>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close AI assistant"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </header>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={isStreaming}
        aria-label="Conversation"
        className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto pr-1"
      >
        {messages.length === 0 ? (
          <div
            data-testid="ai-chat-empty"
            className="flex flex-col gap-3 rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/70"
          >
            <p>Ask about listings, auctions, collections or royalties.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto text-xs"
                  onClick={() => void sendMessage(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              aria-label={
                message.role === "user" ? "Your message" : "Assistant message"
              }
              className={cn(
                "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                message.role === "user"
                  ? "self-end bg-[#4e3bff] text-white"
                  : "self-start bg-white/10 text-white",
              )}
            >
              {message.content}
              {message.role === "assistant" &&
              isStreaming &&
              message.id === lastMessageId ? (
                <span aria-hidden className="ml-1 inline-block animate-pulse">
                  ▌
                </span>
              ) : null}
            </article>
          ))
        )}

        {isStreaming ? (
          <div
            role="status"
            className="flex items-center gap-2 self-start text-xs text-white/70"
          >
            <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
            Assistant is typing…
          </div>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200"
        >
          <span>{error}</span>
          <Button
            type="button"
            variant="danger-ghost"
            size="sm"
            className="h-auto self-start text-xs"
            onClick={() => void retry()}
          >
            Try again
          </Button>
        </div>
      ) : null}
      <form onSubmit={submit} className="flex items-end gap-2">
        <label className="sr-only" htmlFor={inputId}>
          Message the AI assistant
        </label>
        <Textarea
          id={inputId}
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask about the marketplace"
          disabled={isStreaming}
          rows={2}
          className="flex-1 resize-none"
        />
        {isStreaming ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={cancel}
            aria-label="Stop response"
          >
            <Square aria-hidden />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim()}
            aria-label="Send message"
          >
            <Send aria-hidden />
          </Button>
        )}
      </form>
    </section>
  );
}