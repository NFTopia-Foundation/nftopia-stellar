import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, shadows } from '@/constants/theme';
import { shareEntity, ShareResult } from '@/src/services/share.service';
import { ShareEntityType } from '@/src/utils/shareLink';

export interface ShareButtonProps {
  id: string;
  type: ShareEntityType;
  /** Display name of the item being shared, used to personalise the share title. */
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  onShared?: (result: ShareResult) => void;
  testID?: string;
}

const SIZES = {
  sm: { button: 28, icon: 14 },
  md: { button: 36, icon: 17 },
  lg: { button: 44, icon: 20 },
};

/**
 * Opens the native OS share sheet for an NFT, collection, or profile.
 *
 * Mirrors `FavoriteButton`'s affordance so the two can sit side by side on a
 * card overlay. Sharing itself (link building, the share sheet call, the
 * clipboard fallback, analytics) lives in `share.service.ts` — this
 * component only owns the press-guard that stops a second tap from opening
 * a second share sheet while one is already in flight.
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  id,
  type,
  name,
  size = 'md',
  onShared,
  testID,
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const dims = SIZES[size];

  const handlePress = useCallback(() => {
    if (isSharing) return;
    setIsSharing(true);
    // Fire-and-forget: shareEntity() never rejects, so the UI thread is
    // never blocked waiting on the OS share sheet or a network-free
    // clipboard fallback.
    shareEntity(type, id, name)
      .then((result) => onShared?.(result))
      .finally(() => setIsSharing(false));
  }, [id, type, name, isSharing, onShared]);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { width: dims.button, height: dims.button, borderRadius: dims.button / 2 },
      ]}
      onPress={handlePress}
      disabled={isSharing}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Share"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID={testID}
    >
      <Text style={[styles.icon, { fontSize: dims.icon }]}>↗</Text>
    </TouchableOpacity>
  );
};

export default ShareButton;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    ...shadows.sm,
  },
  icon: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
