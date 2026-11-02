import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OfflineActionType = "favorite" | "unfavorite" | "follow" | "unfollow";

export interface OfflineQueueItem {
  id: string;
  action: OfflineActionType;
  payload: Record<string, unknown>;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

interface OfflineQueueState {
  isOnline: boolean;
  queue: OfflineQueueItem[];
  setOnlineStatus: (online: boolean) => void;
  enqueue: (action: OfflineActionType, payload: Record<string, unknown>) => void;
  dequeue: (id: string) => void;
  clear: () => void;
  pendingCount: () => number;
  processQueue: (executor: (item: OfflineQueueItem) => Promise<void>) => Promise<void>;
}

let processing: Promise<void> | null = null;

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      isOnline: true,
      queue: [],

      setOnlineStatus: (online) => {
        set({ isOnline: online });
        if (online && get().queue.length > 0) {
          // Caller supplies executor via processQueue; here we just mark online.
        }
      },

      enqueue: (action, payload) => {
        const item: OfflineQueueItem = {
          id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          action,
          payload,
          timestamp: new Date().toISOString(),
          retryCount: 0,
          maxRetries: 3,
        };
        set((state) => ({ queue: [...state.queue, item] }));
      },

      dequeue: (id) =>
        set((state) => ({ queue: state.queue.filter((q) => q.id !== id) })),

      clear: () => set({ queue: [] }),

      pendingCount: () => get().queue.length,

      processQueue: async (executor) => {
        if (processing) return processing;
        if (!get().isOnline || get().queue.length === 0) return;

        processing = (async () => {
          // Snapshot ids to process in insertion order.
          const ids = get().queue.map((q) => q.id);
          for (const id of ids) {
            if (!get().isOnline) break;
            const item = get().queue.find((q) => q.id === id);
            if (!item) continue;

            try {
              await executor(item);
              get().dequeue(item.id);
            } catch {
              const current = get().queue.find((q) => q.id === item.id);
              if (!current) continue;
              if (current.retryCount < current.maxRetries) {
                set((state) => ({
                  queue: state.queue.map((q) =>
                    q.id === item.id ? { ...q, retryCount: q.retryCount + 1 } : q,
                  ),
                }));
              } else {
                // Conflict / exhausted retries: drop to avoid blocking the queue.
                get().dequeue(item.id);
              }
            }
          }
        })().finally(() => {
          processing = null;
        });

        return processing;
      },
    }),
    {
      name: "nftopia-offline-queue",
      partialize: (state) => ({ queue: state.queue }),
    },
  ),
);

/** Convenience hook: returns pending count for UI indicators. */
export function useOfflinePendingCount(): number {
  return useOfflineQueueStore((s) => s.queue.length);
}