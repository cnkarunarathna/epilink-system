/**
 * Badge Component — Enhanced with glow and pulse animation
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
  Platform,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "../../theme";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info";
  size?: "small" | "medium";
  style?: ViewStyle;
  animated?: boolean;
  glow?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "default",
  size = "medium",
  style,
  animated = false,
  glow = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(animated ? 0.8 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (animated) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [animated, scaleAnim, opacityAnim]);

  const badgeColor = (() => {
    switch (variant) {
      case "success":
        return colors.success;
      case "warning":
        return colors.warning;
      case "error":
        return colors.error;
      case "info":
        return colors.info;
      default:
        return colors.muted;
    }
  })();

  const glowShadow =
    glow && variant !== "default" && Platform.OS === "ios"
      ? {
          shadowColor: badgeColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        }
      : {};

  const getBadgeStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.base,
      ...styles[size],
    };

    return {
      ...baseStyle,
      backgroundColor: variant === "default" ? colors.muted : badgeColor,
      ...glowShadow,
    };
  };

  const getTextStyle = (): TextStyle => {
    return {
      ...styles.text,
      ...styles[`${size}Text` as keyof typeof styles],
      color: variant === "default" ? colors.text : colors.primaryForeground,
    };
  };

  return (
    <Animated.View
      style={[
        getBadgeStyle(),
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      <Text style={getTextStyle()}>{label}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    alignSelf: "flex-start",
  },
  small: {
    paddingVertical: spacing.xs / 2,
  },
  medium: {
    paddingVertical: spacing.xs,
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.3,
  },
  smallText: {
    fontSize: typography.fontSize.xs,
  },
  mediumText: {
    fontSize: typography.fontSize.sm,
  },
});
