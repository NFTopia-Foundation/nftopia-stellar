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

import { act } from "@testing-library/react";
import { useTransactionStore } from "@/lib/stores/transaction-store";

describe("useTransactionStore", () => {
  beforeEach(() => {
    act(() => {
      useTransactionStore.getState().clearAll();
    });
  });

  it("starts with an empty transaction list", () => {
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it("addTransaction inserts a transaction", () => {
    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "abc123",
        type: "mint",
        status: "pending",
        network: "testnet",
      });
    });

    const txs = useTransactionStore.getState().transactions;
    expect(txs).toHaveLength(1);
    expect(txs[0].txHash).toBe("abc123");
    expect(txs[0].id).toBe("abc123");
    expect(txs[0].status).toBe("pending");
    expect(txs[0].createdAt).toBeGreaterThan(0);
  });

  it("addTransaction ignores duplicate txHash", () => {
    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "dup",
        type: "buy",
        status: "pending",
        network: "testnet",
      });
      useTransactionStore.getState().addTransaction({
        txHash: "dup",
        type: "buy",
        status: "pending",
        network: "testnet",
      });
    });

    expect(useTransactionStore.getState().transactions).toHaveLength(1);
  });

  it("updateStatus changes the transaction status", () => {
    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "tx1",
        type: "list",
        status: "pending",
        network: "testnet",
      });
      useTransactionStore.getState().updateStatus("tx1", "confirmed");
    });

    const tx = useTransactionStore.getState().transactions[0];
    expect(tx.status).toBe("confirmed");
  });

  it("updateStatus sets errorMessage for failed", () => {
    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "txfail",
        type: "bid",
        status: "pending",
        network: "testnet",
      });
      useTransactionStore.getState().updateStatus("txfail", "failed", "Out of gas");
    });

    const tx = useTransactionStore.getState().transactions[0];
    expect(tx.status).toBe("failed");
    expect(tx.errorMessage).toBe("Out of gas");
  });

  it("removeTransaction removes by txHash", () => {
    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "rm1",
        type: "cancel",
        status: "pending",
        network: "testnet",
      });
      useTransactionStore.getState().removeTransaction("rm1");
    });

    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it("clearAll empties the list", () => {
    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "t1",
        type: "mint",
        status: "confirmed",
        network: "testnet",
      });
      useTransactionStore.getState().addTransaction({
        txHash: "t2",
        type: "buy",
        status: "pending",
        network: "testnet",
      });
      useTransactionStore.getState().clearAll();
    });

    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it("getPendingCount returns count of pending/processing", () => {
    act(() => {
      useTransactionStore.getState().addTransaction({
        txHash: "p1",
        type: "mint",
        status: "pending",
        network: "testnet",
      });
      useTransactionStore.getState().addTransaction({
        txHash: "p2",
        type: "buy",
        status: "processing",
        network: "testnet",
      });
      useTransactionStore.getState().addTransaction({
        txHash: "p3",
        type: "list",
        status: "confirmed",
        network: "testnet",
      });
    });

    expect(useTransactionStore.getState().getPendingCount()).toBe(2);
  });

  it("caps history at 50 entries", () => {
    act(() => {
      for (let i = 0; i < 55; i++) {
        useTransactionStore.getState().addTransaction({
          txHash: `hash${i}`,
          type: "mint",
          status: "confirmed",
          network: "testnet",
        });
      }
    });

    expect(useTransactionStore.getState().transactions).toHaveLength(50);
  });
});
