import React from 'react';
import { Text } from 'react-native';
import { listState } from '@/constants/theme';

/**
 * Small shared icon/illustration set for empty/error list states (#472).
 * Deliberately glyph-based rather than a new vector-icon dependency — this
 * matches the convention already used across the app for this exact kind
 * of state (see src/components/ErrorFallback.tsx's own icon-per-error-code
 * mapping) and keeps EmptyState/ErrorState dependency-free. `icon` on both
 * components accepts a custom ReactNode override, so a richer illustration
 * (Lottie, SVG) can replace any of these later without an API change.
 */
export type ListStateIconName = 'empty' | 'filtered' | 'error' | 'offline';

const LIST_STATE_GLYPHS: Record<ListStateIconName, string> = {
  empty: '\u{1F4ED}', // 📭 open mailbox with lowered flag
  filtered: '\u{1F50D}', // 🔍 magnifying glass
  error: '\u{26A0}\u{FE0F}', // ⚠️ warning
  offline: '\u{1F4F6}', // 📶 no/low signal
};

export interface ListStateIconProps {
  name: ListStateIconName;
  size?: number;
}

/** Decorative — the surrounding title/subtitle text already carries the
 * meaning a screen reader needs, so this is hidden from accessibility
 * tooling rather than announced redundantly (e.g. as "warning sign"). */
export function ListStateIcon({ name, size = listState.iconSize }: ListStateIconProps) {
  return (
    <Text
      style={{ fontSize: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {LIST_STATE_GLYPHS[name]}
    </Text>
  );
}
