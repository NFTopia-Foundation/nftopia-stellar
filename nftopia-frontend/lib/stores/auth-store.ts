import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { AuthStore, User } from './types';
import { API_CONFIG } from '../config';
import { getCookie } from '../CSRFTOKEN';
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { NextRouter } from 'next/router';


const initialState = {
  user: null,
  loading: true,
  isAuthenticated: false,
  error: null,
  accessToken: null,
  refreshTokenValue: null,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // --- Auth Service Methods ---
      register: async (email: string, password: string, username?: string) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/register`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({ email, password, username }),
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Registration failed');
          }
          const result = await res.json();
          const { access_token, refresh_token, user } = result.data.data;
          localStorage.setItem('auth-user', JSON.stringify({ data: user }));
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          set({ user, isAuthenticated: true, loading: false, error: null, accessToken: access_token, refreshTokenValue: refresh_token });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Registration failed', loading: false });
          throw error;
        }
      },

      emailLogin: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Login failed');
          }
          const result = await res.json();
          const { access_token, refresh_token, user } = result.data.data;
          localStorage.setItem('auth-user', JSON.stringify({ data: user }));
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          set({ user, isAuthenticated: true, loading: false, error: null, accessToken: access_token, refreshTokenValue: refresh_token });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Login failed', loading: false });
          throw error;
        }
      },

      getWalletChallenge: async (walletAddress: string, walletProvider?: string) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/wallet-challenge`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({ walletAddress, walletProvider }),
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Failed to get wallet challenge');
          }
          const result = await res.json();
          return result.data.data; // { sessionId, walletAddress, nonce, message, expiresAt }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to get wallet challenge', loading: false });
          throw error;
        }
      },

      verifyWalletSignature: async (walletAddress: string, nonce: string, signature: string, walletProvider?: string) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/verify-wallet-signature`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({ walletAddress, nonce, signature, walletProvider }),
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Wallet signature verification failed');
          }
          const result = await res.json();
          const { access_token, refresh_token, user } = result.data.data;
          localStorage.setItem('auth-user', JSON.stringify({ data: user }));
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          set({ user, isAuthenticated: true, loading: false, error: null, accessToken: access_token, refreshTokenValue: refresh_token });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Wallet signature verification failed', loading: false });
          throw error;
        }
      },
      refreshToken: async () => {
        set({ loading: true, error: null });
        try {
          const refreshToken = localStorage.getItem('refresh_token');
          if (!refreshToken) throw new Error('No refresh token available');
          const res = await fetch(`${API_CONFIG.baseUrl}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });
          if (!res.ok) {
            throw new Error('Failed to refresh token');
          }
          const result = await res.json();
          const { access_token, refresh_token, user } = result.data.data;
          localStorage.setItem('auth-user', JSON.stringify({ data: user }));
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          set({ user, isAuthenticated: true, loading: false, error: null, accessToken: access_token, refreshTokenValue: refresh_token });
          return access_token;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Token refresh failed', loading: false });
          throw error;
        }
      },
      isAccessTokenExpired: () => {
        const token = localStorage.getItem('access_token');
        if (!token) return true;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.exp * 1000 < Date.now();
        } catch {
          return true;
        }
      },

      linkWallet: async (walletAddress: string, nonce: string, signature: string, walletProvider?: string) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/link-wallet`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({ walletAddress, nonce, signature, walletProvider }),
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Failed to link wallet');
          }
          const result = await res.json();
          return result.data.data; // { success: boolean, wallet: UserWallet }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to link wallet', loading: false });
          throw error;
        }
      },

      unlinkWallet: async (walletAddress: string) => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/unlink-wallet`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({ walletAddress }),
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Failed to unlink wallet');
          }
          const result = await res.json();
          return result.data.data; // { success: boolean }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to unlink wallet', loading: false });
          throw error;
        }
      },

      listWallets: async () => {
        set({ loading: true, error: null });
        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/list-wallets`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Failed to list wallets');
          }
          const result = await res.json();
          return result.data.data; // UserWallet[]
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to list wallets', loading: false });
          throw error;
        }
      },

      getCurrentUser: () => {
        try {
          const userStr = typeof window !== 'undefined' ? localStorage.getItem('auth-user') : null;
          if (!userStr) return null;
          const parsed = JSON.parse(userStr);
          return parsed.data as User;
        } catch {
          return null;
        }
      },

      // Basic setters
      setUser: (user: User | null) =>
        set((state) => {
          state.user = user;
          state.isAuthenticated = !!user;
        }),

      setLoading: (loading: boolean) =>
        set((state) => {
          state.loading = loading;
        }),

      setError: (error: string | null) =>
        set((state) => {
          state.error = error;
        }),

      clearError: () =>
        set((state) => {
          state.error = null;
        }),

      // Auth methods
      requestNonce: async (walletAddress: string): Promise<string> => {
        try {
          set((state) => {
            state.error = null;
          });

          const csrfToken = await getCookie();

          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/request-nonce`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({ walletAddress }),
          });

          if (!res.ok) {
            throw new Error('Failed to request nonce');
          }

          const result = await res.json();

          const nonce = result.data.data.nonce;
          console.log(nonce);
          return nonce;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to request nonce';
          set((state) => {
            state.error = errorMessage;
          });
          throw error;
        }
      },
      verifySignature: async (
        walletAddress: string,
        signature: [string, string],
        nonce: string,
        walletType: 'argentx' | 'braavos',
        locale: string
      ) => {
        set({ loading: true });

        try {
          const csrfToken = await getCookie();
          const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/verify-signature`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({
              walletAddress,
              signature,
              nonce,
              walletType,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Verification failed');
          }

          const result = await res.json();

          let user = result.data.data;

          console.log(user);
          localStorage.setItem('auth-user', JSON.stringify({ data: user }));
          set({
            user,
            isAuthenticated: true,
            loading: false,
            error: null,
          });
          window.location.href = `/${locale}/creator-dashboard`;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Verification failed';
          set({ error: message, loading: false });
          throw error;
        }
      },

      logout: async (): Promise<void> => {
        try {
          set((state) => {
            state.loading = true;
            state.error = null;
          });

          // Step 1: Disconnect wallet first (before API call)
          try {
            if (typeof window !== 'undefined' && (window as any).starknet) {
              await (window as any).starknet.disable();
            }
          } catch (walletError) {
            console.warn('Wallet disconnect failed:', walletError);
          }

          // Step 2: Clear localStorage immediately
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
          }

          // Step 3: Call backend logout API with CSRF protection
          const csrfToken = await getCookie();

          const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
          });

          set((state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.accessToken = null;
            state.refreshTokenValue = null;
          });

          if (response.ok) {
            console.log('Logout successful');
          } else {
            console.warn('Logout API failed but local state cleared');
          }

          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Logout failed';
          set((state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = errorMessage;
            state.accessToken = null;
            state.refreshTokenValue = null;
          });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
          }
          console.error('Logout error:', error);
          throw error;
        }
      },
    })),
    {
      name: 'auth-store',
    }
  )
);


export const initializeAuth = async (router?: NextRouter) => {
  const { setUser, setLoading, setError } = useAuthStore.getState();

  try {
    setLoading(true);
    setError(null);

    const csrfToken = await getCookie();
    
    const res = await fetchWithAuth(`${API_CONFIG.baseUrl}/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    });

    const result = await res.json();

  

    if (res.ok) {
      const userData = result.data?.data; // Adjust based on your actual response structure
      setUser(userData);

      let currLocation = window.location.href;

      if (currLocation === "http://localhost:5000/auth/login" && userData) window.location.href = "http://localhost:5000/creator-dashboard";
      
  
    } else {
      setUser(null);
    }
  } catch (error) {
    console.error('Error in auth check:', error);
    setError('Authentication initialization failed');
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
    logout,
    clearError,
  };
}; 


