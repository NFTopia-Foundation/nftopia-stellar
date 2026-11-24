// React Native injects this global at build time; the shared store factory reads it.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const asyncStorageStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(asyncStorageStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    asyncStorageStore[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete asyncStorageStore[key];
    return Promise.resolve();
  }),
  mergeItem: jest.fn(),
  clear: jest.fn(() => {
    Object.keys(asyncStorageStore).forEach((key) => delete asyncStorageStore[key]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(asyncStorageStore))),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

import { usePreferencesStore } from '../preferencesStore';

const preferencesPersistence = (
  usePreferencesStore as typeof usePreferencesStore & {
    persist: {
      clearStorage: () => void | Promise<void>;
      rehydrate: () => void | Promise<void>;
    };
  }
).persist;

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));
const getStore = () => usePreferencesStore.getState();

describe('usePreferencesStore', () => {
  beforeEach(async () => {
    Object.keys(asyncStorageStore).forEach((key) => delete asyncStorageStore[key]);
    await preferencesPersistence.clearStorage();
    usePreferencesStore.setState({
      theme: 'system',
      language: 'en',
      currency: 'USD',
      notificationsEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      autoLock: true,
      lockTimeout: 5,
      hideBalances: false,
      reduceHaptics: false,
      lastUpdated: null,
    });
  });

  it('uses defaults when storage has no preferences', async () => {
    await preferencesPersistence.rehydrate();

    expect(getStore()).toMatchObject({
      theme: 'system',
      language: 'en',
      currency: 'USD',
      notificationsEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      autoLock: true,
      lockTimeout: 5,
      hideBalances: false,
      reduceHaptics: false,
      lastUpdated: null,
    });
  });

  it('gets and sets every tracked preference', () => {
    getStore().setTheme('dark');
    getStore().setLanguage('fr');
    getStore().setCurrency('EUR');
    getStore().setNotificationsEnabled(false);
    getStore().setSoundEnabled(false);
    getStore().setVibrationEnabled(false);
    getStore().setAutoLock(false);
    getStore().setLockTimeout(15);
    getStore().setHideBalances(true);
    getStore().setReduceHaptics(true);

    expect(getStore()).toMatchObject({
      theme: 'dark',
      language: 'fr',
      currency: 'EUR',
      notificationsEnabled: false,
      soundEnabled: false,
      vibrationEnabled: false,
      autoLock: false,
      lockTimeout: 15,
      hideBalances: true,
      reduceHaptics: true,
    });
    expect(getStore().lastUpdated).toEqual(expect.any(String));
  });

  it('rehydrates preferences from AsyncStorage', async () => {
    asyncStorageStore['preferences-storage'] = JSON.stringify({
      _version: 1,
      state: {
        state: {
          theme: 'light',
          language: 'es',
          currency: 'CAD',
          notificationsEnabled: false,
          soundEnabled: false,
          vibrationEnabled: true,
          autoLock: false,
          lockTimeout: 20,
          hideBalances: true,
          reduceHaptics: true,
        },
        version: 1,
      },
    });

    await preferencesPersistence.rehydrate();

    expect(getStore()).toMatchObject({
      theme: 'light',
      language: 'es',
      currency: 'CAD',
      notificationsEnabled: false,
      soundEnabled: false,
      vibrationEnabled: true,
      autoLock: false,
      lockTimeout: 20,
      hideBalances: true,
      reduceHaptics: true,
    });
  });

  it('persists preference changes without persisting actions or lastUpdated', async () => {
    getStore().setCurrency('GBP');
    await flushMicrotasks();

    const persisted = JSON.parse(asyncStorageStore['preferences-storage']);
    expect(persisted._version).toBe(1);
    expect(persisted.state.state).toMatchObject({ currency: 'GBP' });
    expect(persisted.state.state.lastUpdated).toBeUndefined();
    expect(persisted.state.state.setCurrency).toBeUndefined();
  });
});