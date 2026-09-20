import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { buildShareLink, ShareEntityType, ShareLinkOptions } from '@/src/utils/shareLinks';
import { useAnalytics } from '@/src/hooks/useAnalytics';
import { ANALYTICS_EVENTS } from '@/src/analytics/config';
import { errorLogger } from '@/src/errors/logger';

export interface ShareButtonProps {
  /** Entity being shared. Required unless an explicit `url` is supplied. */
  type?: ShareEntityType;
  /** Entity id used to build the canonical link. Required unless `url` is supplied. */
  id?: string;
  /** Explicit link to share, takes precedence over `type` + `id`. */
  url?: string;
  /** Options forwarded to `buildShareLink` (format, baseUrl, query, ...). */
  linkOptions?: ShareLinkOptions;
  /** Title passed to the native share sheet. */
  title?: string;
  /** Message/body passed to the native share sheet. */
  message?: string;
  /** Visible label for `button` variants. */
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Called with the resolved link after a successful share. */
  onShared?: (url: string) => void;
  testID?: string;
}

const SIZE_DIMENSIONS = {
  sm: { button: 28, fontSize: 14, minWidth: 60 },
  md: { button: 36, fontSize: 16, minWidth: 80 },
  lg: { button: 44, fontSize: 18, minWidth: 100 },
};

const DEFAULT_TITLE = 'Check this out on NFTopia!';

/**
 * Reusable native share affordance for NFTs, collections and profiles.
 *
 * Tapping the button opens the platform share sheet via React Native's
 * `Share` API (no extra native dependency required; it is the supported way to
 * share text/URLs and works on both iOS and Android). Cancelling the sheet is
 * treated as a normal outcome and never throws.
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  type,
  id,
  url,
  linkOptions,
  title = DEFAULT_TITLE,
  message,
  label = 'Share',
  variant = 'primary',
  size = 'md',
  disabled = false,
  onShared,
  testID,
}) => {
  const { track } = useAnalytics();
  const [sharing, setSharing] = useState(false);

  const { link, linkError } = useMemo(() => {
    try {
      if (url) return { link: url, linkError: null as Error | null };
      if (type && id) return { link: buildShareLink(type, id, linkOptions), linkError: null as Error | null };
      return { link: null, linkError: new Error('ShareButton requires either `url` or `type` + `id`.') };
    } catch (error) {
      return { link: null, linkError: error as Error };
    }
  }, [url, type, id, linkOptions]);

  const isDisabled = disabled || sharing || !link;

  const handleShare = useCallback(async () => {
    if (!link || sharing) return;

    setSharing(true);
    const baseProperties = { type, id, url: link };

    try {
      track(ANALYTICS_EVENTS.SHARE_INITIATED, baseProperties);

      const body = message ? `${message}\n\n${link}` : link;
      const result = await Share.share({ title, message: body, url: link });

      if (result.action === Share.sharedAction) {
        track(ANALYTICS_EVENTS.SHARE_COMPLETED, {
          ...baseProperties,
          activityType: result.activityType,
        });
        onShared?.(link);
      } else if (result.action === Share.dismissedAction) {
        track(ANALYTICS_EVENTS.SHARE_CANCELLED, baseProperties);
      }
    } catch (error) {
      track(ANALYTICS_EVENTS.SHARE_FAILED, {
        ...baseProperties,
        error: (error as Error).message,
      });
      errorLogger.log(error as Error, 'ShareButton', undefined, baseProperties);
    } finally {
      setSharing(false);
    }
  }, [link, sharing, message, title, track, onShared, type, id]);

  if (!link) {
    if (linkError) {
      errorLogger.log(linkError, 'ShareButton', undefined, { type, id });
    }
    return null;
  }

  const dimensions = SIZE_DIMENSIONS[size];
  const isIcon = variant === 'icon';

  const buttonStyle: ViewStyle[] = [styles.button];
  if (isIcon) {
    buttonStyle.push({
      width: dimensions.button,
      height: dimensions.button,
      borderRadius: dimensions.button / 2,
    });
    buttonStyle.push(styles.iconVariant);
  } else {
    buttonStyle.push({ minWidth: dimensions.minWidth });
    buttonStyle.push(styles[`${variant}Variant` as 'primaryVariant' | 'secondaryVariant' | 'outlineVariant']);
    buttonStyle.push(
      size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd
    );
  }

  const textStyle = isIcon
    ? styles.iconText
    : [
        styles.labelText,
        variant === 'primary' ? styles.primaryText : styles.secondaryText,
        { fontSize: dimensions.fontSize },
      ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handleShare}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Share ${type ?? 'link'}`}
      accessibilityState={{ disabled: isDisabled, busy: sharing }}
      hitSlop={isIcon ? { top: 8, bottom: 8, left: 8, right: 8 } : undefined}
      testID={testID}
    >
      {sharing ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || isIcon ? '#FFFFFF' : colors.primary}
        />
      ) : isIcon ? (
        <Text style={textStyle}>📤</Text>
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

export default ShareButton;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  iconVariant: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    ...shadows.sm,
  },
  primaryVariant: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  secondaryVariant: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  outlineVariant: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  sizeSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sizeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sizeLg: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  labelText: {
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: colors.text,
  },
  iconText: {
    fontSize: 16,
  },
});
