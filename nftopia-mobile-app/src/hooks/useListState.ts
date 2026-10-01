import { useMemo } from 'react';

/**
 * The states a list screen can be in at any given moment (#472). Loading
 * skeletons remain each screen's own concern (this hook doesn't render
 * anything) — this just tells the screen *which* of loading/error/empty/
 * data to show.
 */
export type ListState = 'loading' | 'error' | 'empty' | 'empty-filtered' | 'data';

export interface UseListStateParams {
  loading: boolean;
  /** Truthy if the last fetch failed — the concrete error type is the caller's concern (ApolloError, string, Error, ...). */
  error?: unknown;
  itemCount: number;
  /**
   * True when the current view is narrowed by an active filter/search
   * query. Distinguishes "nothing exists yet" from "nothing matched" per
   * #472 — same zero itemCount, different user-facing message.
   */
  isFiltered?: boolean;
}

/**
 * Pure derivation, exported separately from the hook so it's testable
 * without rendering anything — see useListState.test.ts.
 *
 * Precedence mirrors the hand-rolled logic MarketplaceScreen already used
 * before this hook existed (`loading && listings.length === 0` /
 * `error && listings.length === 0`): loading and error only take over the
 * whole screen while there's no data yet to show *instead* — a background
 * refresh or a failed loadMore on an already-populated list should keep
 * showing the existing data, not bounce to a full-screen loading/error
 * state.
 */
export function deriveListState({
  loading,
  error,
  itemCount,
  isFiltered = false,
}: UseListStateParams): ListState {
  if (itemCount > 0) return 'data';
  if (loading) return 'loading';
  if (error) return 'error';
  return isFiltered ? 'empty-filtered' : 'empty';
}

export function useListState(params: UseListStateParams): ListState {
  const { loading, error, itemCount, isFiltered } = params;
  return useMemo(
    () => deriveListState({ loading, error, itemCount, isFiltered }),
    [loading, error, itemCount, isFiltered],
  );
}
