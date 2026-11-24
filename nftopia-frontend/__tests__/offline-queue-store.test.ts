import { OfflineActionConflictError } from "@/lib/offline-queue/errors";
import { QUEUE_STORAGE_KEY, QUEUE_SCHEMA_VERSION } from "@/lib/offline-queue/serializer";
import {
  configureOfflineQueue,
  rehydrateQueue,
  resetQueueConfiguration,
  useOfflineActionQueue,
} from "@/lib/offline-queue/store";
import { QueuedAction } from "@/lib/offline-queue/types";

const favoriteInput = (id: string, favorited = true) => ({
  id,
  type: "favorite" as const,
  payload: { itemType: "nft" as const, itemId: id, favorited },
});

const followInput = (id: string, following = true) => ({
  id,
  type: "follow" as const,
  payload: { creatorId: id, following },
});

beforeEach(() => {
  localStorage.clear();
  configureOfflineQueue({
    dispatcher: jest.fn(async () => ({})),
    isOnline: () => true,
    retryDelay: () => 1,
    scheduler: jest.fn(),
  });
  useOfflineActionQueue.getState().clear();
  localStorage.clear();
});

afterEach(() => {
  resetQueueConfiguration();
  localStorage.clear();
});

describe("offline action queue store", () => {
  it("assigns deterministic increasing sequence numbers", () => {
    const store = useOfflineActionQueue.getState();
    const a = store.enqueue(favoriteInput("a"));
    const b = store.enqueue(followInput("b"));
    const c = store.enqueue(favoriteInput("c", false));

    expect([a.sequence, b.sequence, c.sequence]).toEqual([1, 2, 3]);
    expect(useOfflineActionQueue.getState().actions.map((action) => action.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(() => store.enqueue(favoriteInput("a"))).not.toThrow();
  });

  it("replays every action in order and removes successful actions", async () => {
    const calls: string[] = [];
    configureOfflineQueue({
      dispatcher: async (action) => {
        calls.push(action.id);
        return {};
      },
    });
    const store = useOfflineActionQueue.getState();
    store.enqueue(favoriteInput("first"));
    store.enqueue(followInput("second"));
    store.enqueue(favoriteInput("third", false));

    await store.replay();

    expect(calls).toEqual(["first", "second", "third"]);
    expect(useOfflineActionQueue.getState().actions).toHaveLength(0);
  });

  it("replays one action at a time", async () => {
    let active = 0;
    let maxActive = 0;
    configureOfflineQueue({
      dispatcher: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        active -= 1;
        return {};
      },
    });
    const store = useOfflineActionQueue.getState();
    store.enqueue(favoriteInput("a"));
    store.enqueue(favoriteInput("b"));

    await store.replay();

    expect(maxActive).toBe(1);
  });

  it("retries retryable failures with backoff and keeps the same action", async () => {
    const scheduler = jest.fn();
    const dispatcher = jest
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({});
    configureOfflineQueue({ dispatcher, scheduler });
    useOfflineActionQueue.getState().enqueue(favoriteInput("retry-me"));

    await useOfflineActionQueue.getState().replay();

    expect(dispatcher).toHaveBeenCalledTimes(1);
    const failedOnce = useOfflineActionQueue.getState().actions[0];
    expect(failedOnce.status).toBe("pending");
    expect(failedOnce.attempts).toBe(1);
    expect(failedOnce.nextAttemptAt).toBeGreaterThan(Date.now() - 1);
    expect(failedOnce.lastError).toBeTruthy();
    expect(scheduler).toHaveBeenCalled();

    // Simulate the backoff deadline elapsing.
    useOfflineActionQueue.setState((state) => ({
      actions: state.actions.map((action) => ({ ...action, nextAttemptAt: 0 }) as QueuedAction),
    }));
    await useOfflineActionQueue.getState().replay();

    expect(dispatcher).toHaveBeenCalledTimes(2);
    expect(useOfflineActionQueue.getState().actions).toHaveLength(0);
  });

  it("stops on conflict and leaves later actions pending", async () => {
    const calls: string[] = [];
    configureOfflineQueue({
      dispatcher: async (action) => {
        calls.push(action.id);
        if (action.id === "first") {
          throw new OfflineActionConflictError("Server changed this favorite", {
            serverRevision: "r3",
            serverState: { favorited: false },
          });
        }
        return {};
      },
    });
    const store = useOfflineActionQueue.getState();
    store.enqueue(favoriteInput("first"));
    store.enqueue(favoriteInput("second"));

    await store.replay();

    expect(calls).toEqual(["first"]);
    const actions = useOfflineActionQueue.getState().actions;
    expect(actions[0].status).toBe("conflict");
    expect(actions[0].conflict?.serverRevision).toBe("r3");
    expect(actions[1].status).toBe("pending");
  });

  it("does not replay while offline", async () => {
    const dispatcher = jest.fn(async () => ({}));
    configureOfflineQueue({ dispatcher, isOnline: () => false });
    useOfflineActionQueue.getState().enqueue(favoriteInput("offline"));

    await useOfflineActionQueue.getState().replay();

    expect(dispatcher).not.toHaveBeenCalled();
    expect(useOfflineActionQueue.getState().actions).toHaveLength(1);
  });

  it("de-duplicates by idempotency key and by redundant toggle", () => {
    const store = useOfflineActionQueue.getState();
    const withKey = store.enqueue({
      ...favoriteInput("dedupe-key"),
      idempotencyKey: "client-mutation-1",
    });
    const again = store.enqueue({
      ...favoriteInput("different-id", true),
      idempotencyKey: "client-mutation-1",
    });
    expect(again.id).toBe(withKey.id);

    store.enqueue(favoriteInput("toggle-target", true));
    const repeated = store.enqueue(favoriteInput("toggle-target", true));
    expect(repeated.id).toBe("toggle-target");
    store.enqueue(favoriteInput("toggle-target", false));

    const actions = useOfflineActionQueue.getState().actions;
    expect(actions).toHaveLength(3);
    expect(actions.slice(0, 2).map((action) => action.id)).toEqual([
      "dedupe-key",
      "toggle-target",
    ]);
    expect(
      actions.filter(
        (action) => action.type === "favorite" && action.payload.itemId === "toggle-target",
      ),
    ).toHaveLength(2);
  });

  it("persists actions and restores them across a reload", () => {
    useOfflineActionQueue.getState().enqueue(favoriteInput("persisted"));
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.version).toBe(QUEUE_SCHEMA_VERSION);
    expect(parsed.actions[0].id).toBe("persisted");

    useOfflineActionQueue.setState({ actions: [], nextSequence: 1 });
    localStorage.setItem(QUEUE_STORAGE_KEY, raw as string);
    rehydrateQueue();

    expect(useOfflineActionQueue.getState().actions.map((action) => action.id)).toEqual([
      "persisted",
    ]);
  });

  it("resolves a conflict with Keep mine by forcing a replay", async () => {
    const dispatcher = jest
      .fn()
      .mockRejectedValueOnce(new OfflineActionConflictError("Changed"))
      .mockResolvedValueOnce({});
    configureOfflineQueue({ dispatcher });
    useOfflineActionQueue.getState().enqueue(favoriteInput("conflicted"));
    await useOfflineActionQueue.getState().replay();

    const conflict = useOfflineActionQueue.getState().actions[0];
    expect(conflict.status).toBe("conflict");

    await useOfflineActionQueue.getState().resolveConflict(conflict.id, "keep-mine");

    expect(dispatcher).toHaveBeenCalledTimes(2);
    expect(dispatcher.mock.calls[1][1]).toMatchObject({ force: true });
    expect(useOfflineActionQueue.getState().actions).toHaveLength(0);
  });

  it("resolves a conflict with Use server and Dismiss by dropping the action", async () => {
    const action = useOfflineActionQueue.getState().enqueue(favoriteInput("conflicted"));
    useOfflineActionQueue.getState().markConflict(action.id, {
      code: "CONFLICT",
      message: "Changed",
      serverState: { favorited: false },
      detectedAt: Date.now(),
    });

    await useOfflineActionQueue.getState().resolveConflict(action.id, "use-server");
    expect(useOfflineActionQueue.getState().actions).toHaveLength(0);

    const second = useOfflineActionQueue.getState().enqueue(favoriteInput("dismissed"));
    useOfflineActionQueue.getState().markConflict(second.id, {
      code: "CONFLICT",
      message: "Changed",
      detectedAt: Date.now(),
    });
    await useOfflineActionQueue.getState().resolveConflict(second.id, "dismiss");
    expect(useOfflineActionQueue.getState().actions).toHaveLength(0);
  });

  it("retries a permanently failed action on request", async () => {
    const dispatcher = jest
      .fn()
      .mockRejectedValueOnce({ status: 400, message: "Bad request" })
      .mockResolvedValueOnce({});
    configureOfflineQueue({ dispatcher });
    useOfflineActionQueue.getState().enqueue(favoriteInput("failed"));
    await useOfflineActionQueue.getState().replay();
    expect(useOfflineActionQueue.getState().actions[0].status).toBe("failed");

    await useOfflineActionQueue.getState().retryAction("failed");

    expect(dispatcher).toHaveBeenCalledTimes(2);
    expect(useOfflineActionQueue.getState().actions).toHaveLength(0);
  });
});
