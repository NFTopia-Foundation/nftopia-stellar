import { deriveListState } from '@/hooks/useListState';

describe('deriveListState', () => {
  it('reports loading while the first fetch is in flight', () => {
    const state = deriveListState<number>({ data: undefined, loading: true });
    expect(state.variant).toBe('loading');
    expect(state.status).toBe('loading');
    expect(state.isLoading).toBe(true);
    expect(state.hasData).toBe(false);
  });

  it('stays in loading before any data has been loaded', () => {
    const state = deriveListState<number>({ data: undefined, loading: false });
    expect(state.variant).toBe('loading');
    expect(state.isLoading).toBe(true);
  });

  it('reports error when the fetch fails with no data', () => {
    const state = deriveListState<number>({ data: [], loading: false, error: new Error('boom') });
    expect(state.variant).toBe('error');
    expect(state.status).toBe('error');
    expect(state.isError).toBe(true);
    expect(state.isEmpty).toBe(false);
  });

  it('prefers data over a stale error once items exist', () => {
    const state = deriveListState<number>({ data: [1, 2], loading: false, error: new Error('stale') });
    expect(state.variant).toBe('data');
    expect(state.status).toBe('success');
    expect(state.isError).toBe(false);
    expect(state.hasData).toBe(true);
    expect(state.count).toBe(2);
  });

  it('reports no-data empty when there is nothing and no filters', () => {
    const state = deriveListState<number>({ data: [], loading: false });
    expect(state.variant).toBe('empty');
    expect(state.status).toBe('empty');
    expect(state.isEmpty).toBe(true);
  });

  it('reports filtered-empty distinctly when filters are active', () => {
    const state = deriveListState<number>({ data: [], loading: false, isFiltered: true });
    expect(state.variant).toBe('filtered-empty');
    expect(state.status).toBe('filtered-empty');
    expect(state.isEmpty).toBe(true);
  });

  it('exposes refreshing separately from initial loading', () => {
    const state = deriveListState<number>({ data: [1], loading: true, refreshing: true });
    expect(state.isRefreshing).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.variant).toBe('data');
  });

  it('does not treat an empty refresh as refreshing', () => {
    const state = deriveListState<number>({ data: [], loading: false, refreshing: true });
    expect(state.isRefreshing).toBe(false);
    expect(state.variant).toBe('empty');
  });

  it('honours an explicit hasLoaded flag', () => {
    const notLoaded = deriveListState<number>({ data: [], hasLoaded: false });
    expect(notLoaded.variant).toBe('loading');

    const loaded = deriveListState<number>({ data: [], hasLoaded: true });
    expect(loaded.variant).toBe('empty');
  });

  it('passes the retry callback through', () => {
    const onRetry = jest.fn();
    const state = deriveListState<number>({ data: [], error: new Error('x'), onRetry });
    expect(state.onRetry).toBe(onRetry);
  });

  it('returns an empty items array when data is null', () => {
    const state = deriveListState<number>({ data: null, hasLoaded: true });
    expect(state.items).toEqual([]);
    expect(state.count).toBe(0);
    expect(state.variant).toBe('empty');
  });
});
