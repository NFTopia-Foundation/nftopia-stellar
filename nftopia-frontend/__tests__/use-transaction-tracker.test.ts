import { act, renderHook, waitFor } from "@testing-library/react";
import { useTransactionTracker } from "@/lib/hooks/useTransactionTracker";
import { useTransactionStore } from "@/lib/stores/transaction-store";
import { getSorobanServer } from "@/lib/stellar/client";

jest.mock("@/lib/stellar/client", () => ({
  getSorobanServer: jest.fn(),
  getNetworkPassphrase: jest.fn(() => "Test SDF Network ; September 2015"),
}));

const transaction = {
  hash: "ledger-hash-1",
  type: "bid" as const,
  network: "testnet" as const,
  status: "pending" as const,
  submittedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("useTransactionTracker", () => {
  beforeEach(() => {
    useTransactionStore.setState({ transactions: [] });
    jest.clearAllMocks();
  });

  it("updates a pending transaction when the ledger confirms it", async () => {
    (getSorobanServer as jest.Mock).mockReturnValue({
      getTransaction: jest.fn().mockResolvedValue({ status: "SUCCESS" }),
    });
    useTransactionStore.getState().addTransaction(transaction);

    const { unmount } = renderHook(() => useTransactionTracker());
    await waitFor(() => {
      expect(useTransactionStore.getState().transactions[0].status).toBe("confirmed");
    });
    unmount();
  });

  it("marks a ledger-rejected transaction failed", async () => {
    (getSorobanServer as jest.Mock).mockReturnValue({
      getTransaction: jest.fn().mockResolvedValue({ status: "FAILED" }),
    });
    useTransactionStore.getState().addTransaction(transaction);

    const { unmount } = renderHook(() => useTransactionTracker());
    await waitFor(() => {
      expect(useTransactionStore.getState().transactions[0]).toMatchObject({
        status: "failed",
        error: expect.stringContaining("ledger rejected"),
      });
    });
    unmount();
  });

  it("fails tracking after the two-minute timeout", async () => {
    (getSorobanServer as jest.Mock).mockReturnValue({
      getTransaction: jest.fn(),
    });
    useTransactionStore.getState().addTransaction({
      ...transaction,
      submittedAt: new Date(Date.now() - 121_000).toISOString(),
    });

    const { unmount } = renderHook(() => useTransactionTracker());
    await waitFor(() => {
      expect(useTransactionStore.getState().transactions[0].status).toBe("failed");
    });
    expect(getSorobanServer).not.toHaveBeenCalled();
    unmount();
  });
});
