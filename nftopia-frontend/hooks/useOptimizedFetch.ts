import { useEffect, useRef, useState, useCallback } from "react";

// Move cache and dedupeMap to module scope for cross-hook deduplication
const staticCache = new Map<string, any>();
const dedupeMap = new Map<string, Promise<any>>();

/**
 * useOptimizedFetch hook
 * @template T
 * @param url The API endpoint
 * @param options Fetch options and config
 * @returns { data, error, loading, refetch, cancel }
 */
export function useOptimizedFetch<T = unknown>(
  url: string,
  options?: {
    fetchOptions?: RequestInit;
    cacheKey?: string;
    dedupe?: boolean;
    retry?: number;
    retryDelay?: number;
    enabled?: boolean;
    dependencies?: any[];
  }
) {
  const abortController = useRef<AbortController | null>(null);

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = options?.cacheKey || url;
  const dedupe = options?.dedupe ?? true;
  const retry = options?.retry ?? 2;
  const retryDelay = options?.retryDelay ?? 500;
  const enabled = options?.enabled ?? true;
  const deps = options?.dependencies || [];

  const fetchData = useCallback(
    async (attempt = 0): Promise<T | null> => {
      if (!enabled) return null;
      setLoading(true);
      setError(null);
      abortController.current?.abort();
      abortController.current = new AbortController();
      const signal = abortController.current.signal;

      // Cache hit
      if (staticCache.has(cacheKey)) {
        setData(staticCache.get(cacheKey)!);
        setLoading(false);
        return staticCache.get(cacheKey)!;
      }

      // Deduplication
      if (dedupe && dedupeMap.has(cacheKey)) {
        try {
          const result = await dedupeMap.get(cacheKey)!;
          setData(result);
          setLoading(false);
          return result;
        } catch (err) {
          setError(err);
          setLoading(false);
          return null;
        }
      }

      // Retry logic
      const doFetch = async (): Promise<T> => {
        const res = await fetch(url, { ...options?.fetchOptions, signal });
        if (!res.ok) {
          const error = new Error(`HTTP ${res.status}`);
          setError(error);
          setData(null);
          throw error;
        }
        const json = (await res.json()) as T;
        staticCache.set(cacheKey, json);
        return json;
      };

      const fetchPromise = (async (): Promise<T> => {
        let lastError;
        for (let i = 0; i <= retry; i++) {
          try {
            return await doFetch();
          } catch (err: any) {
            if (signal.aborted) throw new Error("Request cancelled");
            lastError = err;
            if (i < retry) {
              await new Promise((r) =>
                setTimeout(r, retryDelay * Math.pow(2, i))
              );
            }
          }
        }
        throw lastError;
      })();

      if (dedupe) dedupeMap.set(cacheKey, fetchPromise);

      try {
        const result = await fetchPromise;
        setData(result);
        setLoading(false);
        return result;
      } catch (err) {
        setError(err);
        setData(null);
        setLoading(false);
        return null;
      } finally {
        if (dedupe) dedupeMap.delete(cacheKey);
      }
    },
    [url, cacheKey, dedupe, retry, retryDelay, enabled, ...deps]
  );

  // Initial fetch and dependency tracking
  useEffect(() => {
    if (enabled) fetchData();
    return () => {
      abortController.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  // Cancel function
  const cancel = useCallback(() => {
    abortController.current?.abort();
    setLoading(false);
  }, []);

  // Refetch function
  const refetch = useCallback(() => {
    staticCache.delete(cacheKey);
    fetchData();
  }, [cacheKey, fetchData]);

  return { data, error, loading, refetch, cancel };
}
