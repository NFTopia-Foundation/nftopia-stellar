import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, emptyState } from '@/constants/theme';
import { useStateAnnouncement } from '@/hooks/useStateAnnouncement';
import StateIcon from './StateIcon';
import type {
  EmptyStateVariant,
  OnRetry,
  StateAction,
  StateIconVariant,
} from './listState.types';

const DEFAULT_COPY: Record<EmptyStateVariant, { title: string; message: string }> = {
  'no-data': {
    title: 'Nothing here yet',
    message: 'New items will show up here once they are available.',
  },
  filtered: {
    title: 'No results found',
    message: 'Try adjusting your search or filters to see more.',
  },
};

const ICON_VARIANTS: Record<EmptyStateVariant, StateIconVariant> = {
  'no-data': 'empty',
  filtered: 'filtered-empty',
};

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  ctaAccessibilityLabel?: string;
  secondaryCtaLabel?: string;
  onSecondaryCta?: () => void;
  retryLabel?: string;
  onRetry?: OnRetry;
  clearFiltersLabel?: string;
  onClearFilters?: () => void;
  testID?: string;
}

const runSafely = (action: OnRetry | (() => void)): void => {
  try {
    const result = action();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch(() => undefined);
    }
  } catch {
    // Consumers own error handling; the shared component only invokes the action.
  }
};

const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'no-data',
  title,
  message,
  icon,
  ctaLabel,
  onCta,
  ctaAccessibilityLabel,
  secondaryCtaLabel,
  onSecondaryCta,
  retryLabel,
  onRetry,
  clearFiltersLabel,
  onClearFilters,
  testID = 'empty-state',
}) => {
  const resolvedTitle = title ?? DEFAULT_COPY[variant].title;
  const resolvedMessage =
    message === undefined ? DEFAULT_COPY[variant].message : message;

  const actions = useMemo<StateAction[]>(() => {
    const list: StateAction[] = [];

    if (ctaLabel && onCta) {
      list.push({
        label: ctaLabel,
        onPress: () => runSafely(onCta),
        accessibilityLabel: ctaAccessibilityLabel,
      });
    } else if (variant === 'filtered' && clearFiltersLabel && onClearFilters) {
      list.push({
        label: clearFiltersLabel,
        onPress: () => runSafely(onClearFilters),
      });
    } else if (onRetry) {
      list.push({
        label: retryLabel ?? 'Try again',
        onPress: () => runSafely(onRetry),
      });
    }

    if (secondaryCtaLabel && onSecondaryCta) {
      list.push({
        label: secondaryCtaLabel,
        onPress: () => runSafely(onSecondaryCta),
      });
    }

    return list;
  }, [
    ctaLabel,
    onCta,
    ctaAccessibilityLabel,
    variant,
    clearFiltersLabel,
    onClearFilters,
    retryLabel,
    onRetry,
    secondaryCtaLabel,
    onSecondaryCta,
  ]);

  const announcement = useMemo(
    () => [resolvedTitle, resolvedMessage].filter(Boolean).join('. '),
    [resolvedTitle, resolvedMessage],
  );

  useStateAnnouncement(announcement);

  return (
    <View
      style={styles.container}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {icon ?? <StateIcon variant={ICON_VARIANTS[variant]} testID={`${testID}-icon`} />}
      <Text style={styles.title} accessibilityRole="header">
        {resolvedTitle}
      </Text>
      {resolvedMessage ? <Text style={styles.message}>{resolvedMessage}</Text> : null}
      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.action, index > 0 && styles.actionSecondary]}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              testID={`${testID}-action-${index}`}
            >
              <Text
                style={[styles.actionText, index > 0 && styles.actionTextSecondary]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default EmptyState;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: emptyState.maxContentWidth,
    paddingVertical: emptyState.contentPaddingVertical,
    paddingHorizontal: emptyState.contentPaddingHorizontal,
  },
  title: {
    fontSize: emptyState.titleFontSize,
    fontWeight: emptyState.titleFontWeight,
    color: colors.text,
    textAlign: 'center',
    marginBottom: emptyState.titleMarginBottom,
  },
  message: {
    fontSize: emptyState.messageFontSize,
    lineHeight: emptyState.messageLineHeight,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: emptyState.messageMarginBottom,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: emptyState.actionGap,
  },
  action: {
    backgroundColor: colors.primary,
    paddingVertical: emptyState.actionPaddingVertical,
    paddingHorizontal: emptyState.actionPaddingHorizontal,
    borderRadius: emptyState.actionRadius,
  },
  actionSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  actionTextSecondary: {
    color: colors.text,
  },
});
