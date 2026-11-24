import {
  FavoriteActionPayload,
  FollowActionPayload,
  NewActionInput,
  OfflineActionPayload,
  OfflineActionType,
  QueuedAction,
} from "./types";

/** Canonical JSON: same logical payload always produces the same string. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

/**
 * Fields that describe intent. Display labels and previous (optimistic) state
 * are deliberately excluded so a repeated toggle gets the same idempotency
 * key even though the UI state around it changed.
 */
function intentPayload<T extends OfflineActionType>(
  input: NewActionInput<T>,
): Record<string, unknown> {
  if (input.type === "favorite") {
    const payload = input.payload as FavoriteActionPayload;
    return {
      itemType: payload.itemType,
      itemId: payload.itemId,
      favorited: payload.favorited,
    };
  }
  const payload = input.payload as FollowActionPayload;
  return {
    creatorId: payload.creatorId,
    following: payload.following,
  };
}

export function actionFingerprint<T extends OfflineActionType>(
  input: NewActionInput<T>,
): string {
  return stableStringify({
    type: input.type,
    payload: intentPayload(input),
    baseRevision: input.baseRevision ?? null,
  });
}

export function idempotencyKeyFor<T extends OfflineActionType>(
  input: NewActionInput<T>,
): string {
  return input.idempotencyKey ?? actionFingerprint(input);
}

/** Identifies the entity an action targets (ignores the desired state). */
export function targetKey(type: OfflineActionType, payload: unknown): string {
  const record = (payload ?? {}) as Record<string, unknown>;
  if (type === "favorite") {
    return `favorite:${String(record.itemType)}:${String(record.itemId)}`;
  }
  return `follow:${String(record.creatorId)}`;
}

export function desiredState(action: {
  type: OfflineActionType;
  payload: OfflineActionPayload;
}): string {
  if (action.type === "favorite") {
    return (action.payload as FavoriteActionPayload).favorited ? "on" : "off";
  }
  return (action.payload as FollowActionPayload).following ? "on" : "off";
}

/** Collision-resistant enough for a client queue; ordering uses `sequence`. */
export function createActionId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `qa_${Date.now().toString(36)}_${random}`;
}

/** Deterministic ordering: sequence, then createdAt, then id. */
export function compareActions(
  a: Pick<QueuedAction, "sequence" | "createdAt" | "id">,
  b: Pick<QueuedAction, "sequence" | "createdAt" | "id">,
): number {
  const bySequence = (a.sequence ?? 0) - (b.sequence ?? 0);
  if (bySequence !== 0) return bySequence;
  const byTime = (a.createdAt ?? 0) - (b.createdAt ?? 0);
  if (byTime !== 0) return byTime;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

/**
 * Creates an in-memory action. Used by the persisted store and by the write
 * hook (which needs a value for optimistic UI / the dispatcher).
 */
export function createQueuedAction<T extends OfflineActionType>(
  input: NewActionInput<T>,
  sequence: number,
): QueuedAction {
  const base = {
    id: input.id ?? createActionId(),
    sequence,
    type: input.type,
    payload: input.payload,
    createdAt: input.createdAt ?? Date.now(),
    status: "pending" as const,
    attempts: 0,
    idempotencyKey: idempotencyKeyFor(input),
    baseRevision: input.baseRevision,
  };

  if (input.type === "favorite") {
    return base as QueuedAction;
  }
  return base as QueuedAction;
}
