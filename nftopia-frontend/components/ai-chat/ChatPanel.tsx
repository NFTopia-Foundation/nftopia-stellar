"use client";

import { FormEvent, useState } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAiChat } from "@/hooks/useAiChat";

export function ChatPanel() {
  const [draft, setDraft] = useState("");
  const { messages, isStreaming, error, sendMessage, cancel } = useAiChat();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft;
    setDraft("");
    await sendMessage(message);
  };

  return (
    <section aria-label="AI assistant" className="flex w-full max-w-xl flex-col gap-4 rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex min-h-48 flex-col gap-3 overflow-y-auto" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={message.role === "user" ? "self-end rounded-lg bg-primary px-3 py-2 text-primary-foreground" : "self-start rounded-lg bg-muted px-3 py-2"}>
            {message.content}
            {message.role === "assistant" && isStreaming && message.id === messages[messages.length - 1]?.id ? <span aria-label="Streaming" className="ml-1 inline-block animate-pulse">▌</span> : null}
          </div>
        ))}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <form onSubmit={submit} className="flex items-end gap-2">
        <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about the marketplace" disabled={isStreaming} aria-label="Message" />
        {isStreaming ? (
          <Button type="button" variant="outline" size="icon" onClick={cancel} aria-label="Stop response"><Square /></Button>
        ) : (
          <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message"><Send /></Button>
        )}
      </form>
    </section>
  );
}