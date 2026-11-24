# Offline action queue (web)

Issue #663 adds a small, persisted queue for **write** attempts made while the
web client is offline. It mirrors the mobile app's `stores/offlineStore.ts`
(queue + replay on reconnect) but adds deterministic ordering, idempotency and
explicit conflict resolution.

## Where things live

| File | Responsibility |
| --- | --- |
| `lib/offline-queue/types.ts` | Typed action model (`favorite` / `follow`), statuses, conflict metadata |
| `lib/offline-queue/utils.ts` | Stable fingerprinting, id generation, ordering comparator |
| `lib/offline-queue/dedupe.ts` | Idempotency key and redundant-toggle detection |
| `lib/offline-queue/serializer.ts` | Versioned `localStorage` serialization, safe parse + v0 migration |
| `lib/offline-queue/store.ts` | Zustand store, replay loop, retry/backoff, conflict resolution |
| `lib/offline-queue/errors.ts` | Maps REST/GraphQL/network errors to `conflict` / `retryable` / `fatal` |
| `lib/offline-queue/dispatcher.ts` | Routes an action to its write adapter |
| `lib/offline-queue/adapters/favorites.ts` | Favorite REST adapter (contract below) |
| `lib/offline-queue/adapters/follow.ts` | Reuses the existing GraphQL follow mutations |
| `lib/offline-queue/optimistic.ts` | Applies/reverts optimistic UI state and server state |
| `hooks/useOfflineWrite.ts` | Shared entry point used by write buttons |
| `components/offline/OfflineQueueManager.tsx` | Global aria-live count + per-action conflict UI |
| `app/layout.tsx` | Mounts the global manager once |

## Action model

```ts
{
  id: string;                 // unique client id
  sequence: number;           // monotonic — primary ordering key
  type: 'favorite' | 'follow';
  payload: FavoriteActionPayload | FollowActionPayload;
  createdAt: number;          // epoch ms; tie-breaker for restored data
  status: 'pending' | 'replaying' | 'failed' | 'conflict';
  attempts: number;
  nextAttemptAt?: number;     // exponential backoff deadline
  baseRevision?: string;      // revision read before the offline edit (If-Match)
  idempotencyKey: string;     // de-dupes repeated writes across reloads/retries
  force?: boolean;            // set only after "Keep mine"
  conflict?: ActionConflict;  // message, serverRevision, serverState
}
```

Ordering is `sequence → createdAt → id` (`compareActions`). The store assigns
`sequence` at enqueue time; restored legacy entries without one are re-sequenced
by the serializer.

## Lifecycle

1. `useOfflineWrite().submit()` applies the optimistic UI update immediately.
2. If `navigator.onLine === false`, the action is enqueued (and persisted).
   Otherwise the adapter is called directly; a dropped connection or a 5xx
   error is captured as a replayable action, while a conflict becomes a
   `status: 'conflict'` action that surfaces in the UI.
3. `OfflineQueueManager` listens for `online` and calls `replay()` (also on
   mount, to resume actions from a previous session).
4. `replay()` processes **one action at a time** in sequence order. Successes
   are removed. Retryable failures stay queued with `attempts + 1` and
   `nextAttemptAt = now + min(1s · 2^(n-1), 30s)`. There is a single in-flight
   replay promise, so concurrent `online` events cannot interleave actions.
5. A conflict (409 / revision mismatch) marks that action `conflict` and
   **stops** the loop, leaving later actions pending so causal order is not
   violated. Permanent failures (400/401/403/422) also stop the loop.
6. Conflict UI offers:
   - **Keep mine** — resends with `force: true` (`X-Offline-Force: true`,
     `If-Match` omitted). This is an explicit overwrite by the user.
   - **Use server** — applies `serverState` locally and drops the queued action.
   - **Dismiss** — drops the queued action and leaves local state as-is.

Nothing is ever silently overwritten: replay without an explicit `force` always
stops on a conflict.

## Persistence

State is stored under `localStorage["nftopia-offline-actions"]` as
`{ version: 1, actions, nextSequence }`. `deserializeQueue()` wraps `JSON.parse`
in `try/catch`, validates every action, drops malformed entries, de-duplicates
ids, repairs the next sequence, and understands a legacy v0 shape
(`action` / `timestamp` / `retryCount`). Unknown future versions load as an
empty queue rather than crashing the app. Storage write failures are ignored so
private browsing still works for the current session.

## Favorite endpoint contract

There is currently **no** favorite mutation in `lib/graphql` and no favorite
route in the backend, so favorites are captured through a documented REST
adapter (the only place to change when the API lands):

```
POST /api/favorites/:itemType/:itemId
Authorization: Bearer <token>             # when signed in
Idempotency-Key: <action.idempotencyKey>  # stable across replays
If-Match: <action.baseRevision>           # omitted for "Keep mine"
X-Offline-Force: true                     # only for "Keep mine"

Body: { favorited: boolean, baseRevision?: string, force?: boolean }

200 { success: true, revision?: string, serverState?: { favorited: boolean } }
409 { code: "CONFLICT", message: string, serverRevision?: string,
      serverState?: { favorited: boolean } }
```

Any 4xx other than 409 is fatal (no infinite retry); 429/5xx/network errors are
retried with backoff.

## Follow adapter

Follow/unfollow uses the existing `FOLLOW_CREATOR_MUTATION` and
`UNFOLLOW_CREATOR_MUTATION` via the shared Apollo client
(`lib/graphql/client.ts`). `baseRevision` is forwarded as `If-Match` metadata;
the GraphQL mutation does not accept it as a variable yet. Conflicts are
detected from HTTP 409, `extensions.code === 'CONFLICT'` or a revision-mismatch
message.

## Adding a new action type

1. Add the literal to `OfflineActionType` and a discriminated member to
   `QueuedAction` in `lib/offline-queue/types.ts` (payload + any revision data).
2. Extend `readPayload()` in `serializer.ts` so persisted actions validate.
3. Add a `case` to `defaultDispatcher` in `dispatcher.ts` and write a small
   adapter under `lib/offline-queue/adapters/` returning
   `{ revision?, serverState? }`. Throw `OfflineActionConflictError` for 409s.
4. Extend `applyOptimisticAction` / `revertOptimisticAction` /
   `applyServerState` in `optimistic.ts` if the UI needs local updates.
5. Call `useOfflineWrite().submit({ type, payload })` from the write control.
6. Add unit tests for ordering/replay/conflict and, if the state is rendered
   outside the generic conflict banner, a component test.

## Testing hooks

`configureOfflineQueue({ dispatcher, isOnline, retryDelay, scheduler })` in
`lib/offline-queue/store.ts` lets tests inject a fake transport, force offline
mode, shorten backoff and capture retry scheduling. Call
`resetQueueConfiguration()` and `useOfflineActionQueue.getState().clear()`
between tests.
