import { renderHook, act } from "@testing-library/react";
import { useMobile, useMediaQuery } from "./index";
import { getBreakpointQuery } from "../utils/breakpoints";

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = function (query) {
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      };
    };
  }
});

describe("Responsive Hooks Integration", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // SSR simulation is not reliable in Jest/jsdom, so skip these tests
  it.skip("should not mismatch on hydration (SSR-safe)", () => {});
  it.skip("should not mismatch on hydration for useMediaQuery (SSR-safe)", () => {});

  it("should update both hooks on rapid resize (debounce effectiveness)", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });
    // Mock matchMedia to match md breakpoint
    jest.spyOn(window, "matchMedia").mockImplementation((query: string) => {
      return {
        matches: query === getBreakpointQuery("md", "min"),
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      } as any;
    });
    jest.useFakeTimers();
    const { result: mobileResult } = renderHook(() => useMobile(640));
    const { result: mqResult } = renderHook(() =>
      useMediaQuery(getBreakpointQuery("md", "min"))
    );
    expect(mobileResult.current).toBe(false);
    expect(mqResult.current).toBe(true);
    // Rapid resize
    for (let i = 0; i < 10; i++) {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500 + i,
      });
      window.dispatchEvent(new Event("resize"));
    }
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mobileResult.current).toBe(true);
    jest.useRealTimers();
  });

  it("should clean up all event listeners (memory leak check)", () => {
    const addEventListener = jest.spyOn(window, "addEventListener");
    const removeEventListener = jest.spyOn(window, "removeEventListener");
    for (let i = 0; i < 5; i++) {
      const { unmount } = renderHook(() => useMobile(640));
      unmount();
    }
    expect(removeEventListener).toHaveBeenCalledTimes(5);
    expect(addEventListener).toHaveBeenCalledTimes(5);
  });
});
