import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import FunnelDashboardPage from "../app/[locale]/internal/funnel-dashboard/page";

/**
 * Covers #662's acceptance criteria: the dashboard visualizes per-stage
 * session counts/drop-off for a selected date range, and is access-gated
 * (feature flag at the route level, admin-only data from the backend).
 */

const mockNotFound = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
jest.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

let mockIsAuthenticated = true;
jest.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}));

const mockFetchWithAuth = jest.fn();
jest.mock("@/lib/api/fetchWithAuth", () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_INTERNAL_DASHBOARD_ENABLED;

describe("FunnelDashboardPage (#662)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_INTERNAL_DASHBOARD_ENABLED = "true";
    mockIsAuthenticated = true;
    mockNotFound.mockClear();
    mockFetchWithAuth.mockReset();
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_INTERNAL_DASHBOARD_ENABLED = ORIGINAL_FLAG;
  });

  it("404s when the feature flag is disabled, before checking auth or fetching", () => {
    process.env.NEXT_PUBLIC_INTERNAL_DASHBOARD_ENABLED = "false";

    // React logs the thrown notFound() as an uncaught component error —
    // expected here (no error boundary in this unit test), so silence it.
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<FunnelDashboardPage />)).toThrow("NEXT_NOT_FOUND");
    consoleSpy.mockRestore();

    expect(mockFetchWithAuth).not.toHaveBeenCalled();
  });

  it("prompts sign-in instead of fetching when not authenticated", () => {
    mockIsAuthenticated = false;
    render(<FunnelDashboardPage />);

    expect(
      screen.getByText(/sign in with an admin account/i),
    ).toBeInTheDocument();
    expect(mockFetchWithAuth).not.toHaveBeenCalled();
  });

  it("fetches and renders per-stage session counts with a default date range", async () => {
    mockFetchWithAuth.mockResolvedValue({
      json: () =>
        Promise.resolve({
          from: "2026-01-01T00:00:00.000Z",
          to: "2026-01-08T00:00:00.000Z",
          sessionsByStage: { landing: 100, explore_categories: 40 },
        }),
    });

    render(<FunnelDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("funnel-stages")).toBeInTheDocument();
    });

    expect(screen.getByTestId("funnel-stage-landing")).toHaveTextContent(
      "100 sessions",
    );
    expect(
      screen.getByTestId("funnel-stage-explore_categories"),
    ).toHaveTextContent("40 sessions");
    expect(
      screen.getByTestId("funnel-stage-explore_categories"),
    ).toHaveTextContent("-60%");

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/analytics/funnel/summary"),
    );
  });

  it("shows an access-denied message when the backend returns FORBIDDEN", async () => {
    mockFetchWithAuth.mockRejectedValue({ code: "FORBIDDEN" });

    render(<FunnelDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("funnel-error")).toHaveTextContent(
        /don't have access/i,
      );
    });
  });

  it("re-fetches when the date range changes", async () => {
    mockFetchWithAuth.mockResolvedValue({
      json: () => Promise.resolve({ sessionsByStage: { landing: 5 } }),
    });

    render(<FunnelDashboardPage />);
    await waitFor(() => expect(mockFetchWithAuth).toHaveBeenCalledTimes(1));

    const fromInput = screen.getByTestId("funnel-date-from") as HTMLInputElement;
    act(() => {
      fromInput.focus();
      Object.defineProperty(fromInput, "value", {
        value: "2026-01-01",
        configurable: true,
      });
      fromInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => expect(mockFetchWithAuth).toHaveBeenCalledTimes(2));
  });
});
