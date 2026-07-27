import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@/constants/theme";

interface MarketplaceHeaderProps {
  totalCount: number;
}

export default function MarketplaceHeader({
  totalCount,
}: MarketplaceHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Marketplace</Text>
      <Text style={styles.subtitle}>
        {totalCount > 0
          ? `${totalCount} NFT${totalCount !== 1 ? "s" : ""} available`
          : "Browse and collect unique NFTs"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
