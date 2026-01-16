import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import Footer from "./Footer";
import { fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { act } from "react-dom/test-utils";

expect.extend(toHaveNoViolations);

describe("Footer accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(<Footer />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders and is accessible at mobile, tablet, and desktop breakpoints", async () => {
    const breakpoints = [320, 768, 1440];
    for (const width of breakpoints) {
      act(() => {
        window.innerWidth = width;
        window.dispatchEvent(new Event("resize"));
      });
      const { container } = render(<Footer />);
      // No horizontal scroll
      expect(document.body.scrollWidth).toBeLessThanOrEqual(
        document.body.clientWidth + 1
      );
      // All interactive elements have min 48px
      container.querySelectorAll("a,button").forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // skip hidden or non-rendered
        expect(rect.width).toBeGreaterThanOrEqual(48);
        expect(rect.height).toBeGreaterThanOrEqual(48);
      });
    }
  });
});
