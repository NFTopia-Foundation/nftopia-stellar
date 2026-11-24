import {
  deserializeQueue,
  QUEUE_SCHEMA_VERSION,
  serializeQueue,
} from "@/lib/offline-queue/serializer";
import { createQueuedAction, compareActions } from "@/lib/offline-queue/utils";

function favorite(id: string, sequence: number, createdAt = 1_000 + sequence) {
  return createQueuedAction(
    {
      id,
      type: "favorite",
      payload: { itemType: "nft", itemId: id, favorited: true },
      createdAt,
    },
    sequence,
  );
}

describe("offline queue serializer", () => {
  it("round-trips actions with the current schema version and deterministic order", () => {
    const actions = [favorite("c", 3), favorite("a", 1), favorite("b", 2)];
    const raw = serializeQueue({ actions, nextSequence: 4 });

    expect(JSON.parse(raw).version).toBe(QUEUE_SCHEMA_VERSION);
    const restored = deserializeQueue(raw);
    expect(restored.actions.map((action) => action.id)).toEqual(["a", "b", "c"]);
    expect(restored.nextSequence).toBe(4);
    expect(compareActions(restored.actions[2], restored.actions[0])).toBeGreaterThan(0);
  });

  it("returns an empty queue for invalid JSON, null and non-objects", () => {
    expect(deserializeQueue("{not json").actions).toEqual([]);
    expect(deserializeQueue(null).actions).toEqual([]);
    expect(deserializeQueue("42").actions).toEqual([]);
  });

  it("refuses unknown future schema versions", () => {
    const raw = JSON.stringify({
      version: QUEUE_SCHEMA_VERSION + 1,
      actions: [favorite("a", 1)],
      nextSequence: 2,
    });
    expect(deserializeQueue(raw)).toEqual({ actions: [], nextSequence: 1 });
  });

  it("migrates legacy v0 entries (action/timestamp/retryCount, no sequence)", () => {
    const raw = JSON.stringify({
      state: {
        actions: [
          {
            id: "old-b",
            action: "favorite",
            timestamp: "2024-01-02T00:00:00.000Z",
            retryCount: 2,
            payload: { itemType: "collection", itemId: "col-b", favorited: false },
          },
          {
            id: "old-a",
            action: "favorite",
            timestamp: "2024-01-01T00:00:00.000Z",
            payload: { itemType: "nft", itemId: "nft-a", favorited: true },
          },
        ],
      },
      version: 0,
    });

    const restored = deserializeQueue(raw);
    expect(restored.actions).toHaveLength(2);
    // Deterministic ordering by timestamp, then id, when no sequence exists.
    expect(restored.actions.map((action) => action.id)).toEqual(["old-a", "old-b"]);
    expect(restored.actions.map((action) => action.sequence)).toEqual([1, 2]);
    expect(restored.actions[1].type).toBe("favorite");
    expect(restored.actions[1].attempts).toBe(2);
    expect(restored.actions[1].createdAt).toBe(Date.parse("2024-01-02T00:00:00.000Z"));
    expect(restored.nextSequence).toBe(3);
  });

  it("drops malformed entries and duplicate ids without losing good actions", () => {
    const good = favorite("good", 1);
    const raw = JSON.stringify({
      version: QUEUE_SCHEMA_VERSION,
      actions: [
        good,
        { ...good, id: "good" }, // duplicate id
        { id: "bad-type", type: "unknown", payload: {}, sequence: 2 },
        { id: "bad-payload", type: "favorite", payload: { itemId: 42 }, sequence: 3 },
        null,
      ],
      nextSequence: 5,
    });

    const restored = deserializeQueue(raw);
    expect(restored.actions).toHaveLength(1);
    expect(restored.actions[0].id).toBe("good");
    expect(restored.nextSequence).toBe(5);
  });

  it("preserves conflict metadata across a reload", () => {
    const action = {
      ...favorite("nft-1", 1),
      status: "conflict" as const,
      conflict: {
        code: "CONFLICT" as const,
        message: "Server revision changed",
        serverRevision: "r7",
        serverState: { favorited: false },
        detectedAt: 123,
      },
    };

    const restored = deserializeQueue(
      serializeQueue({ actions: [action], nextSequence: 2 }),
    );
    expect(restored.actions[0].conflict?.serverRevision).toBe("r7");
    expect(restored.actions[0].conflict?.serverState).toEqual({ favorited: false });
  });
});
