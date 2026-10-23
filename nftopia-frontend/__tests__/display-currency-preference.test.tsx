import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FloorPriceDisplay } from "../components/collection/FloorPriceDisplay";
import { usePreferencesStore } from "../lib/stores/preferences-store";
import { convertFromXlm, formatCurrencyAmount, PLACEHOLDER_XLM_USD_RATE } from "../lib/currency";

/**
 * Covers #660's acceptance criteria that changing the currency preference
 * actually changes what balance/price components display, and that the
 * default is a current, valid option rather than the stale 'STRK' value.
 */

afterEach(() => {
  act(() => {
    usePreferencesStore.getState().resetPreferences();
  });
});

describe("lib/currency", () => {
  it("passes an XLM amount through unconverted", () => {
    expect(convertFromXlm(100, "XLM")).toBe(100);
    expect(formatCurrencyAmount(100, "XLM")).toBe("100.00 XLM");
  });

  it("converts an XLM amount to USD using the configured rate", () => {
    expect(convertFromXlm(100, "USD")).toBeCloseTo(100 * PLACEHOLDER_XLM_USD_RATE);
    expect(formatCurrencyAmount(100, "USD")).toBe(
      `$${(100 * PLACEHOLDER_XLM_USD_RATE).toFixed(2)}`
    );
  });

  it("treats null/undefined/invalid amounts as zero", () => {
    expect(formatCurrencyAmount(null, "XLM")).toBe("0.00 XLM");
    expect(formatCurrencyAmount(undefined, "USD")).toBe("$0.00");
    expect(formatCurrencyAmount("not-a-number", "XLM")).toBe("0.00 XLM");
  });
});

describe("preferences-store currency default", () => {
  it("defaults display.currency to XLM, not the stale STRK value", () => {
    expect(usePreferencesStore.getState().display.currency).toBe("XLM");
  });
});

describe("balance/price components respect the currency preference", () => {
  it("re-renders FloorPriceDisplay with the converted amount when the preference changes", () => {
    render(<FloorPriceDisplay floorPrice="100" variant="compact" />);

    // Default preference is XLM — no conversion applied.
    expect(screen.getByText("100.00 XLM")).toBeInTheDocument();

    act(() => {
      usePreferencesStore.getState().setDisplay({ currency: "USD" });
    });

    // Same underlying floorPrice, now converted and labeled for USD.
    const expectedUsd = (100 * PLACEHOLDER_XLM_USD_RATE).toFixed(2);
    expect(screen.queryByText("100.00 XLM")).not.toBeInTheDocument();
    expect(screen.getByText(`${expectedUsd} USD`)).toBeInTheDocument();
  });

  it("lets an explicit currency prop override the global preference", () => {
    act(() => {
      usePreferencesStore.getState().setDisplay({ currency: "USD" });
    });

    render(<FloorPriceDisplay floorPrice="50" currency="XLM" variant="compact" />);

    // Explicit prop wins even though the global preference is USD.
    expect(screen.getByText("50.00 XLM")).toBeInTheDocument();
  });
});
