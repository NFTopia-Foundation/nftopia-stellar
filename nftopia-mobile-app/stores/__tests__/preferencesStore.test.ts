(global as unknown as { __DEV__: boolean }).__DEV__ = false;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { usePreferencesStore } from '../preferencesStore';

function getStore() {
  return usePreferencesStore.getState();
}

describe('preferencesStore haptics preference', () => {
  beforeEach(() => {
    getStore().resetPreferences();
  });

  it('defaults to haptics enabled (reduceHaptics = false)', () => {
    expect(getStore().reduceHaptics).toBe(false);
  });

  it('toggles the reduceHaptics preference', () => {
    getStore().setReduceHaptics(true);
    expect(getStore().reduceHaptics).toBe(true);

    getStore().setReduceHaptics(false);
    expect(getStore().reduceHaptics).toBe(false);
  });

  it('resets reduceHaptics back to its default', () => {
    getStore().setReduceHaptics(true);
    getStore().resetPreferences();
    expect(getStore().reduceHaptics).toBe(false);
  });
});
