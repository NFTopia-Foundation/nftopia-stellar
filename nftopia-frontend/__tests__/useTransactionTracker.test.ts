// Strip only persist (localStorage) and devtools — keep immer real so
// mutating reducers work correctly in the test environment.
jest.mock("zustand/middleware", () => {
  const actual = jest.requireActual("zustand/middleware");
  return {
    ...actual,
    persist: (fn: unknown) => fn,
    devtools: (fn: unknown) => fn,
  };
});

import { act, renderHook } from "@testing-library/react";

// Mock the Stellar server before importing the hook
const mockGetTransaction = jest.fn();

jest.mock("@/lib/stellar/client", () => ({
  getSorobanServer: () => ({
    getTransaction: mockGetTransaction,
  }),
  defaultNetwork: "testnet",
}));

import { useTransactionTracker } from "@/lib/hooks/useTransactionTracker";
import { useTransactionStore } from "@/lib/stores/transaction-store";
import type { TrackedTransaction } from "@/lib/stores/transaction-store";

describe("useTransactionTracker", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetTransaction.mockReset();
    act(() => {
      useTransactionStore.getState().clearAll();
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("sets status to processing then confirmed on SUCCESS", async () => {
    mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });

    // Seed a pending tx in the store
    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "hashOK",
        type: "mint",
        status: "pending",
        network: "testnet",
      });
    });

    const { result } = renderHook(() => useTransactionTracker());

    await act(async () => {
      result.current.trackTransaction("hashOK", "testnet");
    });

    const tx = useTransactionStore.getState().transactions.find(
      (t: TrackedTransaction) => t.txHash === "hashOK"
    );
    expect(tx?.status).toBe("confirmed");
  });

  it("sets status to failed on FAILED response", async () => {
    mockGetTransaction.mockResolvedValue({ status: "FAILED" });

    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "hashFAIL",
        type: "buy",
        status: "pending",
        network: "testnet",
      });
    });

    const { result } = renderHook(() => useTransactionTracker());

    await act(async () => {
      result.current.trackTransaction("hashFAIL", "testnet");
    });

    const tx = useTransactionStore.getState().transactions.find(
      (t: TrackedTransaction) => t.txHash === "hashFAIL"
    );
    expect(tx?.status).toBe("failed");
  });

  it("does not double-track the same txHash", async () => {
    mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });

    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "hashDUP",
        type: "list",
        status: "pending",
        network: "testnet",
      });
    });

    const { result } = renderHook(() => useTransactionTracker());

    await act(async () => {
      result.current.trackTransaction("hashDUP", "testnet");
      result.current.trackTransaction("hashDUP", "testnet"); // second call ignored
    });

    // Should only have been called once (from the first trackTransaction)
    expect(mockGetTransaction).toHaveBeenCalledTimes(1);
  });

  it("times out after 2 minutes of NOT_FOUND responses", async () => {
    mockGetTransaction.mockResolvedValue({ status: "NOT_FOUND" });

    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "hashTIMEOUT",
        type: "cancel",
        status: "pending",
        network: "testnet",
      });
    });

    const { result } = renderHook(() => useTransactionTracker());

    // Start tracking — fires initial poll immediately
    await act(async () => {
      result.current.trackTransaction("hashTIMEOUT", "testnet");
      await Promise.resolve();
    });

    // Advance past 2-minute timeout and flush all pending async work
    await act(async () => {
      jest.advanceTimersByTime(130_000);
      // Flush microtasks for each interval callback
      for (let i = 0; i < 15; i++) {
        await Promise.resolve();
      }
    });

    const tx = useTransactionStore.getState().transactions.find(
      (t: TrackedTransaction) => t.txHash === "hashTIMEOUT"
    );
    expect(tx?.status).toBe("failed");
  });
});
