import {
  DEFAULT_PRICE_CEILING,
  clamp,
  derivePriceBounds,
  formatPriceParam,
  niceCeiling,
  normalizeRange,
  parsePrice,
  sliderStep,
} from "../price-range";

describe("parsePrice", () => {
  it("parses non-negative numbers", () => {
    expect(parsePrice("12.5")).toBe(12.5);
    expect(parsePrice(" 0 ")).toBe(0);
  });

  it("returns null for empty, non-numeric, negative or non-finite input", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("-5")).toBeNull();
    expect(parsePrice("Infinity")).toBeNull();
  });
});

describe("normalizeRange", () => {
  it("keeps valid and open-ended ranges as-is", () => {
    expect(normalizeRange({ min: 1, max: 5 })).toEqual({ min: 1, max: 5 });
    expect(normalizeRange({ min: null, max: 5 })).toEqual({ min: null, max: 5 });
    expect(normalizeRange({ min: 9, max: null })).toEqual({ min: 9, max: null });
  });

  it("never lets min exceed max — the edited bound wins", () => {
    expect(normalizeRange({ min: 10, max: 5 }, "min")).toEqual({ min: 10, max: 10 });
    expect(normalizeRange({ min: 10, max: 5 }, "max")).toEqual({ min: 5, max: 5 });
  });
});

describe("clamp", () => {
  it("clamps into bounds", () => {
    const bounds = { min: 0, max: 100 };
    expect(clamp(-1, bounds)).toBe(0);
    expect(clamp(50, bounds)).toBe(50);
    expect(clamp(150, bounds)).toBe(100);
  });
});

describe("derivePriceBounds", () => {
  it("falls back to the default ceiling with no data", () => {
    expect(derivePriceBounds()).toEqual({ min: 0, max: DEFAULT_PRICE_CEILING });
  });

  it("derives a nice ceiling from listing prices, ignoring junk", () => {
    expect(derivePriceBounds([12, "37.5", null, "abc", -4])).toEqual({ min: 0, max: 50 });
  });

  it("always includes the user's typed values", () => {
    expect(derivePriceBounds([10], { min: null, max: 730 }).max).toBe(1000);
    expect(derivePriceBounds([10], { min: 4200, max: null }).max).toBe(5000);
  });
});

describe("niceCeiling / sliderStep / formatPriceParam", () => {
  it("rounds up to 1-2-5 steps", () => {
    expect(niceCeiling(3)).toBe(5);
    expect(niceCeiling(120)).toBe(200);
    expect(niceCeiling(0.07)).toBeCloseTo(0.1);
  });

  it("chooses a sensible step", () => {
    expect(sliderStep({ min: 0, max: 1000 })).toBe(10);
    expect(sliderStep({ min: 0, max: 1 })).toBe(0.01);
  });

  it("serializes without float noise", () => {
    expect(formatPriceParam(0.1 + 0.2)).toBe("0.3");
    expect(formatPriceParam(null)).toBe("");
  });
});
