import { act, renderHook } from "@testing-library/react";
import { checkAiHealth, sendAiChat, streamAiChat } from "@/lib/api/ai-chat";
import { useAiChat } from "@/hooks/useAiChat";
import { useAiChatStore } from "@/lib/stores/ai-chat-store";

jest.mock("@/lib/api/ai-chat", () => ({
  sendAiChat: jest.fn(),
  streamAiChat: jest.fn(),
  checkAiHealth: jest.fn(),
}));

const mockedStreamAiChat = jest.mocked(streamAiChat);
const mockedSendAiChat = jest.mocked(sendAiChat);
const mockedCheckAiHealth = jest.mocked(checkAiHealth);

describe("useAiChat", () => {
  beforeEach(() => jest.clearAllMocks());

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
});
