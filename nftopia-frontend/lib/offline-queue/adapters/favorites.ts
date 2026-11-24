import { OfflineActionConflictError } from "../errors";
import {
  DispatchResult,
  FavoriteActionPayload,
  ReplayContext,
} from "../types";

/**
 * Favorites are currently local-only in the web app: there is no GraphQL
 * favorite mutation in `lib/graphql` and no REST favorite route in the
 * backend schema. This adapter is the single place to change once that API
 * exists.
 *
 * Endpoint contract (documented in docs/offline-action-queue.md):
 *
 *   POST /api/favorites/:itemType/:itemId
 *   Authorization: Bearer <token>            (when signed in)
 *   Idempotency-Key: <queue idempotencyKey>  (replays reuse this value)
 *   If-Match: <baseRevision>                 (omitted for "Keep mine")
 *   X-Offline-Force: true                    (only for "Keep mine")
 *
 *   Body: { favorited: boolean, baseRevision?: string, force?: boolean }
 *   200: { success: true, revision?: string, serverState?: { favorited: boolean } }
 *   409: { code: "CONFLICT", message: string, serverRevision?: string,
 *          serverState?: { favorited: boolean } }
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem("access_token") ||
      window.localStorage.getItem("auth-token") ||
      window.sessionStorage.getItem("access_token")
    );
  } catch {
    return null;
  }
}

export async function dispatchFavorite(
  payload: FavoriteActionPayload,
  context: ReplayContext,
): Promise<DispatchResult> {
  if (typeof fetch === "undefined") {
    throw new Error("Fetch is unavailable; favorite action cannot be replayed.");
  }

  const url = `/api/favorites/${encodeURIComponent(payload.itemType)}/${encodeURIComponent(
    payload.itemId,
  )}`;
  const headers = new Headers({
    "Content-Type": "application/json",
    "Idempotency-Key": context.idempotencyKey,
  });
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!context.force && context.baseRevision) {
    headers.set("If-Match", context.baseRevision);
  }
  if (context.force) headers.set("X-Offline-Force", "true");

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      favorited: payload.favorited,
      ...(!context.force && context.baseRevision
        ? { baseRevision: context.baseRevision }
        : {}),
      force: context.force,
    }),
  });

  const body: unknown = await response.json().catch(() => ({}));
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const message =
    typeof data.message === "string"
      ? data.message
      : "This favorite changed on the server while you were offline.";

  if (response.status === 409) {
    throw new OfflineActionConflictError(message, {
      serverRevision:
        typeof data.serverRevision === "string"
          ? data.serverRevision
          : response.headers.get("etag") ?? undefined,
      serverState:
        data.serverState && typeof data.serverState === "object"
          ? (data.serverState as DispatchResult["serverState"])
          : undefined,
    });
  }

  if (!response.ok) {
    const error = new Error(
      typeof data.message === "string" ? data.message : `HTTP ${response.status}`,
    ) as Error & { status?: number; code?: string };
    error.status = response.status;
    if (typeof data.code === "string") error.code = data.code;
    throw error;
  }

  return {
    revision:
      typeof data.revision === "string"
        ? data.revision
        : response.headers.get("etag") ?? undefined,
    serverState:
      data.serverState && typeof data.serverState === "object"
        ? (data.serverState as DispatchResult["serverState"])
        : { favorited: payload.favorited },
  };
}
