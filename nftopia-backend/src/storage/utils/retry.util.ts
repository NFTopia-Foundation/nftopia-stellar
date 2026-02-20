export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const wait = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const attempts = Math.max(1, options.attempts);
  const baseDelayMs = Math.max(0, options.baseDelayMs);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= attempts) {
        break;
      }

      const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
      const delayMs = Math.min(
        exponentialDelay,
        options.maxDelayMs ?? exponentialDelay,
      );

      options.onRetry?.(error, attempt, delayMs);
      await wait(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Retry operation failed');
};
