import { fireEvent, render, screen } from "@testing-library/react";
import { CategorySelector } from "../CategorySelector";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants/categories";
import {
  CTA_IDS,
  CTA_PLACEMENTS,
  emitCtaClicked,
} from "@/lib/telemetry/navigation-instrumentation";

const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  usePathname: () => "/en/marketplace",
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/telemetry/navigation-instrumentation", () => {
  const actual = jest.requireActual("@/lib/telemetry/navigation-instrumentation");
  return { ...actual, emitCtaClicked: jest.fn() };
});

const mockedEmitCtaClicked = jest.mocked(emitCtaClicked);

describe("CategorySelector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it("renders an 'All' chip plus every canonical taxonomy category", () => {
    render(<CategorySelector />);

    expect(
      screen.getByRole("button", { name: "marketplace.categories.all" }),
    ).toBeInTheDocument();
    for (const category of MARKETPLACE_CATEGORIES) {
      expect(
        screen.getByRole("button", { name: category.labelKey }),
      ).toBeInTheDocument();
    }
  });

  it("marks the 'All' chip pressed when no category is selected", () => {
    render(<CategorySelector />);

    expect(
      screen.getByRole("button", { name: "marketplace.categories.all" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("marks the matching chip pressed when ?category= is set", () => {
    mockSearchParams = new URLSearchParams("category=gaming");
    render(<CategorySelector />);

    expect(
      screen.getByRole("button", { name: "marketplace.categories.gaming" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "marketplace.categories.all" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("navigates into ?category=<id> when a category chip is clicked", () => {
    render(<CategorySelector />);

    fireEvent.click(
      screen.getByRole("button", { name: "marketplace.categories.art" }),
    );

    expect(mockReplace).toHaveBeenCalledWith("/en/marketplace?category=art", {
      scroll: false,
    });
    expect(mockedEmitCtaClicked).toHaveBeenCalledWith(
      expect.objectContaining({
        cta_id: CTA_IDS.FILTER_CATEGORY,
        placement: CTA_PLACEMENTS.MARKETPLACE_FILTER_BAR,
        category_id: "art",
      }),
    );
  });

  it("preserves other filters already in the URL when switching category", () => {
    mockSearchParams = new URLSearchParams("search=sword&sortBy=oldest");
    render(<CategorySelector />);

    fireEvent.click(
      screen.getByRole("button", { name: "marketplace.categories.gaming" }),
    );

    const destination = mockReplace.mock.calls[0][0] as string;
    expect(destination).toContain("search=sword");
    expect(destination).toContain("sortBy=oldest");
    expect(destination).toContain("category=gaming");
  });

  it("clears the category param (without touching other filters) when 'All' is clicked", () => {
    mockSearchParams = new URLSearchParams("category=art&search=foo");
    render(<CategorySelector />);

    fireEvent.click(
      screen.getByRole("button", { name: "marketplace.categories.all" }),
    );

    expect(mockReplace).toHaveBeenCalledWith("/en/marketplace?search=foo", {
      scroll: false,
    });
  });
});
