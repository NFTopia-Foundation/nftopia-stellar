import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/lib/stores/transaction-store", () => ({
  useTransactionStore: jest.fn(),
}));

jest.mock("@/stores/walletStore", () => ({
  useWalletStore: () => ({ network: "testnet" }),
}));

jest.mock("@/lib/stellar/network", () => ({
  getExplorerUrl: (_network: string, txHash: string) =>
    `https://stellar.expert/explorer/testnet/tx/${txHash}`,
}));

// Suppress TransactionSigner render — it has its own deep dep tree
jest.mock("@/components/wallet/TransactionSigner", () => ({
  TransactionSigner: ({ open }: { open: boolean }) =>
    open ? <div data-testid="tx-signer">Signer</div> : null,
}));

import { useTransactionStore } from "@/lib/stores/transaction-store";
import { TransactionHistoryList } from "@/components/transactions/TransactionHistoryList";

const mockStore = useTransactionStore as jest.MockedFunction<typeof useTransactionStore>;
const mockClearAll = jest.fn();

const sampleTxs = [
  {
    id: "tx1",
    txHash: "aabbccdd11223344",
    type: "mint" as const,
    status: "confirmed" as const,
    network: "testnet",
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now(),
  },
  {
    id: "tx2",
    txHash: "eeff00112233aabb",
    type: "buy" as const,
    status: "failed" as const,
    network: "testnet",
    createdAt: Date.now() - 120_000,
    updatedAt: Date.now(),
    errorMessage: "Fee too low",
    xdr: "AAABBBCCC",
  },
  {
    id: "tx3",
    txHash: "112233445566ccdd",
    type: "list" as const,
    status: "pending" as const,
    network: "testnet",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

describe("TransactionHistoryList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.mockImplementation((selector?: (s: any) => any) => {
      const state = { transactions: sampleTxs, clearAll: mockClearAll };
      return selector ? selector(state) : state;
    });
  });

  it("renders all transactions by default", () => {
    render(<TransactionHistoryList />);

    expect(screen.getByText("mint")).toBeInTheDocument();
    expect(screen.getByText("buy")).toBeInTheDocument();
    expect(screen.getByText("list")).toBeInTheDocument();
  });

  it("shows empty state when no transactions match filter", () => {
    mockStore.mockImplementation((selector?: (s: any) => any) => {
      const state = { transactions: [], clearAll: mockClearAll };
      return selector ? selector(state) : state;
    });

    render(<TransactionHistoryList />);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });

  it("filters by 'confirmed' status", () => {
    render(<TransactionHistoryList />);

    fireEvent.click(screen.getByRole("button", { name: /^confirmed/i }));

    expect(screen.getByText("mint")).toBeInTheDocument();
    // buy (failed) and list (pending) should not appear
    expect(screen.queryByText("buy")).not.toBeInTheDocument();
    expect(screen.queryByText("list")).not.toBeInTheDocument();
  });

  it("filters by 'failed' status", () => {
    render(<TransactionHistoryList />);

    fireEvent.click(screen.getByRole("button", { name: /^failed/i }));

    expect(screen.getByText("buy")).toBeInTheDocument();
    expect(screen.queryByText("mint")).not.toBeInTheDocument();
  });

  it("shows error message for failed transactions", () => {
    render(<TransactionHistoryList />);
    expect(screen.getByText(/fee too low/i)).toBeInTheDocument();
  });

  it("shows retry button for failed transactions with xdr", () => {
    render(<TransactionHistoryList />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retry button opens TransactionSigner modal", () => {
    render(<TransactionHistoryList />);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(screen.getByTestId("tx-signer")).toBeInTheDocument();
  });

  it("clear-all button calls clearAll after confirm", () => {
    window.confirm = jest.fn(() => true);
    render(<TransactionHistoryList />);

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(mockClearAll).toHaveBeenCalledTimes(1);
  });

  it("does not call clearAll if user cancels confirm dialog", () => {
    window.confirm = jest.fn(() => false);
    render(<TransactionHistoryList />);

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(mockClearAll).not.toHaveBeenCalled();
  });
});
