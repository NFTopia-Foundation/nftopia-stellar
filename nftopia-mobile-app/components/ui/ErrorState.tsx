import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, listState } from '@/constants/theme';
import { ListStateIcon } from './listStateIcons';
import type { RetryHandler } from './listState.types';

export interface ErrorStateProps {
  /** 'offline' swaps the icon/default copy for a connectivity-specific message; 'error' (default) is the generic failed-fetch case. */
  variant?: 'error' | 'offline';
  title?: string;
  subtitle?: string;
  /** Standard retry contract (#472) shared with EmptyState's action.onPress — omit to render without a retry button (e.g. a non-retryable error). */
  onRetry?: RetryHandler;
  retryLabel?: string;
  testID?: string;
}

const DEFAULTS = {
  error: {
    title: 'Something went wrong',
    subtitle: "We couldn't load this. Please try again.",
  },
  offline: {
    title: "You're offline",
    subtitle: 'Check your connection and try again.',
  },
};

/**
 * Shared failed-fetch list state (#472) — sibling of EmptyState. Reused
 * as-is by MarketplaceScreen and SearchResultsScreen (which previously had
 * no retry action on its error at all). See useListState (src/hooks/) for
 * deriving when to render this vs. EmptyState vs. the list itself.
 */
export function ErrorState({
  variant = 'error',
  title,
  subtitle,
  onRetry,
  retryLabel = 'Retry',
  testID,
}: ErrorStateProps) {
  const resolvedTitle = title ?? DEFAULTS[variant].title;
  const resolvedSubtitle = subtitle ?? DEFAULTS[variant].subtitle;
  const announcement = `${resolvedTitle}. ${resolvedSubtitle}`;

  const announced = useRef(false);
  useEffect(() => {
    if (!announced.current) {
      AccessibilityInfo.announceForAccessibility(announcement);
      announced.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement]);

  return (
    <View
      style={styles.container}
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={announcement}
    >
      <ListStateIcon name={variant === 'offline' ? 'offline' : 'error'} />
      <Text style={styles.title} accessibilityRole="header">
        {resolvedTitle}
      </Text>
      <Text style={styles.subtitle}>{resolvedSubtitle}</Text>
      {onRetry ? (
        <TouchableOpacity
          style={styles.retry}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          testID={testID ? `${testID}-retry` : undefined}
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: listState.containerPadding,
  },
  title: {
    ...listState.title,
    color: colors.text,
    marginTop: listState.titleSpacing,
    textAlign: 'center',
  },
  subtitle: {
    ...listState.subtitle,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: listState.titleSpacing,
    marginBottom: listState.subtitleSpacing,
  },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: listState.containerPadding,
    paddingVertical: listState.actionSpacing,
    borderRadius: borderRadius.md,
    marginTop: listState.actionSpacing,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
