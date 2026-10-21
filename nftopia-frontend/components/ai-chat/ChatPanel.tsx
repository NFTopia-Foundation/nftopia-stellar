"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
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

function formatSessionTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export type ChatPanelProps = {
  /** Matches the launcher's `aria-controls`. */
  id?: string;
  /** Called when the user dismisses the panel (Escape or the close button). */
  onClose?: () => void;
};

export function ChatPanel({ id = AI_CHAT_PANEL_ID, onClose }: ChatPanelProps) {
  const {
    messages,
    isStreaming,
    error,
    isDegraded,
    isCheckingHealth,
    usage,
    quotaExceeded,
    sessionId,
    sessions,
    isLoadingSessions,
    isLoadingHistory,
    isHistoryOpen,
    sendMessage,
    retry,
    cancel,
    checkHealth,
    fetchUsage,
    loadSessions,
    selectSession,
    newConversation,
    toggleHistory,
    setHistoryOpen,
    deleteSession,
  } = useAiChat();

  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const titleId = `${id}-title`;
  const inputId = `${id}-input`;
  const lastMessageId = messages[messages.length - 1]?.id;
  const currentSession = sessions.find((s) => s.id === sessionId);

  // Proactively check assistant health and quota usage when opened, and
  // periodically while open (usage changes with every turn, including ones
  // sent from other tabs).
  useEffect(() => {
    void checkHealth();
    void fetchUsage();

    const intervalId = window.setInterval(() => {
      void checkHealth();
      void fetchUsage();
    }, 30_000);

    if (
      typeof intervalId === "object" &&
      intervalId !== null &&
      "unref" in intervalId &&
      typeof (intervalId as { unref?: () => void }).unref === "function"
    ) {
      (intervalId as { unref: () => void }).unref();
    }

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkHealth, fetchUsage]);

  // Focus management: move focus into the panel as soon as it opens (when available).
  useEffect(() => {
    if (!isDegraded && !isHistoryOpen) {
      inputRef.current?.focus();
    }
  }, [isDegraded, isHistoryOpen]);

  // Keep recent sessions fresh on panel mount.
  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || isStreaming || isDegraded) return;
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
      className="flex max-h-[75vh] w-full flex-col gap-3 rounded-xl border border-white/10 bg-[#181359] p-4 text-white shadow-2xl"
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          {isHistoryOpen ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Back to chat"
              onClick={() => setHistoryOpen(false)}
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
            </Button>
          ) : null}
          <h2
            id={titleId}
            className="flex items-center gap-2 text-sm font-semibold"
          >
            {isHistoryOpen ? (
              <>
                <History aria-hidden className="h-4 w-4 text-[#9747ff]" />
                Conversations
              </>
            ) : (
              <>
                <Sparkles aria-hidden className="h-4 w-4 text-[#9747ff]" />
                NFTopia assistant
              </>
            )}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="New conversation"
            title="New conversation"
            onClick={newConversation}
            data-testid="ai-chat-new-btn"
          >
            <Plus aria-hidden className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white",
              isHistoryOpen && "bg-white/15 text-white",
            )}
            aria-label="Conversation history"
            title="Conversation history"
            onClick={toggleHistory}
            data-testid="ai-chat-history-btn"
          >
            <History aria-hidden className="h-4 w-4" />
          </Button>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Close AI assistant"
              onClick={onClose}
            >
              <X aria-hidden className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </header>

      {isHistoryOpen ? (
        <div
          role="region"
          aria-label="Conversation history"
          data-testid="ai-chat-history-panel"
          className="flex min-h-[280px] max-h-[420px] flex-1 flex-col gap-2 overflow-y-auto pr-1"
        >
          <div className="flex items-center justify-between px-1 text-xs text-white/60">
            <span>Recent conversations ({sessions.length})</span>
            {sessions.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-[#a580ff] hover:text-white hover:bg-white/10"
                onClick={newConversation}
              >
                + New chat
              </Button>
            ) : null}
          </div>

          {isLoadingSessions ? (
            <div
              role="status"
              className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-xs text-white/60"
            >
              <Loader2 className="h-5 w-5 animate-spin text-[#9747ff]" />
              <span>Loading conversations…</span>
            </div>
          ) : sessions.length === 0 ? (
            <div
              data-testid="ai-chat-history-empty"
              className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-white/70"
            >
              <MessageSquare className="h-8 w-8 text-white/30" />
              <div>
                <p className="font-medium text-white/90">No past conversations</p>
                <p className="mt-1 text-xs text-white/60">
                  Ask about listings, auctions, collections or royalties to start a chat.
                </p>
              </div>
              <Button
                type="button"
                variant="cosmic"
                size="sm"
                onClick={newConversation}
                className="mt-2 text-xs"
              >
                Start a conversation
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2" data-testid="ai-chat-sessions-list">
              {sessions.map((session) => {
                const isActive = session.id === sessionId;
                return (
                  <div
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void selectSession(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void selectSession(session.id);
                      }
                    }}
                    className={cn(
                      "group relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-all cursor-pointer",
                      isActive
                        ? "border-[#9747ff] bg-[#9747ff]/20 text-white shadow-sm"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 text-white/90",
                    )}
                    data-testid={`ai-chat-session-item-${session.id}`}
                    aria-label={`Resume conversation: ${session.title || session.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 text-xs font-medium text-white">
                        {session.title || "Conversation"}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActive ? (
                          <span className="rounded bg-[#9747ff]/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            Active
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-white/40 hover:text-red-400 hover:bg-white/10 opacity-70 group-hover:opacity-100 transition-opacity"
                          aria-label={`Delete conversation ${session.title || session.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteSession(session.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {session.preview ? (
                      <p className="line-clamp-2 text-[11px] text-white/70">
                        {session.preview}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-1 text-[10px] text-white/40 mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{formatSessionTime(session.updatedAt || session.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {isLoadingHistory ? (
            <div
              role="status"
              className="flex min-h-48 flex-1 flex-col items-center justify-center gap-2 text-xs text-white/60"
            >
              <Loader2 className="h-5 w-5 animate-spin text-[#9747ff]" />
              <span>Resuming conversation…</span>
            </div>
          ) : (
            <>
              {currentSession ? (
                <div className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-white/70 border border-white/5">
                  <span className="truncate max-w-[210px] font-medium text-white/90">
                    {currentSession.title || "Resumed conversation"}
                  </span>
                  <button
                    type="button"
                    onClick={newConversation}
                    className="text-[#a580ff] hover:underline hover:text-white transition-colors"
                  >
                    New chat
                  </button>
                </div>
              ) : null}

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
                          disabled={isDegraded}
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
            </>
          )}

          {isDegraded ? (
            <div
              role="alert"
              data-testid="ai-chat-degraded"
              className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200"
            >
              <div className="flex items-center gap-2 font-medium text-amber-300">
                <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Assistant temporarily unavailable</span>
              </div>
              <p className="text-white/80">
                The AI service is currently unavailable. Please check back shortly.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="ai-health-retry"
                aria-label="Retry health check"
                className="h-auto self-start text-xs border-amber-500/30 text-amber-200 hover:bg-amber-500/20"
                onClick={() => void checkHealth()}
                disabled={isCheckingHealth}
              >
                {isCheckingHealth ? (
                  <>
                    <Loader2 aria-hidden className="mr-1 h-3 w-3 animate-spin" />
                    Checking…
                  </>
                ) : (
                  "Check again"
                )}
              </Button>
            </div>
          ) : quotaExceeded ? (
            <div
              role="alert"
              data-testid="ai-chat-quota-exceeded"
              className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200"
            >
              <div className="flex items-center gap-2 font-medium text-amber-300">
                <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-amber-400" />
                <span>AI usage quota reached</span>
              </div>
              {/* No retry action here on purpose: assertWithinCap enforces the same
                  cap on every endpoint, so retrying before resetsAt would just fail
                  again — the fix is waiting, not trying again. */}
              <p className="text-white/80">{error}</p>
            </div>
          ) : error ? (
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

          {usage ? (
            <div
              data-testid="ai-usage-indicator"
              className={cn(
                "flex flex-col gap-1 rounded-lg border px-3 py-2 text-xs",
                usage.daily.approachingCap || usage.monthly.approachingCap
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-white/10 bg-white/5 text-white/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span>Daily quota</span>
                <span>
                  {usage.daily.remaining.toLocaleString()} / {usage.daily.cap.toLocaleString()} tokens left
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Monthly quota</span>
                <span>
                  {usage.monthly.remaining.toLocaleString()} / {usage.monthly.cap.toLocaleString()} tokens left
                </span>
              </div>
              {usage.daily.approachingCap || usage.monthly.approachingCap ? (
                <div
                  data-testid="ai-usage-near-limit"
                  className="flex items-center gap-1 pt-0.5 font-medium text-amber-300"
                >
                  <AlertCircle aria-hidden className="h-3 w-3 shrink-0" />
                  <span>
                    Approaching your{" "}
                    {usage.daily.approachingCap ? "daily" : "monthly"} limit
                  </span>
                </div>
              ) : null}
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
              placeholder={
                isDegraded
                  ? "Assistant temporarily unavailable"
                  : "Ask about the marketplace"
              }
              disabled={isStreaming || isDegraded}
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
                disabled={!draft.trim() || isDegraded}
                aria-label="Send message"
              >
                <Send aria-hidden />
              </Button>
            )}
          </form>
        </>
      )}
    </section>
  );
}