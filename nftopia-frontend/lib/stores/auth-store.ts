import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { AuthStore, User } from "./types";
import { API_CONFIG } from "../config";
import { getCookie } from "../CSRFTOKEN";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { AppApiError, normalizeApiError } from "@/utils/fetchUtils";
import { NextRouter } from "next/router";
import { buildLocalizedRoute } from "../routing";

const initialState = {
  user: null,
  loading: true,
  isAuthenticated: false,
  error: null as AppApiError | null, // Upgraded state type schema from your branch
  accessToken: null,
  refreshTokenValue: null,
};

export const useAuthStore = create<any>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // --- Auth Service Methods ---
      register: async (email: string, password: string, username?: string) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/auth/register`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
              body: JSON.stringify({ email, password, username }),
            },
          );

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Registration failed");
          }

          const { access_token, refresh_token, user } = result.data.data;
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("auth-user");
            sessionStorage.removeItem("access_token");
            sessionStorage.removeItem("refresh_token");
            localStorage.setItem("auth-user", JSON.stringify({ data: user }));
            localStorage.setItem("access_token", access_token);
            localStorage.setItem("refresh_token", refresh_token);
          }
          set({
            user,
            isAuthenticated: true,
            loading: false,
            error: null,
            accessToken: access_token,
            refreshTokenValue: refresh_token,
          });
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set({ error: normalized, loading: false });
          throw normalized;
        }
      },

      emailLogin: async (email: string, password: string, rememberMe = false) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/email/login`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({ email, password }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Login failed");
          }

          const result = await res.json();
          const { access_token, refresh_token, user } = result.data.data;
          
          if (typeof window !== "undefined") {
            const storage = rememberMe ? localStorage : sessionStorage;
            const otherStorage = rememberMe ? sessionStorage : localStorage;
            otherStorage.removeItem("auth-user");
            otherStorage.removeItem("access_token");
            otherStorage.removeItem("refresh_token");

            storage.setItem("auth-user", JSON.stringify({ data: user }));
            storage.setItem("access_token", access_token);
            storage.setItem("refresh_token", refresh_token);
          }
          
          set({
            user,
            isAuthenticated: true,
            loading: false,
            error: null,
            accessToken: access_token,
            refreshTokenValue: refresh_token,
          });
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set({ error: normalized, loading: false });
          throw normalized;
        }
      },

      getWalletChallenge: async (
        walletAddress: string,
        walletProvider?: string,
      ) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/auth/wallet-challenge`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
              body: JSON.stringify({ walletAddress, walletProvider }),
            },
          );
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(
              errorData.message || "Failed to get wallet challenge",
            );
          }
          const result = await res.json();
          return result.data.data; // { sessionId, walletAddress, nonce, message, expiresAt }
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set({ error: normalized, loading: false });
          throw normalized;
        }
      },

      verifyWalletSignature: async (
        walletAddress: string,
        nonce: string,
        signature: string,
        walletProvider?: string,
      ) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/auth/verify-wallet-signature`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
              body: JSON.stringify({
                walletAddress,
                nonce,
                signature,
                walletProvider,
              }),
            },
          );
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(
              errorData.message || "Wallet signature verification failed",
            );
          }
          const { access_token, refresh_token, user } = result.data.data;
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("auth-user");
            sessionStorage.removeItem("access_token");
            sessionStorage.removeItem("refresh_token");
            localStorage.setItem("auth-user", JSON.stringify({ data: user }));
            localStorage.setItem("access_token", access_token);
            localStorage.setItem("refresh_token", refresh_token);
          }
          set({
            user,
            isAuthenticated: true,
            loading: false,
            error: null,
            accessToken: access_token,
            refreshTokenValue: refresh_token,
          });
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set({ error: normalized, loading: false });
          throw normalized;
        }
      },

      refreshToken: async () => {
        set({ loading: true, error: null });
        try {
          const refreshToken = typeof window !== "undefined"
            ? (localStorage.getItem("refresh_token") || sessionStorage.getItem("refresh_token"))
            : null;
          if (!refreshToken) throw new Error("No refresh token available");
          const res = await fetch(`${API_CONFIG.baseUrl}/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken }),
          });
          if (!res.ok) {
            throw new Error("Failed to refresh token");
          }
          const result = await res.json();
          const { access_token, refresh_token, user } = result.data.data;
          if (typeof window !== "undefined") {
            const storage = localStorage.getItem("refresh_token") ? localStorage : sessionStorage;
            const otherStorage = localStorage.getItem("refresh_token") ? sessionStorage : localStorage;
            otherStorage.removeItem("auth-user");
            otherStorage.removeItem("access_token");
            otherStorage.removeItem("refresh_token");

            storage.setItem("auth-user", JSON.stringify({ data: user }));
            storage.setItem("access_token", access_token);
            storage.setItem("refresh_token", refresh_token);
          }
          set({
            user,
            isAuthenticated: true,
            loading: false,
            error: null,
            accessToken: access_token,
            refreshTokenValue: refresh_token,
          });
          return access_token;
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set({ error: normalized, loading: false });
          throw normalized;
        }
      },

      isAccessTokenExpired: () => {
        if (typeof window === "undefined") return true;
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        if (!token) return true;
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          return payload.exp * 1000 < Date.now();
        } catch {
          return true;
        }
      },

      linkWallet: async (
        walletAddress: string,
        nonce: string,
        signature: string,
        walletProvider?: string,
      ) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/auth/link-wallet`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
              body: JSON.stringify({
                walletAddress,
                nonce,
                signature,
                walletProvider,
              }),
            },
          );
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to link wallet");
          }
          const result = await res.json();
          return result.data.data; // { success: boolean, wallet: UserWallet }
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set({ error: normalized, loading: false });
          throw normalized;
        }
      },

      unlinkWallet: async (walletAddress: string) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/auth/unlink-wallet`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
              body: JSON.stringify({ walletAddress }),
            },
          );
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to unlink wallet");
          }
          const result = await res.json();
          return result.data.data; // { success: boolean }
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set({ error: normalized, loading: false });
          throw normalized;
        }
      },

      listWallets: async () => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/auth/list-wallets`,
            {
              method: "GET",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
            },
          );
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to list wallets");
          }
          const result = await res.json();
          return result.data.data; // UserWallet[]
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set({ error: normalized, loading: false });
          throw normalized;
        }
      },

      getCurrentUser: () => {
        try {
          const userStr =
            typeof window !== "undefined"
              ? (localStorage.getItem("auth-user") || sessionStorage.getItem("auth-user"))
              : null;
          if (!userStr) return null;
          const parsed = JSON.parse(userStr);
          return parsed.data as User;
        } catch {
          return null;
        }
      },

      setUser: (user: User | null) =>
        set((state: any) => {
          state.user = user;
          state.isAuthenticated = !!user;
        }),

      setLoading: (loading: boolean) =>
        set((state: any) => {
          state.loading = loading;
        }),

      setError: (error: AppApiError | null) =>
        set((state: any) => {
          state.error = error;
        }),

      clearError: () =>
        set((state: any) => {
          state.error = null;
        }),

      requestNonce: async (walletAddress: string): Promise<string> => {
        try {
          set((state: any) => {
            state.error = null;
          });
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/auth/request-nonce`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
              body: JSON.stringify({ walletAddress }),
            },
          );

          if (!res.ok) {
            throw new Error("Failed to request nonce");
          }

          const result = await res.json();
          return result.data.data.nonce;
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set((state: any) => {
            state.error = normalized;
          });
          throw normalized;
        }
      },

      verifySignature: async (
        walletAddress: string,
        signature: string,
        nonce: string,
        walletProvider: 'freighter' | 'albedo' | 'walletconnect',
        locale: string,
      ) => {
        set({ loading: true });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/auth/verify-signature`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
              body: JSON.stringify({
                walletAddress,
                signature,
                nonce,
                walletProvider,
              }),
            },
          );

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Verification failed");
          }

          let user = result.data.data;
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("auth-user");
            localStorage.setItem("auth-user", JSON.stringify({ data: user }));
          }
          set({ user, isAuthenticated: true, loading: false, error: null });
          window.location.href = `/${locale}/creator-dashboard`;
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set({ error: normalized, loading: false });
          throw normalized;
        }
      },

      logout: async (): Promise<void> => {
        try {
          set((state: any) => {
            state.loading = true;
            state.error = null;
          });

          if (typeof window !== "undefined") {
            localStorage.removeItem("auth-user");
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            sessionStorage.removeItem("auth-user");
            sessionStorage.removeItem("access_token");
            sessionStorage.removeItem("refresh_token");
          }

          const csrfToken = await getCookie();
          const response = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/auth/logout`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
            },
            false, // Prevent recursive loops on forced logouts
          );

          set((state: any) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.accessToken = null;
            state.refreshTokenValue = null;
          });

          if (typeof window !== "undefined") {
            const getCookieValue = (name: string) => {
              const value = `; ${document.cookie}`;
              const parts = value.split(`; ${name}=`);
              if (parts.length === 2) return parts.pop()?.split(";").shift();
              return null;
            };
            const locale = getCookieValue("NEXT_LOCALE") || "en";
            window.location.href = buildLocalizedRoute(locale, "/auth/login");
          }
        } catch (error) {
          const normalized = await normalizeApiError(error);
          set((state: any) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = normalized;
            state.accessToken = null;
            state.refreshTokenValue = null;
          });
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth-user");
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            sessionStorage.removeItem("auth-user");
            sessionStorage.removeItem("access_token");
            sessionStorage.removeItem("refresh_token");
            const getCookieValue = (name: string) => {
              const value = `; ${document.cookie}`;
              const parts = value.split(`; ${name}=`);
              if (parts.length === 2) return parts.pop()?.split(";").shift();
              return null;
            };
            const locale = getCookieValue("NEXT_LOCALE") || "en";
            window.location.href = buildLocalizedRoute(locale, "/auth/login");
          }
          throw normalized;
        }
      },
    })),
  ),
);

export const initializeAuth = async (router?: NextRouter) => {
  const { setUser, setLoading, setError } = useAuthStore.getState();
  try {
    setLoading(true);
    setError(null);
    const csrfToken = await getCookie();
    const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/me`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
    });

    const result = await res.json();
    if (res.ok) {
      const userData = result.data?.data;
      setUser(userData);
      let currLocation = window.location.href;
      if (currLocation.includes("/auth/login") && userData) {
        const getCookieValue = (name: string) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(";").shift();
          return null;
        };
        const locale = getCookieValue("NEXT_LOCALE") || "en";
        window.location.href = buildLocalizedRoute(locale, "/creator-dashboard");
      }
    } else {
      setUser(null);
    }
  } catch (error) {
    const normalized = await normalizeApiError(error);
    setError(normalized);
    setUser(null);
  } finally {
    setLoading(false);
  }
};

// Hook for easier auth state access
export const useAuth = () => {
  const {
    user,
    loading,
    isAuthenticated,
    error,
    requestNonce,
    verifySignature,
    emailLogin,
    logout,
    clearError,
  } = useAuthStore();

  return {
    user,
    loading,
    isAuthenticated,
    error,
    requestNonce,
    verifySignature,
    emailLogin,
    logout,
    clearError,
  };
};
