import { act, renderHook } from "@testing-library/react";
import { useOfflineQueueStore } from "./offlineQueueStore";

describe("offlineQueueStore", () => {
  beforeEach(() => {
    useOfflineQueueStore.setState({ isOnline: true, queue: [] });
  });

  it("enqueues an action with metadata", () => {
    const { enqueue, queue } = useOfflineQueueStore.getState();
    enqueue("favorite", { nftId: "nft-1" });
    const q = useOfflineQueueStore.getState().queue;
    expect(q).toHaveLength(1);
    expect(q[0].action).toBe("favorite");
    expect(q[0].payload).toEqual({ nftId: "nft-1" });
    expect(q[0].retryCount).toBe(0);
    expect(q[0].maxRetries).toBe(3);
  });

  it("reports pending count via hook", () => {
    const { result } = renderHook(() => useOfflineQueueStore((s) => s.queue.length));
    expect(result.current).toBe(0);
    act(() => {
      useOfflineQueueStore.getState().enqueue("favorite", { nftId: "nft-2" });
    });
    expect(useOfflineQueueStore.getState().pendingCount()).toBe(1);
  });

  it("replays queued actions in order when online", async () => {
    const store = useOfflineQueueStore.getState();
    store.enqueue("favorite", { nftId: "a" });
    store.enqueue("favorite", { nftId: "b" });
    const order: string[] = [];
    const executor = async (item: { payload: Record<string, unknown> }) => {
      order.push(String(item.payload.nftId));
    };
    await store.processQueue(executor);
    expect(order).toEqual(["a", "b"]);
    expect(useOfflineQueueStore.getState().queue).toHaveLength(0);
  });

  it("drops an item after exhausting retries (conflict handling)", async () => {
    const store = useOfflineQueueStore.getState();
    store.enqueue("favorite", { nftId: "x" });
    const executor = async () => {
      throw new Error("server conflict");
    };
    await store.processQueue(executor);
    // First attempt increments retryCount to 1 (not dropped yet).
    // Process again to exhaust... but maxRetries 3; run enough times.
    for (let i = 0; i < 3; i++) {
      // reset online
      useOfflineQueueStore.setState({ isOnline: true });
      await useOfflineQueueStore.getState().processQueue(executor);
    }
    expect(useOfflineQueueStore.getState().queue).toHaveLength(0);
  });

  it("does not process when offline", async () => {
    const store = useOfflineQueueStore.getState();
    store.enqueue("favorite", { nftId: "z" });
    useOfflineQueueStore.setState({ isOnline: false });
    const executor = jest.fn();
    await useOfflineQueueStore.getState().processQueue(executor);
    expect(executor).not.toHaveBeenCalled();
    expect(useOfflineQueueStore.getState().queue).toHaveLength(1);
  });

  it("clears the queue", () => {
    const store = useOfflineQueueStore.getState();
    store.enqueue("favorite", { nftId: "q" });
    store.clear();
    expect(useOfflineQueueStore.getState().queue).toHaveLength(0);
  });
});