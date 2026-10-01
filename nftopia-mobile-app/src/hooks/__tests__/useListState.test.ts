import { deriveListState } from '@/src/hooks/useListState';

describe('deriveListState', () => {
  it('returns "loading" when loading with no items yet', () => {
    expect(deriveListState({ loading: true, itemCount: 0 })).toBe('loading');
  });

  it('returns "error" when a fetch failed with no items yet', () => {
    expect(
      deriveListState({ loading: false, error: new Error('boom'), itemCount: 0 }),
    ).toBe('error');
  });

  it('returns "error" for a non-Error truthy error value (e.g. a string message)', () => {
    expect(
      deriveListState({ loading: false, error: 'network down', itemCount: 0 }),
    ).toBe('error');
  });

  it('returns "empty" when there is no data, no error, and not loading', () => {
    expect(deriveListState({ loading: false, itemCount: 0 })).toBe('empty');
  });

  it('returns "empty-filtered" instead of "empty" when isFiltered is true', () => {
    expect(
      deriveListState({ loading: false, itemCount: 0, isFiltered: true }),
    ).toBe('empty-filtered');
  });

  it('returns "data" whenever there are items, regardless of loading/error', () => {
    expect(deriveListState({ loading: false, itemCount: 3 })).toBe('data');
    expect(deriveListState({ loading: true, itemCount: 3 })).toBe('data');
    expect(
      deriveListState({ loading: false, error: new Error('boom'), itemCount: 3 }),
    ).toBe('data');
  });

  it('prioritizes loading over error when both are present with no items (matches a refetch-after-error in flight)', () => {
    expect(
      deriveListState({ loading: true, error: new Error('boom'), itemCount: 0 }),
    ).toBe('loading');
  });

  it('does not let a background refresh (loading with existing items) hide the current data', () => {
    // e.g. pull-to-refresh mid-flight on an already-populated list.
    expect(deriveListState({ loading: true, itemCount: 5 })).toBe('data');
  });

  it('treats a falsy error (e.g. empty string, null) as no error', () => {
    expect(deriveListState({ loading: false, error: null, itemCount: 0 })).toBe(
      'empty',
    );
    expect(deriveListState({ loading: false, error: '', itemCount: 0 })).toBe(
      'empty',
    );
  });
});
