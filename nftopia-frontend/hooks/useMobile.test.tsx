import { renderHook, act } from "@testing-library/react";
import { useMobile } from "./useMobile";

describe("useMobile", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return true if width is less than breakpoint", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    });
    const { result } = renderHook(() => useMobile(640));
    expect(result.current).toBe(true);
  });

  it("should return false if width is greater than breakpoint", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });
    const { result } = renderHook(() => useMobile(640));
    expect(result.current).toBe(false);
  });

  it("should update on resize", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });
    const { result } = renderHook(() => useMobile(640));
    expect(result.current).toBe(false);
    await act(async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });
      window.dispatchEvent(new Event("resize"));
      // Wait for debounce
      await new Promise((res) => setTimeout(res, 110));
    });
    expect(result.current).toBe(true);
  });

  it("should clean up event listeners", () => {
    const addEventListener = jest.spyOn(window, "addEventListener");
    const removeEventListener = jest.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useMobile(640));
    unmount();
    expect(addEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function)
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function)
    );
  });

  // SSR test is not meaningful in jsdom, so skip it
  it.skip("should be SSR safe", () => {
    // Skipped: jsdom always defines window, so SSR (no-window) cannot be simulated in this environment.
    // To re-enable: Use a Node-only test environment or integration test in a real SSR context.
  });

  // Advanced tests
  it("debounces rapid resize events", () => {
    jest.useFakeTimers();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });
    const { result } = renderHook(() => useMobile(640));
    expect(result.current).toBe(false);
    act(() => {
      for (let i = 0; i < 10; i++) {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 500 + i,
        });
        window.dispatchEvent(new Event("resize"));
      }
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);
    jest.useRealTimers();
  });

  it("cleans up listeners on repeated mount/unmount (memory leak check)", () => {
    const addEventListener = jest.spyOn(window, "addEventListener");
    const removeEventListener = jest.spyOn(window, "removeEventListener");
    for (let i = 0; i < 5; i++) {
      const { unmount } = renderHook(() => useMobile(640));
      unmount();
    }
    expect(removeEventListener).toHaveBeenCalledTimes(5);
    expect(addEventListener).toHaveBeenCalledTimes(5);
  });

  // Cross-browser/SSR test is not meaningful in jsdom, so skip it
  it.skip("is robust if window is missing (cross-browser/SSR)", () => {
    // Skipped: jsdom always defines window, so this cannot be simulated in this environment.
    // To re-enable: Use a Node-only test environment or integration test in a real SSR context.
  });
});
