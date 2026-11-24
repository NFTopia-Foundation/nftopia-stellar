import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { QueuedAction, ServerState } from "./types";

export const FOLLOW_STATE_EVENT = "nftopia:follow-state";

export interface FollowStateEventDetail {
  creatorId: string;
  following: boolean;
  followerCount?: number;
  source: "optimistic" | "server" | "rollback";
}

function emitFollowState(detail: FollowStateEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FollowStateEventDetail>(FOLLOW_STATE_EVENT, { detail }));
}

function setFavoriteLocally(
  action: Extract<QueuedAction, { type: "favorite" }>,
  favorited: boolean,
): void {
  const store = usePreferencesStore.getState();
  if (action.payload.itemType === "nft") {
    if (favorited) store.addToFavoriteNFTs(action.payload.itemId);
    else store.removeFromFavoriteNFTs(action.payload.itemId);
    return;
  }
  if (favorited) store.addToFavorites(action.payload.itemId);
  else store.removeFromFavorites(action.payload.itemId);
}

/** Applies the user's intent locally before the network is consulted. */
export function applyOptimisticAction(action: QueuedAction): void {
  if (action.type === "favorite") {
    setFavoriteLocally(action, action.payload.favorited);
    return;
  }
  emitFollowState({
    creatorId: action.payload.creatorId,
    following: action.payload.following,
    source: "optimistic",
  });
}

/** Undoes the optimistic update when an online write fails permanently. */
export function revertOptimisticAction(action: QueuedAction): void {
  if (action.type === "favorite") {
    const previous = action.payload.previousFavorited;
    if (typeof previous === "boolean") setFavoriteLocally(action, previous);
    return;
  }
  const previous = action.payload.previousFollowing;
  if (typeof previous === "boolean") {
    emitFollowState({
      creatorId: action.payload.creatorId,
      following: previous,
      ...(typeof action.payload.previousFollowerCount === "number"
        ? { followerCount: action.payload.previousFollowerCount }
        : {}),
      source: "rollback",
    });
  }
}

/** Applies authoritative server state after "Use server" conflict resolution. */
export function applyServerState(
  action: QueuedAction,
  serverState: ServerState | undefined,
): void {
  if (!serverState) return;
  if (action.type === "favorite") {
    if (typeof serverState.favorited === "boolean") {
      setFavoriteLocally(action, serverState.favorited);
    }
    return;
  }
  if (typeof serverState.following === "boolean") {
    emitFollowState({
      creatorId: action.payload.creatorId,
      following: serverState.following,
      ...(typeof serverState.followerCount === "number"
        ? { followerCount: serverState.followerCount }
        : {}),
      source: "server",
    });
  }
}
