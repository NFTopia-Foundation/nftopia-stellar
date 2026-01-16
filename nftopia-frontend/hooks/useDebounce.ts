import { useEffect, useRef, useState } from "react";

/**
 * useDebounce hook
 * @template T
 * @param value The value to debounce
 * @param delay Delay in ms (default: 300)
 * @param options Optional: { immediate?: boolean }
 * @returns Debounced value
 */
export function useDebounce<T>(
  value: T,
  delay = 300,
  options?: { immediate?: boolean }
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const immediate = options?.immediate;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (immediate && firstRun.current) {
      setDebouncedValue(value);
      firstRun.current = false;
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay, immediate]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return debouncedValue;
}
