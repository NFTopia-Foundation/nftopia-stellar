import { act, renderHook } from "@testing-library/react";
import { sendAiChat, streamAiChat } from "@/lib/api/ai-chat";
import { useAiChat } from "@/hooks/useAiChat";

jest.mock("@/lib/api/ai-chat", () => ({
  sendAiChat: jest.fn(),
  streamAiChat: jest.fn(),
}));

const mockedStreamAiChat = jest.mocked(streamAiChat);
const mockedSendAiChat = jest.mocked(sendAiChat);

describe("useAiChat", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders stream chunks incrementally and aborts on unmount", async () => {
    let resolveStream!: (value: { reply: string; sessionId: string }) => void;
    let signal: AbortSignal | undefined;
    mockedStreamAiChat.mockImplementation(async (_request, handlers = {}, requestSignal) => {
      signal = requestSignal;
      handlers.onText?.("Hello");
      await new Promise<{ reply: string; sessionId: string }>((resolve) => {
        resolveStream = resolve;
      });
      handlers.onText?.(" world");
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
});