import { isFunnelEvent, sendToInternalSink } from "../internal-sink";
import type { EnrichedTelemetryEvent } from "../../context/types";

describe("isFunnelEvent", () => {
  it("matches any event name prefixed with funnel_", () => {
    expect(isFunnelEvent("funnel_stage_entered")).toBe(true);
    expect(isFunnelEvent("funnel_conversion_achieved")).toBe(true);
  });

  it("does not match an unrelated event name", () => {
    expect(isFunnelEvent("cta_clicked")).toBe(false);
    expect(isFunnelEvent("auth_login_succeeded")).toBe(false);
  });
});

describe("sendToInternalSink (#662)", () => {
  const enriched: EnrichedTelemetryEvent<Record<string, unknown>> = {
    context: {
      timestamp: "2026-01-01T00:00:00.000Z",
      route: "/marketplace",
      locale: "en",
      session_id: "session-abc",
      device_type: "desktop",
      app_surface: "marketplace",
    },
    payload: { stage: "marketplace_browse" },
  };

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as any).fetch = fetchMock;
  });

  it("posts a funnel event to the internal analytics ingestion endpoint", () => {
    sendToInternalSink("funnel_stage_entered", enriched);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/analytics/events"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          eventName: "funnel_stage_entered",
          context: enriched.context,
          payload: enriched.payload,
        }),
      }),
    );
  });

  it("does not post a non-funnel event", () => {
    sendToInternalSink("cta_clicked", enriched);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when fetch rejects", () => {
    fetchMock.mockReturnValue(Promise.reject(new Error("network down")));
    expect(() => sendToInternalSink("funnel_stage_entered", enriched)).not.toThrow();
  });

  it("never throws when fetch itself throws synchronously", () => {
    fetchMock.mockImplementation(() => {
      throw new Error("blocked by CSP");
    });
    expect(() => sendToInternalSink("funnel_stage_entered", enriched)).not.toThrow();
  });
});
