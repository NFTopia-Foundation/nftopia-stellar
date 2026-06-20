import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { act } from "@testing-library/react";

jest.mock("@/lib/stores/transaction-store", () => ({
  useTransactionStore: jest.fn(),
}));

jest.mock("@/lib/hooks/useTransactionTracker", () => ({
  useTransactionTracker: () => ({ trackTransaction: jest.fn() }),
}));

jest.mock("@/stores/walletStore", () => ({
  useWalletStore: () => ({ network: "testnet" }),
}));

jest.mock("@/lib/stellar/network", () => ({
  getExplorerUrl: (_network: string, txHash: string) =>
    `https://stellar.expert/explorer/testnet/tx/${txHash}`,
}));

jest.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/en",
  useSearchParams: () => new URLSearchParams(),
}));

import { useTransactionStore } from "@/lib/stores/transaction-store";
import { TransactionToastContainer } from "@/components/transactions/TransactionToast";

const mockStore = useTransactionStore as jest.MockedFunction<typeof useTransactionStore>;

describe("TransactionToastContainer", () => {
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when there are no transactions", () => {
    mockStore.mockImplementation((selector?: (s: any) => any) => {
      const state = { transactions: [], removeTransaction: mockRemove };
      return selector ? selector(state) : state;
    });

    const { container } = render(<TransactionToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a toast card for a pending transaction", () => {
    const tx = {
      id: "abc",
      txHash: "abcdef1234567890",
      type: "mint" as const,
      status: "pending" as const,
      network: "testnet",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockStore.mockImplementation((selector?: (s: any) => any) => {
      const state = { transactions: [tx], removeTransaction: mockRemove };
      return selector ? selector(state) : state;
    });

    render(<TransactionToastContainer />);

    expect(screen.getByText(/submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/mint/i)).toBeInTheDocument();
  });

  it("shows confirmed status text for a confirmed transaction", () => {
    const tx = {
      id: "conf1",
      txHash: "conf123456789012",
      type: "buy" as const,
      status: "confirmed" as const,
      network: "testnet",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockStore.mockImplementation((selector?: (s: any) => any) => {
      const state = { transactions: [tx], removeTransaction: mockRemove };
      return selector ? selector(state) : state;
    });

    render(<TransactionToastContainer />);
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
  });

  it("shows failed status and error message", () => {
    const tx = {
      id: "fail1",
      txHash: "fail123456789012",
      type: "bid" as const,
      status: "failed" as const,
      network: "testnet",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      errorMessage: "Insufficient balance",
    };

    mockStore.mockImplementation((selector?: (s: any) => any) => {
      const state = { transactions: [tx], removeTransaction: mockRemove };
      return selector ? selector(state) : state;
    });

    render(<TransactionToastContainer />);
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
  });

  it("calls removeTransaction when dismiss button clicked", () => {
    const tx = {
      id: "dismiss1",
      txHash: "dismiss123456789",
      type: "cancel" as const,
      status: "confirmed" as const,
      network: "testnet",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockStore.mockImplementation((selector?: (s: any) => any) => {
      const state = { transactions: [tx], removeTransaction: mockRemove };
      return selector ? selector(state) : state;
    });

    render(<TransactionToastContainer />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(mockRemove).toHaveBeenCalledWith("dismiss1");
  });

  it("renders at most 3 toasts", () => {
    const makeTx = (id: string) => ({
      id,
      txHash: id,
      type: "mint" as const,
      status: "pending" as const,
      network: "testnet",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const txs = [makeTx("tx1"), makeTx("tx2"), makeTx("tx3"), makeTx("tx4")];

    mockStore.mockImplementation((selector?: (s: any) => any) => {
      const state = { transactions: txs, removeTransaction: mockRemove };
      return selector ? selector(state) : state;
    });

    render(<TransactionToastContainer />);
    // Each toast has a dismiss button — there should be exactly 3
    expect(screen.getAllByRole("button", { name: /dismiss/i })).toHaveLength(3);
  });
});
