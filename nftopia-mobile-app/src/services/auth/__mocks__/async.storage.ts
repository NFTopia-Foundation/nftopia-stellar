const store: Record<string, string> = {};

export const getItem = jest.fn(async (key: string) => store[key] ?? null);
export const setItem = jest.fn(async (key: string, value: string) => { store[key] = value; });
export const removeItem = jest.fn(async (key: string) => { delete store[key]; });
export const clear = jest.fn(async () => { Object.keys(store).forEach((k) => delete store[k]); });
export const getAllKeys = jest.fn(async () => Object.keys(store));
export const multiGet = jest.fn();
export const multiSet = jest.fn();
export const multiRemove = jest.fn();
export const mergeItem = jest.fn();
