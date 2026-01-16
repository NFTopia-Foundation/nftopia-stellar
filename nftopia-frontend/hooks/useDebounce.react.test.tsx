import { render, screen } from "@testing-library/react";
import { DebounceTestComponent } from "./DebounceTestComponent";
import React from "react";
import { act } from "react-dom/test-utils";

jest.useFakeTimers();

describe("useDebounce (React 18 compatible)", () => {
  it("should debounce value changes", () => {
    const { rerender } = render(
      <DebounceTestComponent value="a" delay={200} />
    );
    expect(screen.getByTestId("debounced").textContent).toBe("a");
    rerender(<DebounceTestComponent value="b" delay={200} />);
    expect(screen.getByTestId("debounced").textContent).toBe("a");
    act(() => {
      jest.advanceTimersByTime(199);
    });
    expect(screen.getByTestId("debounced").textContent).toBe("a");
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("debounced").textContent).toBe("b");
  });

  it("should support immediate execution", () => {
    const { rerender } = render(
      <DebounceTestComponent value="a" delay={100} immediate={true} />
    );
    expect(screen.getByTestId("debounced").textContent).toBe("a");
    rerender(<DebounceTestComponent value="b" delay={100} immediate={true} />);
    expect(screen.getByTestId("debounced").textContent).toBe("a");
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByTestId("debounced").textContent).toBe("b");
  });

  it("should cleanup on unmount and prevent memory leaks", () => {
    const { unmount, rerender } = render(
      <DebounceTestComponent value="a" delay={100} />
    );
    rerender(<DebounceTestComponent value="b" delay={100} />);
    unmount();
    // No errors should be thrown
  });
});
