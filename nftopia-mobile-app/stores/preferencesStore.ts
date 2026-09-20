import { createStore } from '@/src/utils/store.factory';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface PreferencesState {
  theme: ThemeMode;
  language: string;
  currency: string;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  /** When true, all app haptic feedback is suppressed (accessibility preference). */
  reduceHaptics: boolean;
  autoLock: boolean;
  lockTimeout: number; // in minutes
  hideBalances: boolean;
  lastUpdated: string | null;
}

export const VERSION = 1;

const initialState: PreferencesState = {
  theme: 'system',
  language: 'en',
  currency: 'USD',
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  reduceHaptics: false,
  autoLock: true,
  lockTimeout: 5,
  hideBalances: false,
  lastUpdated: null,
};

interface PreferencesStore extends PreferencesState {
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: string) => void;
  setCurrency: (currency: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  setReduceHaptics: (enabled: boolean) => void;
  setAutoLock: (enabled: boolean) => void;
  setLockTimeout: (timeout: number) => void;
  setHideBalances: (hide: boolean) => void;
  resetPreferences: () => void;
  updateLastUpdated: () => void;
}

export const usePreferencesStore = createStore<PreferencesStore>({
  name: 'preferences-store',
  initialState: {
    ...initialState,
  } as PreferencesStore,
  actions: (set, get) => ({
    ...initialState,

    setTheme: (theme: ThemeMode) => {
      set({ theme, lastUpdated: new Date().toISOString() });
    },

    setLanguage: (language: string) => {
      set({ language, lastUpdated: new Date().toISOString() });
    },

    setCurrency: (currency: string) => {
      set({ currency, lastUpdated: new Date().toISOString() });
    },

    setNotificationsEnabled: (enabled: boolean) => {
      set({ notificationsEnabled: enabled, lastUpdated: new Date().toISOString() });
    },

    setSoundEnabled: (enabled: boolean) => {
      set({ soundEnabled: enabled, lastUpdated: new Date().toISOString() });
    },

    setVibrationEnabled: (enabled: boolean) => {
      set({ vibrationEnabled: enabled, lastUpdated: new Date().toISOString() });
    },

    setReduceHaptics: (enabled: boolean) => {
      set({ reduceHaptics: enabled, lastUpdated: new Date().toISOString() });
    },

    setAutoLock: (enabled: boolean) => {
      set({ autoLock: enabled, lastUpdated: new Date().toISOString() });
    },

    setLockTimeout: (timeout: number) => {
      set({ lockTimeout: timeout, lastUpdated: new Date().toISOString() });
    },

    setHideBalances: (hide: boolean) => {
      set({ hideBalances: hide, lastUpdated: new Date().toISOString() });
    },

    resetPreferences: () => {
      set({ ...initialState, lastUpdated: new Date().toISOString() });
    },

    updateLastUpdated: () => {
      set({ lastUpdated: new Date().toISOString() });
    },
  }),
  persist: {
    enabled: true,
    name: 'preferences-storage',
    version: VERSION,
    partialize: (state: PreferencesStore) => ({
      theme: state.theme,
      language: state.language,
      currency: state.currency,
      notificationsEnabled: state.notificationsEnabled,
      soundEnabled: state.soundEnabled,
      vibrationEnabled: state.vibrationEnabled,
      reduceHaptics: state.reduceHaptics,
      autoLock: state.autoLock,
      lockTimeout: state.lockTimeout,
      hideBalances: state.hideBalances,
    }),
    storage: 'async',
  },
  devtools: {
    enabled: __DEV__,
    name: 'PreferencesStore',
  },
});