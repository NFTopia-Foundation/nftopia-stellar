import { act, renderHook } from "@testing-library/react";
import {
  checkAiHealth,
  deleteAiChatSession,
  fetchAiChatSessionMessages,
  fetchAiChatSessions,
  sendAiChat,
  streamAiChat,
} from "@/lib/api/ai-chat";
import { useAiChat } from "@/hooks/useAiChat";
import { useAiChatStore } from "@/lib/stores/ai-chat-store";

jest.mock("@/lib/api/ai-chat", () => ({
  sendAiChat: jest.fn(),
  streamAiChat: jest.fn(),
  checkAiHealth: jest.fn(),
  fetchAiChatSessions: jest.fn(),
  fetchAiChatSessionMessages: jest.fn(),
  deleteAiChatSession: jest.fn(),
}));

const mockedStreamAiChat = jest.mocked(streamAiChat);
const mockedSendAiChat = jest.mocked(sendAiChat);
const mockedCheckAiHealth = jest.mocked(checkAiHealth);
const mockedFetchSessions = jest.mocked(fetchAiChatSessions);
const mockedFetchSessionMessages = jest.mocked(fetchAiChatSessionMessages);
const mockedDeleteSession = jest.mocked(deleteAiChatSession);

describe("useAiChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    act(() => {
      useAiChatStore.getState().reset();
      useAiChatStore.getState().clearSessions();
    });
  });

  it("renders stream chunks incrementally and aborts on unmount", async () => {
    let resolveStream!: (value: { reply: string; sessionId: string }) => void;
    let signal: AbortSignal | undefined;
    mockedStreamAiChat.mockImplementation(async (_request, handlers = {}, requestSignal) => {
      signal = requestSignal;
      handlers?.onText?.("Hello");
      await new Promise<{ reply: string; sessionId: string }>((resolve) => {
        resolveStream = resolve;
      });
      handlers?.onText?.(" world");
      return { reply: "Hello world", sessionId: "session-1" };
    });

    const { result, unmount } = renderHook(() => useAiChat());
    await act(async () => {
      void result.current.sendMessage("Hi");
      await Promise.resolve();
    });
    expect(result.current.messages.at(-1)?.content).toBe("Hello");
    expect(result.current.isStreaming).toBe(true);

    unmount();
    expect(signal?.aborted).toBe(true);
    expect(mockedSendAiChat).not.toHaveBeenCalled();
    resolveStream({ reply: "Hello world", sessionId: "session-1" });
  });

  it("exposes degraded state and checkHealth function", async () => {
    act(() => {
      useAiChatStore.getState().reset();
    });

    mockedCheckAiHealth.mockResolvedValueOnce({
      status: "down",
      timestamp: "2026-10-19T00:00:00.000Z",
    });

    const { result } = renderHook(() => useAiChat());
    expect(result.current.isDegraded).toBe(false);
    expect(result.current.healthStatus).toBeNull();

    await act(async () => {
      const isHealthy = await result.current.checkHealth();
      expect(isHealthy).toBe(false);
    });

    expect(result.current.isDegraded).toBe(true);
    expect(result.current.healthStatus).toBe("down");

    // Recovers when checkHealth reports up
    mockedCheckAiHealth.mockResolvedValueOnce({
      status: "up",
      timestamp: "2026-10-19T00:01:00.000Z",
    });

    await act(async () => {
      const isHealthy = await result.current.checkHealth();
      expect(isHealthy).toBe(true);
    });

    expect(result.current.isDegraded).toBe(false);
    expect(result.current.healthStatus).toBe("up");
  });

  it("fetches and holds sessions list via loadSessions", async () => {
    mockedFetchSessions.mockResolvedValueOnce([
      {
        id: "sess-1",
        title: "Trending NFTs query",
        preview: "CyberPunks are trending",
        createdAt: "2026-10-18T12:00:00Z",
        updatedAt: "2026-10-18T12:10:00Z",
      },
    ]);

    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].id).toBe("sess-1");
    expect(result.current.sessions[0].title).toBe("Trending NFTs query");
  });

  it("selects a past session and loads its message history", async () => {
    mockedFetchSessionMessages.mockResolvedValueOnce([
      { id: "m-1", role: "user", content: "Tell me about gas fees" },
      { id: "m-2", role: "assistant", content: "Stellar network fees are near-zero" },
    ]);

    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.selectSession("sess-fees");
    });

    expect(result.current.sessionId).toBe("sess-fees");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe("Tell me about gas fees");
    expect(result.current.messages[1].content).toBe("Stellar network fees are near-zero");
    expect(result.current.isHistoryOpen).toBe(false);
  });

  it("newConversation starts fresh without losing sessions", async () => {
    mockedFetchSessions.mockResolvedValueOnce([
      {
        id: "sess-saved",
        title: "Past conversation",
        createdAt: "2026-10-18T12:00:00Z",
        updatedAt: "2026-10-18T12:10:00Z",
      },
    ]);

    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.loadSessions();
      await result.current.selectSession("sess-saved");
    });

    expect(result.current.sessionId).toBe("sess-saved");

    act(() => {
      result.current.newConversation();
    });

    // Session ID and messages are cleared
    expect(result.current.sessionId).toBeNull();
    expect(result.current.messages).toEqual([]);
    // But sessions list is preserved
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].id).toBe("sess-saved");
  });

  it("deletes a session and updates the list", async () => {
    mockedFetchSessions.mockResolvedValueOnce([
      {
        id: "sess-to-remove",
        title: "Delete me",
        createdAt: "2026-10-18T12:00:00Z",
        updatedAt: "2026-10-18T12:10:00Z",
      },
    ]);
    mockedDeleteSession.mockResolvedValueOnce();

    const { result } = renderHook(() => useAiChat());

    await act(async () => {
      await result.current.loadSessions();
    });
    expect(result.current.sessions).toHaveLength(1);

    await act(async () => {
      await result.current.deleteSession("sess-to-remove");
    });

    expect(mockedDeleteSession).toHaveBeenCalledWith("sess-to-remove");
    expect(result.current.sessions).toHaveLength(0);
  });

  it("toggles and sets isHistoryOpen state", () => {
    const { result } = renderHook(() => useAiChat());

    expect(result.current.isHistoryOpen).toBe(false);

    act(() => {
      result.current.toggleHistory();
    });
    expect(result.current.isHistoryOpen).toBe(true);

    act(() => {
      result.current.setHistoryOpen(false);
    });
    expect(result.current.isHistoryOpen).toBe(false);
  });
});
