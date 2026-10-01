/**
 * Standard action/retry contract shared by EmptyState and ErrorState
 * (#472), so any screen adopting either component wires a CTA/retry the
 * same way. `onPress` may return a Promise (e.g. an Apollo `refetch()` or
 * a store's async `search()`) — callers aren't required to await it
 * themselves.
 */
export interface ListStateAction {
  label: string;
  onPress: () => void | Promise<void>;
}

export type RetryHandler = () => void | Promise<void>;
