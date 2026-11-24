import {
  NewActionInput,
  OfflineActionType,
  QueuedAction,
} from "./types";
import { desiredState, idempotencyKeyFor, targetKey } from "./utils";

/**
 * An action is considered a duplicate when it has the same idempotency key and
 * is still actionable. Conflicts are deliberately excluded: a conflict must
 * stay visible until the user resolves it.
 */
export function findDuplicate<T extends OfflineActionType>(
  actions: QueuedAction[],
  input: NewActionInput<T>,
): QueuedAction | undefined {
  const key = idempotencyKeyFor(input);
  return actions.find(
    (action) =>
      action.idempotencyKey === key &&
      (action.status === "pending" || action.status === "replaying"),
  );
}

/**
 * Two offline toggles that resolve to the same state on the same entity are
 * redundant. Reuse the earlier pending action (keeping its sequence) so the
 * queue remains small without losing ordering relative to other entities.
 */
export function findRedundantToggle<T extends OfflineActionType>(
  actions: QueuedAction[],
  input: NewActionInput<T>,
): QueuedAction | undefined {
  const key = targetKey(input.type, input.payload);
  const wanted = desiredState({ type: input.type, payload: input.payload });
  return [...actions]
    .reverse()
    .find(
      (action) =>
        action.status === "pending" &&
        targetKey(action.type, action.payload) === key &&
        desiredState(action) === wanted,
    );
}

/** Single entry point used by the store's `enqueue`. */
export function findExistingAction<T extends OfflineActionType>(
  actions: QueuedAction[],
  input: NewActionInput<T>,
): QueuedAction | undefined {
  return (
    findDuplicate(actions, input) ??
    (input.idempotencyKey ? undefined : findRedundantToggle(actions, input))
  );
}
