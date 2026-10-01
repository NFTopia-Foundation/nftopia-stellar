import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { sendAiChat, streamAiChat } from "@/lib/api/ai-chat";
import { useAiChatStore } from "@/lib/stores/ai-chat-store";
import { AiChatWidget } from "@/components/ai-chat/AiChatWidget";

jest.mock("@/lib/api/ai-chat", () => ({
  sendAiChat: jest.fn(),
  streamAiChat: jest.fn(),
}));

const mockedStreamAiChat = jest.mocked(streamAiChat);
const mockedSendAiChat = jest.mocked(sendAiChat);

/** Minimal SSE-style stream mock: pushes `onText` then resolves. */
function mockStreamingReply(reply: string, sessionId: string, text = reply) {
  mockedStreamAiChat.mockImplementation(async (_request, handlers = {}) => {
    handlers?.onText?.(text);
    return { reply, sessionId };
  });
}

describe("AiChatWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      // The store is module-scoped, so clear both the transcript and the open
      // state between cases.
      useAiChatStore.getState().reset();
      useAiChatStore.getState().close();
    });
  });

  it("is reachable from anywhere and opens the assistant panel", () => {
    render(<AiChatWidget />);

    const launcher = screen.getByRole("button", { name: "Open AI assistant" });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(launcher);

    const dialog = screen.getByRole("dialog", { name: "NFTopia assistant" });
    expect(dialog).toHaveAttribute("aria-modal", "false");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(
      screen.getByRole("log", { name: "Conversation" }),
    ).toBeInTheDocument();
    // Empty state before the first message.
    expect(screen.getByTestId("ai-chat-empty")).toBeInTheDocument();
    // Launcher now reports the panel as open.
    expect(
      screen.getByRole("button", { name: "Close AI assistant", expanded: true }),
    ).toBeInTheDocument();
  });

  it("shows a loading state, then renders the streamed reply", async () => {
    let resolveStream!: (value: { reply: string; sessionId: string }) => void;
    mockedStreamAiChat.mockImplementation(async (_request, handlers = {}) => {
      handlers?.onText?.("Looking");
      await new Promise<{ reply: string; sessionId: string }>((resolve) => {
        resolveStream = resolve;
      });
      return { reply: "Looking for listings", sessionId: "session-1" };
    });

    render(<AiChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

    const input = screen.getByLabelText("Message the AI assistant");
    fireEvent.change(input, { target: { value: "Find me a cheap NFT" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    // Sent message + loading state are both visible while the reply streams.
    expect(await screen.findByText("Find me a cheap NFT")).toBeInTheDocument();
    const log = screen.getByRole("log", { name: "Conversation" });
    expect(log).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Assistant is typing");
    expect(
      screen.getByRole("button", { name: "Stop response" }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveStream({ reply: "Looking for listings", sessionId: "session-1" });
    });

    expect(await screen.findByText("Looking for listings")).toBeInTheDocument();
    await waitFor(() =>
      expect(log).toHaveAttribute("aria-busy", "false"),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reuses the server sessionId for later turns in the same session", async () => {
    mockStreamingReply("First answer", "session-42");

    render(<AiChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    const input = screen.getByLabelText("Message the AI assistant");

    fireEvent.change(input, { target: { value: "First question" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("First answer");

    mockStreamingReply("Second answer", "session-42");
    fireEvent.change(input, { target: { value: "Second question" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("Second answer");

    expect(mockedStreamAiChat).toHaveBeenCalledTimes(2);
    expect(mockedStreamAiChat.mock.calls[0][0]).toEqual({
      message: "First question",
      sessionId: undefined,
    });
    expect(mockedStreamAiChat.mock.calls[1][0]).toEqual({
      message: "Second question",
      sessionId: "session-42",
    });
  });

  it("renders a distinct error state and lets the user retry", async () => {
    mockedStreamAiChat.mockRejectedValue(new Error("AI stream failed"));
    mockedSendAiChat.mockRejectedValue(new Error("assistant offline"));

    render(<AiChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    fireEvent.change(screen.getByLabelText("Message the AI assistant"), {
      target: { value: "Hello?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("assistant offline");

    mockStreamingReply("Back online", "session-7");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Back online")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the launcher", async () => {
    render(<AiChatWidget />);
    const launcher = screen.getByRole("button", { name: "Open AI assistant" });
    fireEvent.click(launcher);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Open AI assistant" }),
      ).toHaveFocus(),
    );
  });
});
