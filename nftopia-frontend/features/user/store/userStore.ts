import type { User } from "@/lib/stores/types";
import { create, StateCreator } from "zustand";
import { devtools, persist, PersistOptions } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// --- Types ---
interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface UserActions {
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export type UserStore = UserState & UserActions;

// --- Logging Middleware ---
const logMiddleware =
  <T extends object>(
    config: StateCreator<T, [], [], T>
  ): StateCreator<T, [], [], T> =>
  (set, get, api) =>
    config(
      (partial, replace) => {
        if (
          typeof process !== "undefined" &&
          typeof (process as any).env !== "undefined" &&
          (process as any).env.NODE_ENV === "development"
        ) {
          console.log("[UserStore action]", partial);
        }
        set(partial, replace as false | undefined);
      },
      get,
      api
    );

// --- Initial State ---
const initialState: UserState = {
  user: null,
  loading: false,
  error: null,
};

// --- Store ---
export const useUserStore = create<UserStore>()(
  devtools(
    persist(
      immer(
        logMiddleware<UserStore>((set, get) => ({
          ...initialState,
          setUser: (user: User | null) =>
            set((state: UserState) => ({ ...state, user })),
          setLoading: (loading: boolean) =>
            set((state: UserState) => ({ ...state, loading })),
          setError: (error: string | null) =>
            set((state: UserState) => ({ ...state, error })),
          clearError: () =>
            set((state: UserState) => ({ ...state, error: null })),
        }))
      ),
      {
        name: "user-store",
        partialize: (state: UserStore) => ({ user: state.user }), // Only persist user
      } as PersistOptions<UserStore>
    ),
    { name: "user-store" }
  )
);

// --- Selectors & Hooks ---
export const useUser = () =>
  useUserStore((state) => ({
    user: state.user,
    loading: state.loading,
    error: state.error,
    setUser: state.setUser,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
  }));

export const useUserProfile = () => useUserStore((state) => state.user);
