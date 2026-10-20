import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { checkAiHealth, sendAiChat, streamAiChat } from "@/lib/api/ai-chat";
import { useAiChatStore } from "@/lib/stores/ai-chat-store";
import { AiChatWidget } from "@/components/ai-chat/AiChatWidget";

jest.mock("@/lib/api/ai-chat", () => ({
  sendAiChat: jest.fn(),
  streamAiChat: jest.fn(),
  checkAiHealth: jest.fn(),
}));

const mockedStreamAiChat = jest.mocked(streamAiChat);
const mockedSendAiChat = jest.mocked(sendAiChat);
const mockedCheckAiHealth = jest.mocked(checkAiHealth);

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
    mockedCheckAiHealth.mockResolvedValue({
      status: "up",
      timestamp: "2026-10-19T00:00:00.000Z",
    });
    act(() => {
      // The store is module-scoped, so clear both the transcript and the open
      // state between cases.
      useAiChatStore.getState().reset();
      useAiChatStore.getState().close();
    });
  });

  it("is reachable from anywhere and opens the assistant panel", async () => {
    render(<AiChatWidget />);

    const launcher = screen.getByRole("button", { name: "Open AI assistant" });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(launcher);
    });

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
    await act(async () => {
      fireEvent.click(launcher);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Open AI assistant" }),
      ).toHaveFocus(),
    );
  });

  it("shows a clear unavailable state when opening during a known outage (status: down)", async () => {
    mockedCheckAiHealth.mockResolvedValue({
      status: "down",
      timestamp: "2026-10-19T00:00:00.000Z",
    });

    render(<AiChatWidget />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    });

    // Unavailable banner should be visible before attempting to send anything
    const degradedBanner = await screen.findByTestId("ai-chat-degraded");
    expect(degradedBanner).toBeInTheDocument();
    expect(degradedBanner).toHaveTextContent("Assistant temporarily unavailable");
    expect(degradedBanner).toHaveTextContent(
      "The AI service is currently unavailable. Please check back shortly.",
    );

    // Input must be disabled during the outage
    const input = screen.getByLabelText("Message the AI assistant");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute(
      "placeholder",
      "Assistant temporarily unavailable",
    );

    // Send button must be disabled
    const sendBtn = screen.getByRole("button", { name: "Send message" });
    expect(sendBtn).toBeDisabled();

    // Suggestion chips must also be disabled during outage
    const suggestionChips = screen.getAllByRole("button", {
      name: /trending|auctions|royalties/i,
    });
    for (const chip of suggestionChips) {
      expect(chip).toBeDisabled();
    }

    // Attempting to send should not invoke stream or send
    fireEvent.click(sendBtn);
    expect(mockedStreamAiChat).not.toHaveBeenCalled();
    expect(mockedSendAiChat).not.toHaveBeenCalled();
  });

  it("shows unavailable state when backend reports unconfigured", async () => {
    mockedCheckAiHealth.mockResolvedValue({
      status: "unconfigured",
      timestamp: "2026-10-19T00:00:00.000Z",
    });

    render(<AiChatWidget />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    });

    const degradedBanner = await screen.findByTestId("ai-chat-degraded");
    expect(degradedBanner).toBeInTheDocument();
    expect(screen.getByLabelText("Message the AI assistant")).toBeDisabled();
  });

  it("shows unavailable state when health check fails with a network error", async () => {
    mockedCheckAiHealth.mockRejectedValue(new Error("Failed to fetch"));

    render(<AiChatWidget />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    });

    const degradedBanner = await screen.findByTestId("ai-chat-degraded");
    expect(degradedBanner).toBeInTheDocument();
    expect(screen.getByLabelText("Message the AI assistant")).toBeDisabled();
  });

  it("re-enables the input and clears unavailable state when manual recheck action succeeds", async () => {
    mockedCheckAiHealth.mockResolvedValueOnce({
      status: "down",
      timestamp: "2026-10-19T00:00:00.000Z",
    });

    render(<AiChatWidget />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    });

    const degradedBanner = await screen.findByTestId("ai-chat-degraded");
    expect(degradedBanner).toBeInTheDocument();

    const input = screen.getByLabelText("Message the AI assistant");
    expect(input).toBeDisabled();

    // Now Anthropic recovers
    mockedCheckAiHealth.mockResolvedValueOnce({
      status: "up",
      timestamp: "2026-10-19T00:01:00.000Z",
    });

    const recheckBtn = screen.getByRole("button", { name: "Retry health check" });
    await act(async () => {
      fireEvent.click(recheckBtn);
    });

    // Unavailable banner should disappear and input should become enabled
    await waitFor(() => {
      expect(screen.queryByTestId("ai-chat-degraded")).not.toBeInTheDocument();
    });
    expect(input).not.toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Ask about the marketplace");

    // Suggestion chips should also be enabled now
    const chips = screen.getAllByRole("button", {
      name: /trending|auctions|royalties/i,
    });
    for (const chip of chips) {
      expect(chip).not.toBeDisabled();
    }
  });

  it("unavailable state is visually distinct from normal post-failure error banner", async () => {
    mockedCheckAiHealth.mockResolvedValueOnce({
      status: "down",
      timestamp: "2026-10-19T00:00:00.000Z",
    });

    render(<AiChatWidget />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    });

    const degradedBanner = await screen.findByTestId("ai-chat-degraded");
    // Amber degraded styling
    expect(degradedBanner.className).toContain("border-amber-500");
    expect(degradedBanner.className).toContain("bg-amber-500");
    expect(degradedBanner.className).toContain("text-amber-200");
    expect(degradedBanner).toHaveTextContent("Assistant temporarily unavailable");
    expect(
      screen.getByRole("button", { name: "Retry health check" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("automatically re-enables input when periodic health polling detects recovery", async () => {
    jest.useFakeTimers();

    mockedCheckAiHealth.mockResolvedValueOnce({
      status: "down",
      timestamp: "2026-10-19T00:00:00.000Z",
    });

    render(<AiChatWidget />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    });

    expect(screen.getByTestId("ai-chat-degraded")).toBeInTheDocument();
    const input = screen.getByLabelText("Message the AI assistant");
    expect(input).toBeDisabled();

    // Anthropic recovers on next periodic poll
    mockedCheckAiHealth.mockResolvedValueOnce({
      status: "up",
      timestamp: "2026-10-19T00:00:30.000Z",
    });

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    expect(screen.queryByTestId("ai-chat-degraded")).not.toBeInTheDocument();
    expect(input).not.toBeDisabled();

    jest.useRealTimers();
  });
});


