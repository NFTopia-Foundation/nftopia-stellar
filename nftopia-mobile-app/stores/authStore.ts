import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import type { AuthStore, User } from '@/types/auth';
import * as SecureStore from 'expo-secure-store';

const USER_STORAGE_KEY = 'nftopia_user';

// Initial state
const initialState = {
  user: null,
  loading: false,
  isAuthenticated: false,
  error: null,
  isCheckingAuth: true,
};

// Create the store with persistence and devtools
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // State Management Actions
      setUser: (user: User | null) =>
        set((state) => ({
          ...state,
          user,
          isAuthenticated: !!user,
        })),

      setLoading: (loading: boolean) =>
        set((state) => ({ ...state, loading })),

      setError: (error: string | null) =>
        set((state) => ({ ...state, error })),

      clearError: () => set((state) => ({ ...state, error: null })),

      setIsCheckingAuth: (isChecking: boolean) =>
        set((state) => ({ ...state, isCheckingAuth: isChecking })),

      // Authentication Actions
      initializeAuth: async () => {
        try {
          set({ isCheckingAuth: true, loading: true });
          
          // Check if user exists in secure storage
          const storedUser = await SecureStore.getItemAsync(USER_STORAGE_KEY);
          
          if (storedUser) {
            const user = JSON.parse(storedUser) as User;
            set({
              user,
              isAuthenticated: true,
              isCheckingAuth: false,
              loading: false,
            });
          } else {
            set({ isCheckingAuth: false, loading: false });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to initialize auth',
            isCheckingAuth: false,
            loading: false,
          });
        }
      },

      logout: async () => {
        try {
          set({ loading: true });
          
          // Clear user data from storage
          await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
          
          // Reset state
          set({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null,
          });
        } catch (error) {
          console.error('Logout error:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to logout',
            loading: false,
          });
        }
      },

      // Navigation Actions (to be called by navigator)
      navigateToScreen: (_screen: string) => {
        // This will be handled by React Navigation
        // Placeholder for future navigation logic
      },

      goBack: () => {
        // This will be handled by React Navigation
        // Placeholder for future navigation logic
      },

      resetToScreen: (_screen: string) => {
        // This will be handled by React Navigation
        // Placeholder for future navigation logic
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state: AuthStore) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      storage: {
        getItem: async (name: string) => {
          return await SecureStore.getItemAsync(name);
        },
        setItem: async (name: string, value: string) => {
          await SecureStore.setItemAsync(name, value);
        },
        removeItem: async (name: string) => {
          await SecureStore.deleteItemAsync(name);
        },
      },
    } as unknown as PersistOptions<AuthStore>
  )
);

// Hook for using auth state
export const useAuth = () =>
  useAuthStore((state) => ({
    user: state.user,
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    error: state.error,
    isCheckingAuth: state.isCheckingAuth,
    setUser: state.setUser,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
    initializeAuth: state.initializeAuth,
    logout: state.logout,
  }));
