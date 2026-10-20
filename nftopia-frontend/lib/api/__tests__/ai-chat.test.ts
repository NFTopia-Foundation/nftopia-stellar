import { checkAiHealth, sendAiChat } from "../ai-chat";
import { API_CONFIG } from "@/lib/config";

describe("ai-chat api client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
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
      global.fetch = jest.fn().mockResolvedValue({
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
      global.fetch = jest.fn().mockResolvedValue({
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
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const result = await checkAiHealth();
      expect(result.status).toBe("unconfigured");
    });

    it("throws an error when HTTP status is not ok (e.g. 500)", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      await expect(checkAiHealth()).rejects.toThrow(
        "AI health check failed with status 503",
      );
    });

    it("passes AbortSignal to fetch", async () => {
      const controller = new AbortController();
      global.fetch = jest.fn().mockResolvedValue({
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

  describe("sendAiChat", () => {
    it("sends POST /ai/chat with message body and returns reply", async () => {
      const mockReply = { reply: "Hello world", sessionId: "session-123" };
      global.fetch = jest.fn().mockResolvedValue({
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
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(sendAiChat({ message: "Hello" })).rejects.toThrow(
        "AI request failed with status 500",
      );
    });
  });
});
