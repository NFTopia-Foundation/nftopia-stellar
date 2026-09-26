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
});
