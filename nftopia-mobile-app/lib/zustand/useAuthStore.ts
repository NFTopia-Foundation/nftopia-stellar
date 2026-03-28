import { create } from 'zustand';
import { AuthUser } from '../api/AuthService';

// Temp AuthStore until Issue `#115` is merged
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setAuth: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setAuth: (accessToken, refreshToken, user) =>
    set({ accessToken, refreshToken, user }),
  logout: () => set({ accessToken: null, refreshToken: null, user: null }),
}));
