/**
 * Typed model for write actions that are captured while the web client is
 * offline and replayed, in order, once connectivity returns (#663).
 *
 * The model intentionally mirrors the mobile app's offline store (queue +
 * retry count + replay on reconnect) while adding a monotonic `sequence` and
 * an `idempotencyKey` so replay is deterministic and de-duplicated.
 */

export type OfflineActionType = "favorite" | "follow";

export type OfflineActionStatus =
  | "pending"
  | "replaying"
  | "failed"
  | "conflict";

export interface FavoriteActionPayload {
  itemType: "nft" | "collection";
  itemId: string;
  /** Desired state after the action has been replayed. */
  favorited: boolean;
  /** Display-only label used by the conflict UI. */
  label?: string;
  /** Used to revert an optimistic update when an online write fails. */
  previousFavorited?: boolean;
}

export interface FollowActionPayload {
  creatorId: string;
  /** Desired state after the action has been replayed. */
  following: boolean;
  label?: string;
  previousFollowing?: boolean;
  previousFollowerCount?: number;
}

export type OfflineActionPayload = FavoriteActionPayload | FollowActionPayload;

/** Server state returned with a conflict, used by "Use server" resolution. */
export interface ServerState {
  favorited?: boolean;
  following?: boolean;
  followerCount?: number;
  [key: string]: unknown;
}

export interface ActionConflict {
  code: "CONFLICT";
  message: string;
  serverRevision?: string;
  serverState?: ServerState;
  detectedAt: number;
}

interface QueueActionBase<T extends OfflineActionType, P> {
  id: string;
  /** Monotonic, assigned at enqueue time. The primary ordering key. */
  sequence: number;
  type: T;
  payload: P;
  /** Epoch milliseconds. Tie-breaker for restored/legacy actions. */
  createdAt: number;
  status: OfflineActionStatus;
  attempts: number;
  /** Epoch milliseconds before which a failed action must not be retried. */
  nextAttemptAt?: number;
  lastError?: string;
  /** Stable key used to de-duplicate repeated writes. */
  idempotencyKey: string;
  /** Revision the client read before making the change (If-Match). */
  baseRevision?: string;
  /** Set after the user explicitly chose "Keep mine" on a conflict. */
  force?: boolean;
  conflict?: ActionConflict;
}

export type QueuedAction =
  | QueueActionBase<"favorite", FavoriteActionPayload>
  | QueueActionBase<"follow", FollowActionPayload>;

export type NewActionInput<T extends OfflineActionType = OfflineActionType> = {
  type: T;
  payload: Extract<QueuedAction, { type: T }>["payload"];
  baseRevision?: string;
  /** Caller-supplied idempotency key (e.g. a client mutation id). */
  idempotencyKey?: string;
  /** Mainly useful for tests / deterministic restoration. */
  id?: string;
  createdAt?: number;
};

export interface QueueSnapshot {
  actions: QueuedAction[];
  nextSequence: number;
}

export interface ReplayContext {
  /** True only when the user explicitly chose "Keep mine". */
  force: boolean;
  idempotencyKey: string;
  baseRevision?: string;
}

export interface DispatchResult {
  revision?: string;
  serverState?: ServerState;
}

export type ActionDispatcher = (
  action: QueuedAction,
  context: ReplayContext,
) => Promise<DispatchResult>;

export type ConflictResolution = "keep-mine" | "use-server" | "dismiss";

export const MAX_REPLAY_ATTEMPTS = 5;
export const BASE_RETRY_MS = 1_000;
export const MAX_RETRY_MS = 30_000;
