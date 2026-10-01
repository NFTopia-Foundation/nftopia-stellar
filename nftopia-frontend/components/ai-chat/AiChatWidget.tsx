"use client";

import { useCallback, useEffect, useRef } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiChatStore } from "@/lib/stores/ai-chat-store";
import { AI_CHAT_PANEL_ID, ChatPanel } from "./ChatPanel";

/**
 * Floating entry point for the marketplace assistant.
 *
 * Mounted once in the locale layout so the assistant can be opened from any
 * page. Deliberately a non-modal launcher + panel: the rest of the app stays
 * usable while chatting, and Escape / the close button dismiss it.
 */
export function AiChatWidget() {
  const isOpen = useAiChatStore((state) => state.isOpen);
  const toggle = useAiChatStore((state) => state.toggle);
  const close = useAiChatStore((state) => state.close);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    close();
    // Return focus to the launcher so keyboard users are not dropped back at the
    // top of the document.
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  }, [close]);

  // Escape closes the panel even when focus has moved outside of it.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  return (
    <>
      <Button
        ref={launcherRef}
        type="button"
        variant="cosmic"
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl"
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={isOpen}
        aria-controls={AI_CHAT_PANEL_ID}
        onClick={toggle}
      >
        {isOpen ? <X aria-hidden /> : <MessageCircle aria-hidden />}
      </Button>

      {isOpen ? (
        <div className="fixed bottom-24 right-6 z-50 w-[min(24rem,calc(100vw-3rem))]">
          <ChatPanel id={AI_CHAT_PANEL_ID} onClose={handleClose} />
        </div>
      ) : null}
    </>
  );
}
