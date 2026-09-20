import React, { useRef } from 'react';
import {
  TouchableOpacity,
  View,
  ViewStyle,
  StyleProp,
  StyleSheet,
  Animated,
  GestureResponderEvent,
} from 'react-native';
import { haptics } from '@/lib/haptics';
import { borderRadius, shadows } from '@/constants/theme';
import { useTheme } from '@/src/theme/ThemeContext';

export interface InteractiveCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  elevation?: 'sm' | 'md' | 'lg' | 'none';
  borderRadius?: number;
  hapticFeedback?: boolean;
  scaleOnPress?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function InteractiveCard({
  children,
  onPress,
  onLongPress,
  style,
  elevation = 'md',
  borderRadius: customBorderRadius,
  hapticFeedback = true,
  scaleOnPress = true,
  disabled = false,
  testID,
}: InteractiveCardProps) {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const getElevationStyles = () => {
    if (elevation === 'none') return {};
    const shadow = shadows[elevation === 'lg' ? 'md' : elevation];
    return {
      ...shadow,
      shadowColor: colors.shadowColor,
      backgroundColor: colors.surfaceElevated,
    };
  };

  const handlePressIn = () => {
    if (scaleOnPress) {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
        speed: 50,
        bounciness: 5,
      }).start();
    }
    if (hapticFeedback && onPress) {
      haptics.press();
    }
  };

  const handlePressOut = () => {
    if (scaleOnPress) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 5,
      }).start();
    }
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (disabled) return;
    if (onPress) onPress();
  };

  const handleLongPress = (event: GestureResponderEvent) => {
    if (disabled) return;
    if (onLongPress) {
      if (hapticFeedback) {
        haptics.longPress();
      }
      onLongPress();
    }
  };

  const cardStyles: StyleProp<ViewStyle>[] = [
    styles.card,
    getElevationStyles(),
    {
      borderRadius: customBorderRadius || borderRadius.md,
      backgroundColor: elevation === 'none' ? 'transparent' : colors.surfaceElevated,
      opacity: disabled ? 0.5 : 1,
    },
    style,
  ];

  if (!onPress && !onLongPress) {
    return <View style={cardStyles}>{children}</View>;
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
      style={cardStyles}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
});