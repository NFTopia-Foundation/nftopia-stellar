import { useMemo } from 'react';
import type { OnRetry } from '@/components/ui/listState.types';

export type ListStateStatus =
  | 'loading'
  | 'error'
  | 'empty'
  | 'filtered-empty'
  | 'success';

export type ListStateVariant =
  | 'loading'
  | 'error'
  | 'empty'
  | 'filtered-empty'
  | 'data';

export interface UseListStateParams<T> {
  data?: readonly T[] | null;
  loading?: boolean;
  error?: unknown;
  refreshing?: boolean;
  isFiltered?: boolean;
  hasLoaded?: boolean;
  onRetry?: OnRetry;
}

export interface ListState<T> {
  items: readonly T[];
  count: number;
  status: ListStateStatus;
  variant: ListStateVariant;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  isEmpty: boolean;
  isFiltered: boolean;
  hasData: boolean;
  onRetry?: OnRetry;
}

export function deriveListState<T>({
  data,
  loading = false,
  error,
  refreshing = false,
  isFiltered = false,
  hasLoaded,
  onRetry,
}: UseListStateParams<T>): ListState<T> {
  const items = data ?? [];
  const count = items.length;
  const hasData = count > 0;
  const isSettled = hasLoaded ?? (data !== undefined && data !== null);
  const isError = Boolean(error) && !hasData;
  const isLoading = !hasData && !isError && (loading || !isSettled);
  const isRefreshing = refreshing && hasData;

  let status: ListStateStatus;
  let variant: ListStateVariant;

  if (isError) {
    status = 'error';
    variant = 'error';
  } else if (isLoading) {
    status = 'loading';
    variant = 'loading';
  } else if (hasData) {
    status = 'success';
    variant = 'data';
  } else if (isFiltered) {
    status = 'filtered-empty';
    variant = 'filtered-empty';
  } else {
    status = 'empty';
    variant = 'empty';
  }

  return {
    items,
    count,
    status,
    variant,
    isLoading,
    isRefreshing,
    isError,
    isEmpty: !hasData && !isLoading && !isError,
    isFiltered,
    hasData,
    onRetry,
  };
}

export function useListState<T>(params: UseListStateParams<T>): ListState<T> {
  const {
    data,
    loading,
    error,
    refreshing,
    isFiltered,
    hasLoaded,
    onRetry,
  } = params;

  return useMemo(
    () =>
      deriveListState({
        data,
        loading,
        error,
        refreshing,
        isFiltered,
        hasLoaded,
        onRetry,
      }),
    [data, loading, error, refreshing, isFiltered, hasLoaded, onRetry],
  );
}
