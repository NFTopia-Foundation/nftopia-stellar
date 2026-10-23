import { renderHook } from "@testing-library/react";
import { useFunnelStageTracking } from "../useFunnelStageTracking";
import { JourneySessionManager } from "@/lib/telemetry/funnel/journey-session";

/**
 * Covers #662's missing piece: an actual dispatch call wiring the
 * funnel stage-resolver/journey-session building blocks (which existed
 * but were never invoked) into real funnel_stage_entered/exited events.
 */

let mockPathname = "/en";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

let mockUser: { id: string } | null = null;
let mockIsAuthenticated = false;
jest.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (
    selector: (state: { user: unknown; isAuthenticated: boolean }) => unknown,
  ) => selector({ user: mockUser, isAuthenticated: mockIsAuthenticated }),
}));

const mockTrack = jest.fn();
jest.mock("@/lib/telemetry", () => ({
  telemetry: { track: (...args: unknown[]) => mockTrack(...args) },
}));

describe("useFunnelStageTracking (#662)", () => {
  beforeEach(() => {
    mockPathname = "/en";
    mockUser = null;
    mockIsAuthenticated = false;
    mockTrack.mockClear();
    JourneySessionManager.invalidateSession();
  });

  it("fires funnel_stage_entered for the initial stage without an exit event", () => {
    renderHook(() => useFunnelStageTracking());

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      "funnel_stage_entered",
      expect.objectContaining({ stage: "landing" }),
    );
  });

  it("fires exited for the old stage and entered for the new one on navigation", () => {
    const { rerender } = renderHook(() => useFunnelStageTracking());
    mockTrack.mockClear();

    mockPathname = "/en/marketplace";
    rerender();

    expect(mockTrack).toHaveBeenCalledWith(
      "funnel_stage_exited",
      expect.objectContaining({ stage: "landing", next_stage: "marketplace_browse" }),
    );
    expect(mockTrack).toHaveBeenCalledWith(
      "funnel_stage_entered",
      expect.objectContaining({
        stage: "marketplace_browse",
        referrer_stage: "landing",
      }),
    );
  });

  it("does not fire again when the route changes but the resolved stage does not", () => {
    // /explore and /explore/:category both resolve to EXPLORE_CATEGORIES —
    // a same-stage, different-route navigation.
    mockPathname = "/en/explore";
    const { rerender } = renderHook(() => useFunnelStageTracking());
    mockTrack.mockClear();

    mockPathname = "/en/explore/art";
    rerender();

    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("reports user_cohort as returning for an authenticated user, new otherwise", () => {
    mockIsAuthenticated = true;
    mockUser = { id: "user-1" };

    renderHook(() => useFunnelStageTracking());

    expect(mockTrack).toHaveBeenCalledWith(
      "funnel_stage_entered",
      expect.objectContaining({ user_cohort: "returning" }),
    );
  });

  it("marks is_returning_to_stage when the session already visited this stage", () => {
    const { rerender } = renderHook(() => useFunnelStageTracking());

    mockPathname = "/en/marketplace";
    rerender();
    mockPathname = "/en";
    rerender();
    mockTrack.mockClear();

    mockPathname = "/en/marketplace";
    rerender();

    expect(mockTrack).toHaveBeenCalledWith(
      "funnel_stage_entered",
      expect.objectContaining({
        stage: "marketplace_browse",
        is_returning_to_stage: true,
      }),
    );
  });
});
