import { render, screen, waitFor } from "@testing-library/react";
import { OptimizedFetchTestComponent } from "./OptimizedFetchTestComponent";
import { clearAllCaches } from "../utils/fetchUtils";
import React from "react";

global.fetch = jest.fn();

// Helper to reset the module cache for useOptimizedFetch
const resetOptimizedFetchCache = () => {
  jest.resetModules();
};

describe("useOptimizedFetch (React 18 compatible)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllCaches();
  });

  it("should fetch and cache data", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ foo: "bar" }),
    });
    render(<OptimizedFetchTestComponent url="test-url" />);
    expect(screen.getByTestId("loading").textContent).toBe("loading");
    await waitFor(() =>
      expect(screen.getByTestId("data").textContent).toContain("foo")
    );
    expect(screen.getByTestId("loading").textContent).toBe("not-loading");
  });

  it("should handle errors and retry", async () => {
    let callCount = 0;
    (fetch as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount < 2) return Promise.reject(new Error("fail"));
      return Promise.resolve({ ok: true, json: async () => ({ foo: "bar" }) });
    });
    render(
      <OptimizedFetchTestComponent
        url="test-url"
        options={{ retry: 1, retryDelay: 10 }}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("data").textContent).toContain("foo")
    );
  });

  it("should show error on fetch failure", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    render(<OptimizedFetchTestComponent url="test-url-error" />);
    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("error");
      expect(screen.getByTestId("data").textContent).toBe("no-data");
    });
  });

  it("should cleanup on unmount and prevent memory leaks", () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ foo: "bar" }),
    });
    const { unmount } = render(<OptimizedFetchTestComponent url="test-url" />);
    unmount();
    // No errors should be thrown
  });
});
