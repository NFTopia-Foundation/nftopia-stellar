"use client";

import { useCallback } from "react";
import { isBrowserOnline } from "@/lib/offline-queue/connectivity";
import { defaultDispatcher } from "@/lib/offline-queue/dispatcher";
import { classifyReplayError } from "@/lib/offline-queue/errors";
import {
  applyOptimisticAction,
  revertOptimisticAction,
} from "@/lib/offline-queue/optimistic";
import { useOfflineActionQueue } from "@/lib/offline-queue/store";
import {
  NewActionInput,
  OfflineActionType,
  QueuedAction,
} from "@/lib/offline-queue/types";
import { createQueuedAction } from "@/lib/offline-queue/utils";

export interface OfflineWriteResult {
  /** The queued action, when the write could not be sent immediately. */
  queued: QueuedAction | null;
}

/**
 * Common entry point for write buttons. It applies the optimistic UI update,
 * then either sends the write through the real adapter or captures it in the
 * persisted queue for ordered replay after reconnect (#663).
 */
export function useOfflineWrite() {
  const enqueue = useOfflineActionQueue((state) => state.enqueue);
  const markConflict = useOfflineActionQueue((state) => state.markConflict);

  const submit = useCallback(
    async <T extends OfflineActionType>(
      input: NewActionInput<T>,
    ): Promise<OfflineWriteResult> => {
      const action = createQueuedAction(input, 0);
      applyOptimisticAction(action);

      if (!isBrowserOnline()) {
        return { queued: enqueue(input) };
      }

      try {
        await defaultDispatcher(action, {
          force: false,
          idempotencyKey: action.idempotencyKey,
          baseRevision: action.baseRevision,
        });
        return { queued: null };
      } catch (error) {
        const failure = classifyReplayError(error);

        if (failure.kind === "conflict") {
          const queued = enqueue(input);
          if (failure.conflict) markConflict(queued.id, failure.conflict);
          return { queued };
        }

        if (failure.kind === "retryable" || !isBrowserOnline()) {
          // A dropped connection during the request becomes a replayable write.
          return { queued: enqueue(input) };
        }

        revertOptimisticAction(action);
        throw error;
      }
    },
    [enqueue, markConflict],
  );

  return { submit };
}
