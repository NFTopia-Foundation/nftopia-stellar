import { create } from "zustand";
import { isBrowserOnline } from "./connectivity";
import { findExistingAction } from "./dedupe";
import { defaultDispatcher } from "./dispatcher";
import { classifyReplayError } from "./errors";
import {
  deserializeQueue,
  QUEUE_STORAGE_KEY,
  serializeQueue,
} from "./serializer";
import {
  ActionConflict,
  ActionDispatcher,
  BASE_RETRY_MS,
  ConflictResolution,
  MAX_REPLAY_ATTEMPTS,
  MAX_RETRY_MS,
  NewActionInput,
  OfflineActionType,
  QueuedAction,
  QueueSnapshot,
} from "./types";
import { compareActions, createQueuedAction } from "./utils";

export interface OfflineQueueState extends QueueSnapshot {
  isReplaying: boolean;
  lastReplayAt: number | null;
  enqueue: <T extends OfflineActionType>(input: NewActionInput<T>) => QueuedAction;
  removeAction: (id: string) => void;
  clear: () => void;
  replay: () => Promise<void>;
  markConflict: (id: string, conflict: ActionConflict) => void;
  resolveConflict: (id: string, resolution: ConflictResolution) => Promise<void>;
  retryAction: (id: string) => Promise<void>;
}

interface QueueConfiguration {
  dispatcher: ActionDispatcher;
  isOnline: () => boolean;
  retryDelay: (attempts: number, action: QueuedAction) => number;
  scheduler: (delay: number, run: () => void) => void;
}

const defaultConfiguration: QueueConfiguration = {
  dispatcher: defaultDispatcher,
  isOnline: isBrowserOnline,
  retryDelay: (attempts) =>
    Math.min(BASE_RETRY_MS * 2 ** Math.max(0, attempts - 1), MAX_RETRY_MS),
  scheduler: (delay, run) => {
    if (typeof window === "undefined") return;
    replayTimer = window.setTimeout(run, Math.max(0, delay));
  },
};

let configuration: QueueConfiguration = { ...defaultConfiguration };
let replayTimer: number | null = null;
let replayPromise: Promise<void> | null = null;

function clearScheduledReplay(): void {
  if (replayTimer !== null) {
    clearTimeout(replayTimer);
    replayTimer = null;
  }
}

/** Dependency injection point for tests / alternate transports. */
export function configureOfflineQueue(options: Partial<QueueConfiguration>): void {
  configuration = { ...configuration, ...options };
  clearScheduledReplay();
}

export function resetQueueConfiguration(): void {
  configuration = { ...defaultConfiguration };
  clearScheduledReplay();
}

function emptyQueue(): QueueSnapshot {
  return { actions: [], nextSequence: 1 };
}

function readQueue(): QueueSnapshot {
  if (typeof window === "undefined") return emptyQueue();
  try {
    return deserializeQueue(window.localStorage.getItem(QUEUE_STORAGE_KEY));
  } catch {
    return emptyQueue();
  }
}

function persistQueue(state: OfflineQueueState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      QUEUE_STORAGE_KEY,
      serializeQueue({ actions: state.actions, nextSequence: state.nextSequence }),
    );
  } catch {
    // Storage can be disabled (private mode / quota). The in-memory queue
    // still works for the current session.
  }
}

/** Re-read persisted state (used on app start and in tests). */
export function rehydrateQueue(): void {
  const restored = readQueue();
  clearScheduledReplay();
  useOfflineActionQueue.setState({
    ...restored,
    isReplaying: false,
    lastReplayAt: null,
  });
}

type SetState = (
  partial:
    | Partial<OfflineQueueState>
    | ((state: OfflineQueueState) => Partial<OfflineQueueState>),
) => void;

function patchAction(set: SetState, id: string, patch: Partial<QueuedAction>): void {
  set((state) => ({
    actions: state.actions.map((action) =>
      action.id === id ? ({ ...action, ...patch } as QueuedAction) : action,
    ),
  }));
}

function removeActionById(set: SetState, id: string): void {
  set((state) => ({ actions: state.actions.filter((action) => action.id !== id) }));
}

function scheduleNextReplay(get: () => OfflineQueueState): void {
  clearScheduledReplay();
  if (!configuration.isOnline()) return;
  const pending = get().actions.filter((action) => action.status === "pending");
  if (pending.length === 0) return;
  const now = Date.now();
  const nextAt = Math.min(
    ...pending.map((action) => Math.max(0, action.nextAttemptAt ?? 0) - now),
  );
  configuration.scheduler(nextAt, () => {
    replayTimer = null;
    void get().replay();
  });
}

