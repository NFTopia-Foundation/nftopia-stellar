import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { MarketplaceFilters } from "./MarketplaceFilters";

expect.extend(toHaveNoViolations);

jest.mock("next/navigation", () => ({
  usePathname: () => "/en/marketplace",
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("MarketplaceFilters accessibility", () => {
  it("has labelled controls and no axe violations", async () => {
    const { container, getByRole } = render(<MarketplaceFilters />);

    expect(getByRole("searchbox", { name: "Search NFTs" })).toBeInTheDocument();
    expect(getByRole("spinbutton", { name: "Minimum price" })).toBeInTheDocument();
    expect(getByRole("spinbutton", { name: "Maximum price" })).toBeInTheDocument();
    expect(getByRole("combobox", { name: "Sort marketplace results" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("labels both price slider thumbs and the preset controls (#752, #753)", async () => {
    const { container, getByRole, getByLabelText } = render(<MarketplaceFilters />);

    expect(getByRole("group", { name: "marketplace.priceRange.group" })).toBeInTheDocument();
    const minThumb = getByRole("slider", { name: "marketplace.priceRange.minThumb" });
    const maxThumb = getByRole("slider", { name: "marketplace.priceRange.maxThumb" });
    // Native range inputs: focusable and operable with arrow/Home/End keys.
    expect(minThumb.tagName).toBe("INPUT");
    expect(maxThumb).toHaveAttribute("type", "range");
    expect(minThumb).not.toHaveAttribute("tabindex", "-1");

    expect(getByLabelText("marketplace.presets.nameLabel")).toBeInTheDocument();
    expect(getByLabelText("marketplace.presets.listLabel")).toBeInTheDocument();
    expect(getByRole("button", { name: "marketplace.presets.save" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
