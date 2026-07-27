import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { colors, spacing, borderRadius } from "@/constants/theme";

interface PulseBlockProps {
  width: number | string;
  height: number;
  br?: number;
  style?: object;
  opacity: Animated.Value;
}

function PulseBlock({ width, height, br, style, opacity }: PulseBlockProps) {
  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: br ?? 4,
          backgroundColor: "#e0e0e0",
          opacity,
        },
        style,
      ]}
    />
  );
}

export default function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={styles.container}>
      {/* Image skeleton */}
      <PulseBlock width="100%" height={200} br={0} opacity={opacity} />

      {/* Info skeleton */}
      <View style={styles.infoContainer}>
        <PulseBlock width="70%" height={18} opacity={opacity} />
        <View style={styles.metaRow}>
          <View style={styles.creatorRow}>
            <PulseBlock width={20} height={20} br={10} opacity={opacity} />
            <PulseBlock width={80} height={14} opacity={opacity} />
          </View>
          <PulseBlock width={40} height={14} opacity={opacity} />
        </View>
        <PulseBlock width={50} height={16} br={8} opacity={opacity} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  infoContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
  },
});
