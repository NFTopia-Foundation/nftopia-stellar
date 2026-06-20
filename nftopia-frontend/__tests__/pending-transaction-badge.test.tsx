import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/en",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/lib/stores/transaction-store", () => ({
  useTransactionStore: jest.fn(),
}));

import { useTransactionStore } from "@/lib/stores/transaction-store";
import { PendingTransactionBadge } from "@/components/transactions/PendingTransactionBadge";

const mockStore = useTransactionStore as jest.MockedFunction<typeof useTransactionStore>;

describe("PendingTransactionBadge", () => {
  it("renders nothing when no pending transactions", () => {
    mockStore.mockImplementation(() => []);
    const { container } = render(<PendingTransactionBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders badge with count when there are pending transactions", () => {
    mockStore.mockImplementation(() => [
      { status: "pending" },
      { status: "processing" },
      { status: "confirmed" },
    ]);

    render(<PendingTransactionBadge />);

    // The link should be present
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/en/transactions");
    expect(link).toHaveAttribute("aria-label", "2 pending transactions");

    // Count badge
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows singular label for exactly 1 pending tx", () => {
    mockStore.mockImplementation(() => [{ status: "pending" }]);

    render(<PendingTransactionBadge />);
    expect(
      screen.getByRole("link", { name: "1 pending transaction" })
    ).toBeInTheDocument();
  });

  it("displays 9+ when more than 9 pending", () => {
    const many = Array.from({ length: 11 }, () => ({ status: "pending" }));
    mockStore.mockImplementation(() => many);

    render(<PendingTransactionBadge />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });
});
