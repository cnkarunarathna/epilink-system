/**
 * ShimmerPlaceholder — Lightweight shimmer loading skeleton
 */

import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, ViewStyle } from "react-native";
import { colors, borderRadius } from "../../theme";

interface ShimmerPlaceholderProps {
  width?: number | string;
  height?: number;
  borderRadiusValue?: number;
  style?: ViewStyle;
}

export const ShimmerPlaceholder: React.FC<ShimmerPlaceholderProps> = ({
  width = "100%",
  height = 16,
  borderRadiusValue = borderRadius.md,
  style,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width: width as any,
          height,
          borderRadius: borderRadiusValue,
          opacity,
        },
        style,
      ]}
    />
  );
};

/** Pre-built card skeleton */
export const ShimmerCardSkeleton: React.FC<{ count?: number }> = ({
  count = 3,
}) => {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <ShimmerPlaceholder width="60%" height={14} />
          <ShimmerPlaceholder
            width="90%"
            height={10}
            style={{ marginTop: 10 }}
          />
          <ShimmerPlaceholder
            width="40%"
            height={10}
            style={{ marginTop: 8 }}
          />
          <View style={styles.skeletonFooter}>
            <ShimmerPlaceholder width={80} height={10} />
            <ShimmerPlaceholder width={60} height={10} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.border,
  },
  skeletonContainer: {
    padding: 24,
    gap: 16,
  },
  skeletonCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skeletonFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