/** Single-consumer replay loop: one action at a time, in sequence order. */
async function runReplay(
  get: () => OfflineQueueState,
  set: SetState,
): Promise<void> {
  set({ isReplaying: true });
  try {
    // Stop on conflict (or permanent failure) so causal order is preserved.
    for (;;) {
      if (!configuration.isOnline()) break;
      const now = Date.now();
      const next = get()
        .actions.filter(
          (action) =>
            action.status === "pending" && (action.nextAttemptAt ?? 0) <= now,
        )
        .sort(compareActions)[0];
      if (!next) break;

      patchAction(set, next.id, { status: "replaying" });
      try {
        await configuration.dispatcher(next, {
          force: Boolean(next.force),
          idempotencyKey: next.idempotencyKey,
          baseRevision: next.baseRevision,
        });
        removeActionById(set, next.id);
        set({ lastReplayAt: Date.now() });
      } catch (error) {
        const failure = classifyReplayError(error);
        if (failure.kind === "conflict" && failure.conflict) {
          patchAction(set, next.id, {
            status: "conflict",
            force: false,
            conflict: failure.conflict,
            lastError: failure.message,
          });
          break;
        }

        const attempts = next.attempts + 1;
        if (failure.kind === "fatal" || attempts >= MAX_REPLAY_ATTEMPTS) {
          patchAction(set, next.id, {
            status: "failed",
            attempts,
            lastError: failure.message,
            nextAttemptAt: undefined,
          });
          break;
        }

        const delay = configuration.retryDelay(attempts, next);
        patchAction(set, next.id, {
          status: "pending",
          attempts,
          lastError: failure.message,
          nextAttemptAt: Date.now() + delay,
        });
        break;
      }
    }
  } finally {
    set({ isReplaying: false });
    scheduleNextReplay(get);
  }
}

export const useOfflineActionQueue = create<OfflineQueueState>()((set, get) => ({
  ...readQueue(),
  isReplaying: false,
  lastReplayAt: null,

  enqueue: (input) => {
    let result: QueuedAction | undefined;
    set((state) => {
      const existing = findExistingAction(state.actions, input);
      if (existing) {
        result = existing;
        return state;
      }
      const action = createQueuedAction(input, state.nextSequence);
      result = action;
      return {
        actions: [...state.actions, action].sort(compareActions),
        nextSequence: state.nextSequence + 1,
      };
    });
    return result as QueuedAction;
  },

  removeAction: (id) => removeActionById(set, id),

  clear: () => {
    clearScheduledReplay();
    set({ actions: [], nextSequence: 1, isReplaying: false, lastReplayAt: null });
  },

  replay: () => {
    if (replayPromise) return replayPromise;
    replayPromise = runReplay(get, set).finally(() => {
      replayPromise = null;
    });
    return replayPromise;
  },

  markConflict: (id, conflict) =>
    patchAction(set, id, { status: "conflict", conflict, force: false }),

  resolveConflict: async (id, resolution) => {
    const action = get().actions.find((item) => item.id === id);
    if (!action || action.status !== "conflict") return;

    if (resolution === "keep-mine") {
      patchAction(set, id, {
        status: "pending",
        force: true,
        attempts: 0,
        nextAttemptAt: 0,
        conflict: undefined,
        lastError: undefined,
      });
    } else {
      // `use-server` applies the server state in the UI layer before calling
      // this; `dismiss` intentionally leaves the optimistic local state alone.
      removeActionById(set, id);
    }
    await get().replay();
  },

  retryAction: async (id) => {
    patchAction(set, id, {
      status: "pending",
      attempts: 0,
      nextAttemptAt: 0,
      lastError: undefined,
    });
    await get().replay();
  },
}));

if (typeof window !== "undefined") {
  useOfflineActionQueue.subscribe(persistQueue);
}

type QueueSelectorState = Pick<OfflineQueueState, "actions">;

export const selectPendingActions = (state: QueueSelectorState): QueuedAction[] =>
  state.actions.filter(
    (action) => action.status === "pending" || action.status === "replaying",
  );

export const selectPendingCount = (state: QueueSelectorState): number =>
  selectPendingActions(state).length;

export const selectConflicts = (state: QueueSelectorState): QueuedAction[] =>
  state.actions.filter((action) => action.status === "conflict");
