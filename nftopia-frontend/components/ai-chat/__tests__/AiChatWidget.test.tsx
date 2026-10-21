import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AiQuotaExceededError,
  checkAiHealth,
  deleteAiChatSession,
  fetchAiChatSessionMessages,
  fetchAiChatSessions,
  getAiUsage,
  sendAiChat,
  streamAiChat,
  type AiUsageSummary,
} from "@/lib/api/ai-chat";
import { useAiChatStore } from "@/lib/stores/ai-chat-store";
import { AiChatWidget } from "@/components/ai-chat/AiChatWidget";

jest.mock("@/lib/api/ai-chat", () => {
  const actual = jest.requireActual("@/lib/api/ai-chat");
  return {
    sendAiChat: jest.fn(),
    streamAiChat: jest.fn(),
    checkAiHealth: jest.fn(),
    getAiUsage: jest.fn(),
    fetchAiChatSessions: jest.fn(),
    fetchAiChatSessionMessages: jest.fn(),
    deleteAiChatSession: jest.fn(),
    AiQuotaExceededError: actual.AiQuotaExceededError,
  };
});

const mockedStreamAiChat = jest.mocked(streamAiChat);
const mockedSendAiChat = jest.mocked(sendAiChat);
const mockedCheckAiHealth = jest.mocked(checkAiHealth);
const mockedGetAiUsage = jest.mocked(getAiUsage);
const mockedFetchSessions = jest.mocked(fetchAiChatSessions);
const mockedFetchSessionMessages = jest.mocked(fetchAiChatSessionMessages);
const mockedDeleteSession = jest.mocked(deleteAiChatSession);

