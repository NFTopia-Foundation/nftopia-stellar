import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MarketplaceFilters } from "../MarketplaceFilters";
import { PRICE_DEBOUNCE_MS } from "../PriceRangeSlider";
import { presetStorageKey } from "@/lib/marketplace/filter-presets";

const mockReplace = jest.fn();
let mockParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  usePathname: () => "/en/marketplace",
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockParams,
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts?.name ? `${key}:${String(opts.name)}` : key,
  }),
}));

let mockUserId: string | null = "user-1";
jest.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: mockUserId ? { id: mockUserId } : null }),
}));

const lastUrl = () => mockReplace.mock.calls[mockReplace.mock.calls.length - 1]?.[0] as string;
const lastParams = () => new URLSearchParams(lastUrl().split("?")[1] ?? "");

const renderFilters = (query = "", props: React.ComponentProps<typeof MarketplaceFilters> = {}) => {
  mockParams = new URLSearchParams(query);
  return render(<MarketplaceFilters {...props} />);
};

beforeEach(() => {
  jest.useFakeTimers();
  mockReplace.mockClear();
  mockUserId = "user-1";
  window.localStorage.clear();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const settle = () =>
  act(() => {
    jest.advanceTimersByTime(PRICE_DEBOUNCE_MS + 10);
  });

describe("price range (#753)", () => {
  it("debounces URL updates while typing", () => {
    renderFilters();
    const min = screen.getByRole("spinbutton", { name: "Minimum price" });

    fireEvent.change(min, { target: { value: "1" } });
    fireEvent.change(min, { target: { value: "12" } });
    act(() => {
      jest.advanceTimersByTime(PRICE_DEBOUNCE_MS - 50);
    });
    expect(mockReplace).not.toHaveBeenCalled();

    settle();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(lastParams().get("minPrice")).toBe("12");
  });

  it("never commits min > max: the edited bound pulls the other along", () => {
    renderFilters("maxPrice=10");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum price" }), {
      target: { value: "25" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("marketplace.priceRange.invalid");
    settle();

    expect(lastParams().get("minPrice")).toBe("25");
    expect(lastParams().get("maxPrice")).toBe("25");
  });

  it("drops negative or non-numeric input instead of writing it to the URL", () => {
    renderFilters("minPrice=5");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum price" }), {
      target: { value: "-3" },
    });
    settle();

    expect(lastParams().has("minPrice")).toBe(false);
  });

  it("exposes two labelled, keyboard-operable slider thumbs synced with the inputs", () => {
    renderFilters("minPrice=10&maxPrice=40", { listingPrices: [5, 80] });

    const minThumb = screen.getByRole("slider", { name: "marketplace.priceRange.minThumb" });
    const maxThumb = screen.getByRole("slider", { name: "marketplace.priceRange.maxThumb" });
    expect(minThumb).toHaveValue("10");
    expect(maxThumb).toHaveValue("40");
    // Bounds derived from listing data (80 → nice ceiling 100).
    expect(maxThumb).toHaveAttribute("max", "100");

    fireEvent.change(maxThumb, { target: { value: "60" } });
    expect(screen.getByRole("spinbutton", { name: "Maximum price" })).toHaveValue(60);
    settle();
    expect(lastParams().get("maxPrice")).toBe("60");
  });

  it("does not let the min thumb pass the max thumb", () => {
    renderFilters("minPrice=10&maxPrice=40", { listingPrices: [80] });

    fireEvent.change(screen.getByRole("slider", { name: "marketplace.priceRange.minThumb" }), {
      target: { value: "70" },
    });
    settle();

    expect(lastParams().get("minPrice")).toBe("40");
    expect(lastParams().get("maxPrice")).toBe("40");
  });

  it("treats the max thumb at the top of the track as no upper limit", () => {
    renderFilters("maxPrice=40", { listingPrices: [80] });

    fireEvent.change(screen.getByRole("slider", { name: "marketplace.priceRange.maxThumb" }), {
      target: { value: "100" },
    });
    settle();

    expect(lastParams().has("maxPrice")).toBe(false);
  });
});

describe("filter presets (#752)", () => {
  const saveAs = (name: string) => {
    fireEvent.change(screen.getByLabelText("marketplace.presets.nameLabel"), {
      target: { value: name },
    });
    fireEvent.click(screen.getByRole("button", { name: "marketplace.presets.save" }));
  };

  it("saves the current filters under a name, per user", () => {
    renderFilters("category=art&maxPrice=50");
    saveAs("Cheap art");

    expect(screen.getByText("marketplace.presets.saved:Cheap art")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cheap art" })).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem(presetStorageKey("user-1"))!);
    expect(stored[0]).toMatchObject({ name: "Cheap art", query: "category=art&maxPrice=50" });
  });

  it("disables saving when no filters are set", () => {
    renderFilters("");
    expect(screen.getByRole("button", { name: "marketplace.presets.save" })).toBeDisabled();
  });

  it("applies a preset by replacing the URL params", () => {
    window.localStorage.setItem(
      presetStorageKey("user-1"),
      JSON.stringify([
        { id: "p1", name: "Music deals", query: "category=music&maxPrice=20", createdAt: "t" },
      ]),
    );
    renderFilters("sortBy=oldest&minPrice=3");

    fireEvent.change(screen.getByLabelText("marketplace.presets.listLabel"), {
      target: { value: "p1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "marketplace.presets.apply" }));

    expect(lastUrl()).toBe("/en/marketplace?category=music&maxPrice=20");
  });

  it("deletes a preset", () => {
    window.localStorage.setItem(
      presetStorageKey("user-1"),
      JSON.stringify([{ id: "p1", name: "Old", query: "category=art", createdAt: "t" }]),
    );
    renderFilters("");

    fireEvent.change(screen.getByLabelText("marketplace.presets.listLabel"), {
      target: { value: "p1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "marketplace.presets.delete" }));

    expect(screen.queryByRole("option", { name: "Old" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(presetStorageKey("user-1"))!)).toEqual([]);
  });

  it("keeps filtering working when storage fails", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    renderFilters("category=art");

    saveAs("Will fail");
    expect(screen.getByText("marketplace.presets.errors.storageUnavailable")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum price" }), {
      target: { value: "9" },
    });
    settle();
    expect(lastParams().get("maxPrice")).toBe("9");
    expect(lastParams().get("category")).toBe("art");
  });

  it("ignores corrupt stored presets", () => {
    window.localStorage.setItem(presetStorageKey("user-1"), "{corrupt");
    renderFilters("category=art");

    expect(screen.getByRole("option", { name: "marketplace.presets.none" })).toBeInTheDocument();
  });
});
