import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, listState } from '@/constants/theme';
import { ListStateIcon, type ListStateIconName } from './listStateIcons';
import type { ListStateAction } from './listState.types';

export interface EmptyStateProps {
  /**
   * 'no-data': nothing exists yet for this list at all.
   * 'filtered': items exist, but the current filters/search matched none —
   * a distinct message from 'no-data' per #472 (e.g. "adjust your filters"
   * rather than "nothing here yet").
   */
  variant?: 'no-data' | 'filtered';
  icon?: ListStateIconName;
  title: string;
  subtitle?: string;
  action?: ListStateAction;
  testID?: string;
}

/**
 * Shared empty-list state (#472) — reused as-is by MarketplaceScreen
 * ('no-data', no active filters) and SearchResultsScreen ('filtered', a
 * query matched nothing). See ErrorState for the sibling failed-fetch case
 * and useListState (src/hooks/) for deriving which one to render.
 */
export function EmptyState({
  variant = 'no-data',
  icon,
  title,
  subtitle,
  action,
  testID,
}: EmptyStateProps) {
  const resolvedIcon = icon ?? (variant === 'filtered' ? 'filtered' : 'empty');
  const announcement = subtitle ? `${title}. ${subtitle}` : title;

  // accessibilityLiveRegion only auto-announces content CHANGES within an
  // already-mounted Android view; it doesn't reliably cover this component
  // itself freshly mounting (e.g. a screen swapping from a loading skeleton
  // straight to this). Announcing explicitly on mount covers that entry
  // transition on both platforms.
  const announced = useRef(false);
  useEffect(() => {
    if (!announced.current) {
      AccessibilityInfo.announceForAccessibility(announcement);
      announced.current = true;
    }
    // Re-announce if the message itself changes (e.g. no-data -> filtered
    // without unmounting), but not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement]);

  return (
    <View
      style={styles.container}
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={announcement}
    >
      <ListStateIcon name={resolvedIcon} />
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? (
        <TouchableOpacity
          style={styles.action}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          testID={testID ? `${testID}-action` : undefined}
        >
          <Text style={styles.actionText}>{action.label}</Text>
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
  action: {
    backgroundColor: colors.primary,
    paddingHorizontal: listState.containerPadding,
    paddingVertical: listState.actionSpacing,
    borderRadius: borderRadius.md,
    marginTop: listState.actionSpacing,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
