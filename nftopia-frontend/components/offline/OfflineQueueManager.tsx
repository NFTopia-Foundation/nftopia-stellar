"use client";

import { useEffect, useMemo } from "react";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { isBrowserOnline } from "@/lib/offline-queue/connectivity";
import { applyServerState } from "@/lib/offline-queue/optimistic";
import {
  selectConflicts,
  selectPendingCount,
  useOfflineActionQueue,
} from "@/lib/offline-queue/store";
import { ConflictResolution, QueuedAction } from "@/lib/offline-queue/types";
import { cn } from "@/lib/utils";

function describeAction(action: QueuedAction): string {
  if (action.type === "favorite") {
    const verb = action.payload.favorited ? "Favorite" : "Unfavorite";
    return `${verb} ${action.payload.label ?? action.payload.itemId}`;
  }
  const verb = action.payload.following ? "Follow" : "Unfollow";
  return `${verb} ${action.payload.label ?? action.payload.creatorId}`;
}

/**
 * Global status surface for the offline write queue. Mounted once in the root
 * layout so the pending count and conflict resolutions are visible on every
 * page, including the offline fallback page (#663).
 */
export function OfflineQueueManager() {
  const actions = useOfflineActionQueue((state) => state.actions);
  const isReplaying = useOfflineActionQueue((state) => state.isReplaying);
  const replay = useOfflineActionQueue((state) => state.replay);
  const resolveConflict = useOfflineActionQueue((state) => state.resolveConflict);

  const pendingCount = useMemo(() => selectPendingCount({ actions }), [actions]);
  const conflicts = useMemo(() => selectConflicts({ actions }), [actions]);

  useEffect(() => {
    const handleOnline = () => {
      void replay();
    };
    window.addEventListener("online", handleOnline);
    // Actions persisted from a previous session resume on mount.
    if (isBrowserOnline()) void replay();
    return () => window.removeEventListener("online", handleOnline);
  }, [replay]);

  const handleResolve = (action: QueuedAction, resolution: ConflictResolution) => {
    if (resolution === "use-server") {
      applyServerState(action, action.conflict?.serverState);
    }
    void resolveConflict(action.id, resolution);
  };

  if (pendingCount === 0 && conflicts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] w-[min(28rem,calc(100vw-2rem))] space-y-2"
      data-testid="offline-queue-manager"
    >
      {pendingCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-3 rounded-xl border border-purple-400/30 bg-gray-900/95 px-4 py-3 text-sm text-white shadow-xl backdrop-blur"
        >
          <CloudOff className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
          <p className="flex-1">
            {isReplaying
              ? "Syncing your saved actions…"
              : `${pendingCount} action${pendingCount === 1 ? "" : "s"} waiting to sync`}
          </p>
          <button
            type="button"
            onClick={() => void replay()}
            disabled={isReplaying}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Sync pending actions now"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isReplaying && "animate-spin")} aria-hidden="true" />
            {isReplaying ? "Syncing" : "Sync now"}
          </button>
        </div>
      )}

      {conflicts.map((action) => (
        <div
          key={action.id}
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-amber-500/40 bg-gray-900/95 p-4 text-sm text-white shadow-xl backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Conflict: {describeAction(action)}</p>
              <p className="mt-1 text-xs text-gray-300">
                {action.conflict?.message ??
                  "This item changed on the server while you were offline."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleResolve(action, "keep-mine")}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500"
                  aria-label={`Keep my change for ${describeAction(action)}`}
                >
                  Keep mine
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve(action, "use-server")}
                  className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-white/10"
                  aria-label={`Use server version for ${describeAction(action)}`}
                >
                  Use server
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve(action, "dismiss")}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white"
                  aria-label={`Dismiss conflict for ${describeAction(action)}`}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default OfflineQueueManager;
