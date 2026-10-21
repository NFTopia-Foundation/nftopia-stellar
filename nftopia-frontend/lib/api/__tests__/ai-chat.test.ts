import {
  AiQuotaExceededError,
  checkAiHealth,
  deleteAiChatSession,
  fetchAiChatSessionMessages,
  fetchAiChatSessions,
  getAiUsage,
  sendAiChat,
  streamAiChat,
} from "@/lib/api/ai-chat";
import { API_CONFIG } from "@/lib/config";

describe("ai-chat API client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    localStorage.clear();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("checkAiHealth", () => {
    it("calls GET /ai/health and returns up status", async () => {
      const mockPayload = {
        status: "up",
        timestamp: "2026-10-19T00:00:00.000Z",
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const result = await checkAiHealth();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_CONFIG.baseUrl}/ai/health`,
        expect.objectContaining({
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }),
      );
      expect(result).toEqual(mockPayload);
    });

    it("returns down status when backend reports Anthropic down", async () => {
      const mockPayload = {
        status: "down",
        timestamp: "2026-10-19T00:00:00.000Z",
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const result = await checkAiHealth();
      expect(result.status).toBe("down");
    });

    it("returns unconfigured status when backend reports API key missing", async () => {
      const mockPayload = {
        status: "unconfigured",
        timestamp: "2026-10-19T00:00:00.000Z",
      };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const result = await checkAiHealth();
      expect(result.status).toBe("unconfigured");
    });

    it("throws an error when HTTP status is not ok (e.g. 500)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
      });

      await expect(checkAiHealth()).rejects.toThrow(
        "AI health check failed with status 503",
      );
    });

    it("passes AbortSignal to fetch", async () => {
      const controller = new AbortController();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "up", timestamp: "now" }),
      });

      await checkAiHealth(controller.signal);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        }),
      );
    });
  });

  describe("fetchAiChatSessions", () => {
    it("fetches session summaries with bearer token from localStorage", async () => {
      localStorage.setItem("access_token", "test-token-123");
      const mockSessions = [
        {
          id: "session-1",
          title: "First query",
          preview: "Assistant reply",
          createdAt: "2026-10-18T10:00:00.000Z",
          updatedAt: "2026-10-18T10:05:00.000Z",
          messageCount: 4,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      const result = await fetchAiChatSessions();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_CONFIG.baseUrl}/ai/sessions`,
        expect.objectContaining({
          method: "GET",
          headers: expect.any(Headers),
          credentials: "include",
        }),
      );
      const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(callHeaders.get("Authorization")).toBe("Bearer test-token-123");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("session-1");
      expect(result[0].title).toBe("First query");
    });

    it("parses wrapped { sessions: [...] } response payload", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            {
              id: "session-wrapped",
              preview: "Wrapped reply preview",
              created_at: "2026-10-18T11:00:00.000Z",
              updated_at: "2026-10-18T11:30:00.000Z",
            },
          ],
        }),
      });

      const result = await fetchAiChatSessions();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("session-wrapped");
      expect(result[0].title).toBe("Wrapped reply preview");
    });

    it("throws when fetch returns non-ok status", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchAiChatSessions()).rejects.toThrow(
        "Failed to fetch AI chat sessions with status 500",
      );
    });
  });

  describe("fetchAiChatSessionMessages", () => {
    it("fetches message history for a given session ID", async () => {
      const mockMessages = [
        { id: "m-1", role: "user", content: "What is floor price?" },
        { id: "m-2", role: "assistant", content: "Floor price is 50 XLM" },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages,
      });

      const result = await fetchAiChatSessionMessages("session-abc");

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_CONFIG.baseUrl}/ai/sessions/session-abc/messages`,
        expect.objectContaining({
          method: "GET",
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("What is floor price?");
      expect(result[1].role).toBe("assistant");
    });

    it("handles wrapped { history: [...] } response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          history: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there!" },
          ],
        }),
      });

      const result = await fetchAiChatSessionMessages("session-xyz");
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("user");
      expect(result[1].role).toBe("assistant");
    });

    it("throws when session messages endpoint fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fetchAiChatSessionMessages("non-existent")).rejects.toThrow(
        "Failed to fetch AI chat session messages with status 404",
      );
    });
  });

  describe("deleteAiChatSession", () => {
    it("sends DELETE request for the session ID", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await deleteAiChatSession("session-to-delete");

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_CONFIG.baseUrl}/ai/sessions/session-to-delete`,
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("does not throw if status is 404", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(deleteAiChatSession("session-404")).resolves.toBeUndefined();
    });

    it("throws on server error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(deleteAiChatSession("session-err")).rejects.toThrow(
        "Failed to delete AI chat session with status 500",
      );
    });
  });

  describe("sendAiChat", () => {
    it("sends POST /ai/chat with message body and returns reply", async () => {
      const mockReply = { reply: "Hello world", sessionId: "session-123" };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockReply,
      });

      const result = await sendAiChat({ message: "Hello" });

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_CONFIG.baseUrl}/ai/chat`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ message: "Hello" }),
        }),
      );
      expect(result).toEqual(mockReply);
    });

    it("throws an error on non-ok response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(sendAiChat({ message: "Hello" })).rejects.toThrow(
        "AI request failed with status 500",
      );
    });

    it("throws AiQuotaExceededError when the daily/monthly cap is reached (403)", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          statusCode: 403,
          code: "AI_DAILY_TOKEN_CAP_REACHED",
          message: "Daily AI usage cap reached (200000 tokens). Please try again tomorrow.",
          resetsAt: "2026-10-21T00:00:00.000Z",
        }),
      });

      let caught: unknown;
      try {
        await sendAiChat({ message: "Hello" });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AiQuotaExceededError);
      const error = caught as AiQuotaExceededError;
      expect(error.code).toBe("AI_DAILY_TOKEN_CAP_REACHED");
      expect(error.resetsAt).toBe("2026-10-21T00:00:00.000Z");
      expect(error.message).toBe(
        "Daily AI usage cap reached (200000 tokens). Please try again tomorrow.",
      );
    });

    it("falls back to a generic error when a 403 body doesn't match the cap-exceeded shape", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      });

      await expect(sendAiChat({ message: "Hello" })).rejects.toThrow(
        "AI request failed with status 403",
      );
    });
  });

  describe("streamAiChat", () => {
    it("throws an error on non-ok response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(streamAiChat({ message: "Hello" })).rejects.toThrow(
        "AI stream failed with status 500",
      );
    });

    it("throws AiQuotaExceededError when the cap is reached before any token streams", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          statusCode: 403,
          code: "AI_MONTHLY_TOKEN_CAP_REACHED",
          message: "Monthly AI usage cap reached (2000000 tokens). Please try again next month.",
          resetsAt: "2026-11-01T00:00:00.000Z",
        }),
      });

      let caught: unknown;
      try {
        await streamAiChat({ message: "Hello" });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AiQuotaExceededError);
      expect((caught as AiQuotaExceededError).code).toBe(
        "AI_MONTHLY_TOKEN_CAP_REACHED",
      );
      expect((caught as AiQuotaExceededError).resetsAt).toBe(
        "2026-11-01T00:00:00.000Z",
      );
    });
  });

  describe("getAiUsage", () => {
    it("calls GET /ai/usage and returns the usage summary", async () => {
      const mockUsage = {
        daily: {
          totalTokens: 1000,
          estimatedCostUsd: 0.05,
          cap: 200000,
          remaining: 199000,
          spendCapUsd: null,
          spendRemaining: null,
          percentUsed: 1,
          approachingCap: false,
          resetsAt: "2026-10-21T00:00:00.000Z",
        },
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
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUsage,
      });

      const result = await getAiUsage();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_CONFIG.baseUrl}/ai/usage`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toEqual(mockUsage);
    });

    it("throws an error on non-ok response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(getAiUsage()).rejects.toThrow(
        "AI usage request failed with status 401",
      );
    });
  });
});
