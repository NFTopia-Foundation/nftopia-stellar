import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { CategorySelector } from "./CategorySelector";

expect.extend(toHaveNoViolations);

jest.mock("next/navigation", () => ({
  usePathname: () => "/en/marketplace",
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("CategorySelector accessibility", () => {
  it("has a labelled chip group and no axe violations", async () => {
    const { container, getByRole } = render(<CategorySelector />);

    expect(
      getByRole("group", { name: "Browse marketplace categories" }),
    ).toBeInTheDocument();
    expect(
      getByRole("button", { name: "marketplace.categories.all" }),
    ).toHaveAttribute("aria-pressed");
    expect(await axe(container)).toHaveNoViolations();
  });
});
