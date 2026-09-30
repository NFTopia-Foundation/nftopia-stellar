import { useTransactionStore } from "@/lib/stores/transaction-store";
import type { TrackedTransaction } from "@/lib/stores/transaction-store";

const makeTransaction = (hash: string): TrackedTransaction => ({
  hash,
  type: "bid",
  network: "testnet",
  status: "pending",
  submittedAt: "2026-09-29T00:00:00.000Z",
  updatedAt: "2026-09-29T00:00:00.000Z",
});

describe("transaction store", () => {
  beforeEach(() => {
    useTransactionStore.setState({ transactions: [] });
  });

  it("records and updates transaction status", () => {
    useTransactionStore.getState().addTransaction(makeTransaction("hash-1"));
    useTransactionStore.getState().updateTransaction("hash-1", {
      status: "confirmed",
    });

    expect(useTransactionStore.getState().transactions[0]).toMatchObject({
      hash: "hash-1",
      status: "confirmed",
    });
  });

  it("replaces duplicate hashes and caps retained history", () => {
    const store = useTransactionStore.getState();
    for (let index = 0; index < 101; index += 1) {
      store.addTransaction(makeTransaction(`hash-${index}`));
    }
    store.addTransaction(makeTransaction("hash-100"));

    const transactions = useTransactionStore.getState().transactions;
    expect(transactions).toHaveLength(100);
    expect(transactions[0].hash).toBe("hash-100");
    expect(transactions.filter((transaction) => transaction.hash === "hash-100"))
      .toHaveLength(1);
  });
});
