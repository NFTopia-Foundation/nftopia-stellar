export type OnRetry = () => void | Promise<void>;

export type EmptyStateVariant = 'no-data' | 'filtered';

export type ErrorStateVariant = 'error' | 'offline';

export type StateIconVariant =
  | 'empty'
  | 'filtered-empty'
  | 'error'
  | 'offline';

export interface StateAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}
