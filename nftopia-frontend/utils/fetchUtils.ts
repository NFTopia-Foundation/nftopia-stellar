// Simple in-memory cache for fetch responses
const fetchCache = new Map<string, any>();
const dedupeMap = new Map<string, Promise<any>>();

/**
 * Get cached response by key
 */
export function getCache<T>(key: string): T | undefined {
  return fetchCache.get(key);
}

/**
 * Set cache for a key
 */
export function setCache<T>(key: string, value: T) {
  fetchCache.set(key, value);
}

/**
 * Remove cache for a key
 */
export function clearCache(key: string) {
  fetchCache.delete(key);
}

/**
 * Get deduplication promise by key
 */
export function getDedupePromise<T>(key: string): Promise<T> | undefined {
  return dedupeMap.get(key);
}

/**
 * Set deduplication promise for a key
 */
export function setDedupePromise<T>(key: string, promise: Promise<T>) {
  dedupeMap.set(key, promise);
}

/**
 * Remove deduplication promise for a key
 */
export function clearDedupePromise(key: string) {
  dedupeMap.delete(key);
}

/**
 * Exponential backoff retry
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 500
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((r) => setTimeout(r, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

export function clearAllCaches() {
  fetchCache.clear();
  dedupeMap.clear();
}
