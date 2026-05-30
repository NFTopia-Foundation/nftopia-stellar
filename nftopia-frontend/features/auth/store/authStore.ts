import type { AuthStore, User } from "@/lib/stores/types";
import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist, PersistOptions } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

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
          console.log("[AuthStore action]", partial);
        }
        set(partial, replace as false | undefined);
      },
      get,
      api
    );

const initialState = {
  user: null,
  loading: false,
  isAuthenticated: false,
  error: null,
  accessToken: null,
  refreshTokenValue: null,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      immer(
        logMiddleware<AuthStore>((set, get) => ({
          ...initialState,
          setUser: (user: User | null) =>
            set((state) => ({ ...state, user, isAuthenticated: !!user })),
          setLoading: (loading: boolean) =>
            set((state) => ({ ...state, loading })),
          setError: (error: string | null) =>
            set((state) => ({ ...state, error })),
          clearError: () => set((state) => ({ ...state, error: null })),
          requestNonce: async (_walletAddress: string) => {
            throw new Error("Not implemented");
          },
          verifySignature: async (
            _walletAddress: string,
            _signature: [string, string],
            _nonce: string,
            _walletType: "argentx" | "braavos"
          ) => {
            throw new Error("Not implemented");
          },
          register: async (_email: string, _password: string, _username?: string) => {
            throw new Error("Not implemented");
          },
          emailLogin: async (_email: string, _password: string) => {
            throw new Error("Not implemented");
          },
          getWalletChallenge: async (_walletAddress: string, _walletProvider?: string) => {
            throw new Error("Not implemented");
          },
          verifyWalletSignature: async (_walletAddress: string, _nonce: string, _signature: string, _walletProvider?: string) => {
            throw new Error("Not implemented");
          },
          linkWallet: async (_walletAddress: string, _nonce: string, _signature: string, _walletProvider?: string) => {
            throw new Error("Not implemented");
          },
          unlinkWallet: async (_walletAddress: string) => {
            throw new Error("Not implemented");
          },
          listWallets: async () => {
            throw new Error("Not implemented");
          },
          isAccessTokenExpired: () => true,
          getCurrentUser: () => null,
          logout: async () => {
            throw new Error("Not implemented");
          },
          refreshToken: async () => {
            throw new Error("Not implemented");
          },
        }))
      ),
      {
        name: "auth-store",
        partialize: (state: AuthStore) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          accessToken: state.accessToken,
          refreshTokenValue: state.refreshTokenValue,
        }),
      } as PersistOptions<AuthStore>
    ),
    { name: "auth-store" }
  )
);

export const useAuth = () =>
  useAuthStore((state) => ({
    user: state.user,
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    error: state.error,
    setUser: state.setUser,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
  }));