function buildUsage(overrides: Partial<AiUsageSummary["daily"]> = {}): AiUsageSummary {
  const dailyBase = {
    totalTokens: 1000,
    estimatedCostUsd: 0.05,
    cap: 200000,
    remaining: 199000,
    spendCapUsd: null,
    spendRemaining: null,
    percentUsed: 1,
    approachingCap: false,
    resetsAt: "2026-10-21T00:00:00.000Z",
    ...overrides,
  };
  return {
    daily: dailyBase,
    monthly: {
      totalTokens: 50000,
      estimatedCostUsd: 2.5,
      cap: 2000000,
      remaining: 1950000,
      spendCapUsd: null,
      spendRemaining: null,
      percentUsed: 3,
      approachingCap: false,
      resetsAt: "2026-11-01T00:00:00.000Z",
    },
    hasOverride: false,
  };
}

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
    mockedGetAiUsage.mockResolvedValue(buildUsage());
    localStorage.clear();
    mockedFetchSessions.mockResolvedValue([]);
    mockedFetchSessionMessages.mockResolvedValue([]);
    mockedDeleteSession.mockResolvedValue();

    act(() => {
      // The store is module-scoped, so clear both the transcript, open state,
      // and sessions between cases.
      useAiChatStore.getState().reset();
      useAiChatStore.getState().clearSessions();
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

  it("shows remaining daily/monthly AI usage quota when opened", async () => {
    mockedGetAiUsage.mockResolvedValue(
      buildUsage({ remaining: 150000, cap: 200000 }),
    );

    render(<AiChatWidget />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    });

    const indicator = await screen.findByTestId("ai-usage-indicator");
    expect(indicator).toHaveTextContent("150,000 / 200,000 tokens left");
    expect(indicator).toHaveTextContent("1,950,000 / 2,000,000 tokens left");
    expect(screen.queryByTestId("ai-usage-near-limit")).not.toBeInTheDocument();
  });

  it("visually distinguishes a near-limit quota state", async () => {
    mockedGetAiUsage.mockResolvedValue(
      buildUsage({ remaining: 15000, cap: 200000, approachingCap: true }),
    );

    render(<AiChatWidget />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    });

    const indicator = await screen.findByTestId("ai-usage-indicator");
    expect(indicator.className).toContain("border-amber-500");
    const nearLimit = screen.getByTestId("ai-usage-near-limit");
    expect(nearLimit).toHaveTextContent("Approaching your daily limit");
  });

  it("shows a quota-exhausted message distinct from a generic failure, with no retry action", async () => {
    mockedStreamAiChat.mockRejectedValue(
      new AiQuotaExceededError(
        "Daily AI usage cap reached (200000 tokens). Please try again tomorrow.",
        "AI_DAILY_TOKEN_CAP_REACHED",
        "2026-10-21T00:00:00.000Z",
      ),
    );
    mockedSendAiChat.mockRejectedValue(
      new AiQuotaExceededError(
        "Daily AI usage cap reached (200000 tokens). Please try again tomorrow.",
        "AI_DAILY_TOKEN_CAP_REACHED",
        "2026-10-21T00:00:00.000Z",
      ),
    );

    render(<AiChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    fireEvent.change(screen.getByLabelText("Message the AI assistant"), {
      target: { value: "Hello?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    const quotaBanner = await screen.findByTestId("ai-chat-quota-exceeded");
    expect(quotaBanner).toHaveTextContent("AI usage quota reached");
    expect(quotaBanner).toHaveTextContent(
      "Daily AI usage cap reached (200000 tokens). Please try again tomorrow.",
    );
    // Distinct from the generic retryable-error banner: no "Try again" button,
    // and not styled/testable as the generic alert.
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-chat-degraded")).not.toBeInTheDocument();

    // The non-streaming fallback should not even be attempted - the cap
    // rejection comes back before any content streams, and both endpoints
    // enforce the same cap, so there's nothing a fallback request would gain.
    expect(mockedSendAiChat).not.toHaveBeenCalled();
  });

  describe("Conversation history UI", () => {
    it("toggles history panel and shows empty state when no sessions exist", async () => {
      render(<AiChatWidget />);
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

      const historyBtn = screen.getByTestId("ai-chat-history-btn");
      expect(historyBtn).toBeInTheDocument();

      fireEvent.click(historyBtn);

      // Now showing conversation history
      expect(screen.getByRole("region", { name: "Conversation history" })).toBeInTheDocument();
      expect(await screen.findByTestId("ai-chat-history-empty")).toBeInTheDocument();
      expect(screen.getByText("No past conversations")).toBeInTheDocument();

      // Clicking back to chat button returns to chat panel
      const backBtn = screen.getByRole("button", { name: "Back to chat" });
      fireEvent.click(backBtn);
      expect(screen.getByRole("log", { name: "Conversation" })).toBeInTheDocument();
    });

    it("displays list of recent sessions fetched from backend", async () => {
      mockedFetchSessions.mockResolvedValue([
        {
          id: "session-101",
          title: "How do auctions work?",
          preview: "Auctions allow bidding using XLM...",
          createdAt: "2026-10-18T10:00:00.000Z",
          updatedAt: "2026-10-18T10:05:00.000Z",
        },
        {
          id: "session-102",
          title: "Collection verification process",
          preview: "Creators can request verification...",
          createdAt: "2026-10-18T09:00:00.000Z",
          updatedAt: "2026-10-18T09:30:00.000Z",
        },
      ]);

      render(<AiChatWidget />);
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

      // Open history view
      fireEvent.click(screen.getByTestId("ai-chat-history-btn"));

      expect(await screen.findByText("How do auctions work?")).toBeInTheDocument();
      expect(screen.getByText("Collection verification process")).toBeInTheDocument();
      expect(screen.getByText("Auctions allow bidding using XLM...")).toBeInTheDocument();
    });

    it("resumes a past session and loads its message history when clicked", async () => {
      mockedFetchSessions.mockResolvedValue([
        {
          id: "session-history-1",
          title: "Royalty questions",
          preview: "Royalties are 5%",
          createdAt: "2026-10-18T10:00:00.000Z",
          updatedAt: "2026-10-18T10:05:00.000Z",
        },
      ]);
      mockedFetchSessionMessages.mockResolvedValue([
        { id: "m-user", role: "user", content: "What is creator royalty rate?" },
        { id: "m-asst", role: "assistant", content: "Default royalty is 5% on secondary sales." },
      ]);

      render(<AiChatWidget />);
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

      // Open history
      fireEvent.click(screen.getByTestId("ai-chat-history-btn"));
      const sessionItem = await screen.findByTestId("ai-chat-session-item-session-history-1");

      // Click to resume
      await act(async () => {
        fireEvent.click(sessionItem);
      });

      // Switches back to chat view and displays messages
      expect(screen.getByRole("log", { name: "Conversation" })).toBeInTheDocument();
      expect(screen.getByText("What is creator royalty rate?")).toBeInTheDocument();
      expect(screen.getByText("Default royalty is 5% on secondary sales.")).toBeInTheDocument();
      expect(screen.getByText("Royalty questions")).toBeInTheDocument();

      // Subsequent messages reuse this session ID
      mockStreamingReply("It applies on all marketplace resales.", "session-history-1");
      const input = screen.getByLabelText("Message the AI assistant");
      await act(async () => {
        fireEvent.change(input, { target: { value: "Does it apply to all sales?" } });
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(mockedStreamAiChat).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "session-history-1",
          message: "Does it apply to all sales?",
        }),
        expect.any(Object),
        expect.any(AbortSignal),
      );
    });

    it("allows starting a new conversation without losing past ones", async () => {
      // 1. User has an active conversation
      mockStreamingReply("Here are top collections.", "session-alpha");

      render(<AiChatWidget />);
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

      const input = screen.getByLabelText("Message the AI assistant");
      await act(async () => {
        fireEvent.change(input, { target: { value: "Top collections" } });
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(await screen.findByText("Here are top collections.")).toBeInTheDocument();

      // 2. Click 'New conversation' button
      const newBtn = screen.getByTestId("ai-chat-new-btn");
      act(() => {
        fireEvent.click(newBtn);
      });

      // Current conversation transcript is cleared, showing initial empty suggestions
      expect(screen.getByTestId("ai-chat-empty")).toBeInTheDocument();
      expect(screen.queryByText("Here are top collections.")).not.toBeInTheDocument();

      // 3. Open history - past conversation is still preserved!
      fireEvent.click(screen.getByTestId("ai-chat-history-btn"));
      expect(await screen.findByText("Top collections")).toBeInTheDocument();
    });

    it("allows deleting a session from history", async () => {
      mockedFetchSessions.mockResolvedValue([
        {
          id: "session-to-del",
          title: "Session to delete",
          preview: "Some text",
          createdAt: "2026-10-18T10:00:00.000Z",
          updatedAt: "2026-10-18T10:05:00.000Z",
        },
      ]);

      render(<AiChatWidget />);
      fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
      fireEvent.click(screen.getByTestId("ai-chat-history-btn"));

      expect(await screen.findByText("Session to delete")).toBeInTheDocument();

      const deleteBtn = screen.getByRole("button", {
        name: "Delete conversation Session to delete",
      });

      await act(async () => {
        fireEvent.click(deleteBtn);
      });

      expect(mockedDeleteSession).toHaveBeenCalledWith("session-to-del");
      expect(screen.queryByText("Session to delete")).not.toBeInTheDocument();
      expect(screen.getByTestId("ai-chat-history-empty")).toBeInTheDocument();
    });
  });
});


