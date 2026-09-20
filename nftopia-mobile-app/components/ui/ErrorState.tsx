import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, emptyState } from '@/constants/theme';
import { useStateAnnouncement } from '@/hooks/useStateAnnouncement';
import StateIcon from './StateIcon';
import type {
  ErrorStateVariant,
  OnRetry,
  StateIconVariant,
} from './listState.types';

const DEFAULT_COPY: Record<ErrorStateVariant, { title: string; message: string }> = {
  error: {
    title: 'Something went wrong',
    message: 'We could not load this list. Please try again.',
  },
  offline: {
    title: 'You are offline',
    message: 'Check your connection and try again.',
  },
};

const ICON_VARIANTS: Record<ErrorStateVariant, StateIconVariant> = {
  error: 'error',
  offline: 'offline',
};

export interface ErrorStateProps {
  variant?: ErrorStateVariant;
  title?: string;
  message?: string;
  onRetry: OnRetry;
  retryLabel?: string;
  isRetrying?: boolean;
  icon?: React.ReactNode;
  testID?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  variant = 'error',
  title,
  message,
  onRetry,
  retryLabel,
  isRetrying = false,
  icon,
  testID = 'error-state',
}) => {
  const resolvedTitle = title ?? DEFAULT_COPY[variant].title;
  const resolvedMessage =
    message === undefined ? DEFAULT_COPY[variant].message : message;
  const label = retryLabel ?? 'Retry';

  const handleRetry = useCallback(() => {
    try {
      const result = onRetry();
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      // Consumers own error handling; the shared component only invokes the action.
    }
  }, [onRetry]);

  const announcement = useMemo(
    () => [resolvedTitle, resolvedMessage].filter(Boolean).join('. '),
    [resolvedTitle, resolvedMessage],
  );

  useStateAnnouncement(announcement);

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      testID={testID}
    >
      {icon ?? <StateIcon variant={ICON_VARIANTS[variant]} testID={`${testID}-icon`} />}
      <Text style={styles.title} accessibilityRole="header">
        {resolvedTitle}
      </Text>
      {resolvedMessage ? <Text style={styles.message}>{resolvedMessage}</Text> : null}
      <TouchableOpacity
        style={[styles.retry, isRetrying && styles.retryDisabled]}
        onPress={handleRetry}
        disabled={isRetrying}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isRetrying, busy: isRetrying }}
        testID={`${testID}-retry`}
      >
        {isRetrying ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.retryText}>{label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default ErrorState;

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
  retry: {
    backgroundColor: colors.primary,
    paddingVertical: emptyState.actionPaddingVertical,
    paddingHorizontal: emptyState.actionPaddingHorizontal,
    borderRadius: emptyState.actionRadius,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryDisabled: {
    opacity: 0.7,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
