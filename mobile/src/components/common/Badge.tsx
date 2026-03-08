/**
 * Badge Component
 */

import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { colors, spacing, borderRadius, typography } from "../../theme";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info";
  size?: "small" | "medium";
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "default",
  size = "medium",
  style,
}) => {
  const getBadgeStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.base,
      ...styles[size],
    };

    switch (variant) {
      case "success":
        return { ...baseStyle, backgroundColor: colors.success };
      case "warning":
        return { ...baseStyle, backgroundColor: colors.warning };
      case "error":
        return { ...baseStyle, backgroundColor: colors.error };
      case "info":
        return { ...baseStyle, backgroundColor: colors.info };
      default:
        return { ...baseStyle, backgroundColor: colors.muted };
    }
  };

  const getTextStyle = (): TextStyle => {
    return {
      ...styles.text,
      ...styles[`${size}Text` as keyof typeof styles],
      color: variant === "default" ? colors.text : colors.primaryForeground,
    };
  };

  return (
    <View style={[getBadgeStyle(), style]}>
      <Text style={getTextStyle()}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
  },
  small: {
    paddingVertical: spacing.xs / 2,
  },
  medium: {
    paddingVertical: spacing.xs,
  },
  text: {
    fontWeight: typography.fontWeight.medium,
  },
  smallText: {
    fontSize: typography.fontSize.xs,
  },
  mediumText: {
    fontSize: typography.fontSize.sm,
  },
});
