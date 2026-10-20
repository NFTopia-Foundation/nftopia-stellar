import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { useLanguageStore } from '@/src/stores/languageStore';
import { getPersistenceSize, clearAllPersistedData } from './store.factory';

export interface PersistenceStatus {
  stores: {
    auth: boolean;
    notifications: boolean;
    preferences: boolean;
    favorites: boolean;
    offline: boolean;
    language: boolean;
  };
  totalSize: number;
  storeSizes: Record<string, number>;
}

class PersistenceManager {
  private static instance: PersistenceManager;
  private initialized = false;

  private constructor() {}

  static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager();
    }
    return PersistenceManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Rehydrate all stores
      await this.rehydrateAllStores();
      this.initialized = true;
      console.log('[Persistence] Initialized successfully');
    } catch (error) {
      console.error('[Persistence] Initialization failed:', error);
    }
  }

  private async rehydrateAllStores(): Promise<void> {
    // Each store will rehydrate automatically via persist middleware
    // We just need to ensure they're initialized
    try {
      // Access stores to trigger rehydration
      useAuthStore.getState();
      useNotificationStore.getState();
      usePreferencesStore.getState();
      useFavoritesStore.getState();
      useOfflineStore.getState();
      useLanguageStore.getState();

      console.log('[Persistence] All stores rehydrated');
    } catch (error) {
      console.error('[Persistence] Failed to rehydrate stores:', error);
    }
  }

  async getStatus(): Promise<PersistenceStatus> {
    const { total, stores } = await getPersistenceSize();

    return {
      stores: {
        auth: await this.isStoreInitialized('auth-storage'),
        notifications: await this.isStoreInitialized('notification-storage'),
        preferences: await this.isStoreInitialized('preferences-storage'),
        favorites: await this.isStoreInitialized('favorites-storage'),
        offline: await this.isStoreInitialized('offline-storage'),
        language: await this.isStoreInitialized('language-storage'),
      },
      totalSize: total,
      storeSizes: stores,
    };
  }

  private async isStoreInitialized(storeName: string): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(storeName);
      return value !== null;
    } catch {
      return false;
    }
  }

  async clearAll(): Promise<void> {
    const storeNames = [
      'auth-storage',
      'notification-storage',
      'preferences-storage',
      'favorites-storage',
      'offline-storage',
      'language-storage',
      'assistant-storage',
    ];

    await clearAllPersistedData(storeNames);

    // Reset stores to initial state
    useAuthStore.setState(useAuthStore.getState, true);
    useNotificationStore.setState(useNotificationStore.getState, true);
    usePreferencesStore.setState(usePreferencesStore.getState, true);
    useFavoritesStore.setState(useFavoritesStore.getState, true);
    useOfflineStore.setState(useOfflineStore.getState, true);
    useLanguageStore.setState(useLanguageStore.getState, true);

    console.log('[Persistence] All data cleared');
  }

  async clearStore(storeName: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(storeName);
      await SecureStore.deleteItemAsync(storeName);
      console.log(`[Persistence] Store ${storeName} cleared`);
    } catch (error) {
      console.error(`[Persistence] Failed to clear store ${storeName}:`, error);
    }
  }

  async getStoreSize(storeName: string): Promise<number> {
    try {
      const value = await AsyncStorage.getItem(storeName);
      return value ? new Blob([value]).size : 0;
    } catch {
      return 0;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const persistenceManager = PersistenceManager.getInstance();