import {
  OfflineActionStatus,
  OfflineActionType,
  QueueSnapshot,
  QueuedAction,
  ServerState,
} from "./types";
import { actionFingerprint, compareActions } from "./utils";

export const QUEUE_STORAGE_KEY = "nftopia-offline-actions";
export const QUEUE_SCHEMA_VERSION = 1;

const VALID_TYPES: OfflineActionType[] = ["favorite", "follow"];
const VALID_STATUSES: OfflineActionStatus[] = [
  "pending",
  "replaying",
  "failed",
  "conflict",
];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyQueue(): QueueSnapshot {
  return { actions: [], nextSequence: 1 };
}

function toTimestamp(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function readPayload(type: OfflineActionType, payload: unknown): QueuedAction["payload"] | null {
  if (!isRecord(payload)) return null;
  if (type === "favorite") {
    if (
      typeof payload.itemId !== "string" ||
      (payload.itemType !== "nft" && payload.itemType !== "collection") ||
      typeof payload.favorited !== "boolean"
    ) {
      return null;
    }
    return {
      itemType: payload.itemType,
      itemId: payload.itemId,
      favorited: payload.favorited,
      ...(typeof payload.label === "string" ? { label: payload.label } : {}),
      ...(typeof payload.previousFavorited === "boolean"
        ? { previousFavorited: payload.previousFavorited }
        : {}),
    };
  }
  if (typeof payload.creatorId !== "string" || typeof payload.following !== "boolean") {
    return null;
  }
  return {
    creatorId: payload.creatorId,
    following: payload.following,
    ...(typeof payload.label === "string" ? { label: payload.label } : {}),
    ...(typeof payload.previousFollowing === "boolean"
      ? { previousFollowing: payload.previousFollowing }
      : {}),
    ...(typeof payload.previousFollowerCount === "number"
      ? { previousFollowerCount: payload.previousFollowerCount }
      : {}),
  };
}

/** Normalizes one persisted entry. Returns null for malformed/unknown data. */
function normalizeAction(value: unknown, version: number, fallbackTime: number): QueuedAction | null {
  if (!isRecord(value)) return null;

  // v0 (mobile-style) entries used `action` / `timestamp` / `retryCount`.
  const rawType = value.type ?? value.action;
  const type = VALID_TYPES.find((candidate) => candidate === rawType);
  if (!type) return null;

  const payload = readPayload(type, value.payload);
  if (!payload) return null;

  const id = typeof value.id === "string" && value.id ? value.id : actionFingerprint({ type, payload });
  const createdAt = toTimestamp(value.createdAt ?? value.timestamp, fallbackTime);
  const status = VALID_STATUSES.find((candidate) => candidate === value.status) ?? "pending";
  const attempts = Math.max(
    0,
    typeof value.attempts === "number"
      ? value.attempts
      : typeof value.retryCount === "number"
        ? value.retryCount
        : 0,
  );
  const baseRevision =
    typeof value.baseRevision === "string" ? value.baseRevision : undefined;
  const idempotencyKey =
    typeof value.idempotencyKey === "string" && value.idempotencyKey
      ? value.idempotencyKey
      : actionFingerprint({
          type,
          payload,
          baseRevision,
        });

  const rawConflict = isRecord(value.conflict) ? value.conflict : undefined;
  const conflict = rawConflict
    ? {
        code: "CONFLICT" as const,
        message:
          typeof rawConflict.message === "string"
            ? rawConflict.message
            : "This action changed on the server while you were offline.",
        serverRevision:
          typeof rawConflict.serverRevision === "string"
            ? rawConflict.serverRevision
            : undefined,
        serverState: isRecord(rawConflict.serverState)
          ? (rawConflict.serverState as ServerState)
          : undefined,
        detectedAt: toTimestamp(rawConflict.detectedAt, createdAt),
      }
    : undefined;

  const action = {
    id,
    sequence:
      typeof value.sequence === "number" && Number.isFinite(value.sequence)
        ? value.sequence
        : 0,
    type,
    payload,
    createdAt,
    status,
    attempts,
    idempotencyKey,
    baseRevision,
    ...(typeof value.nextAttemptAt === "number" && Number.isFinite(value.nextAttemptAt)
      ? { nextAttemptAt: value.nextAttemptAt }
      : {}),
    ...(typeof value.lastError === "string" ? { lastError: value.lastError } : {}),
    ...(typeof value.force === "boolean" ? { force: value.force } : {}),
    ...(conflict ? { conflict } : {}),
  } as QueuedAction;

  // Version 1 made `sequence` mandatory; legacy entries are re-sequenced in
  // deserializeQueue after being sorted deterministically.
  void version;
  return action;
}

/** Serialize with the current schema version. Safe to call on the server. */
export function serializeQueue(snapshot: QueueSnapshot): string {
  const actions = [...snapshot.actions].sort(compareActions);
  const nextSequence = Math.max(
    snapshot.nextSequence,
    actions.reduce((max, action) => Math.max(max, action.sequence + 1), 1),
  );
  return JSON.stringify({
    version: QUEUE_SCHEMA_VERSION,
    actions,
    nextSequence,
  });
}

/**
 * Safely parses persisted queue data. Invalid JSON, unknown future schemas and
 * malformed entries are discarded rather than crashing the app on load.
 */
export function deserializeQueue(raw: string | null | undefined): QueueSnapshot {
  if (!raw) return emptyQueue();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyQueue();
  }
  if (!isRecord(parsed)) return emptyQueue();

  // Accept both our `{version, ...}` format and a zustand-persist style
  // `{state, version}` wrapper (used by earlier iterations of the web app).
  const state = isRecord(parsed.state) ? parsed.state : parsed;
  const version =
    typeof parsed.version === "number"
      ? parsed.version
      : typeof state.version === "number"
        ? state.version
        : 0;
  if (!Number.isFinite(version) || version > QUEUE_SCHEMA_VERSION) return emptyQueue();

  const rawActions = Array.isArray(state.actions) ? state.actions : [];
  const fallbackTime = Date.now();
  const actions = rawActions
    .map((item) => normalizeAction(item, version, fallbackTime))
    .filter((item): item is QueuedAction => item !== null);

  // Deterministic tie-break for legacy entries without a sequence number.
  actions.sort(compareActions);
  let nextLegacySequence = actions.reduce(
    (max, action) => Math.max(max, action.sequence || 0),
    0,
  );
  const withSequence = actions.map((action) =>
    Number.isFinite(action.sequence) && action.sequence > 0
      ? action
      : { ...action, sequence: ++nextLegacySequence },
  );

  // Never keep two entries with the same id (corrupted storage / old bug).
  const seenIds = new Set<string>();
  const unique = withSequence.filter((action) => {
    if (seenIds.has(action.id)) return false;
    seenIds.add(action.id);
    return true;
  });

  const storedNext = typeof state.nextSequence === "number" ? state.nextSequence : 1;
  return {
    actions: unique,
    nextSequence: Math.max(
      storedNext,
      unique.reduce((max, action) => Math.max(max, action.sequence + 1), 1),
    ),
  };
}
