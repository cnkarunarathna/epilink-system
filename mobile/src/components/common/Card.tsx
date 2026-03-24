/**
 * Card Component — Enhanced with glass variant
 */

import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing, borderRadius, shadows } from "../../theme";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  shadow?: boolean;
  variant?: "default" | "glass";
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  shadow = true,
  variant = "default",
}) => {
  const isGlass = variant === "glass";

  return (
    <View
      style={[
        styles.card,
        isGlass && styles.glass,
        shadow && shadows.md,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  glass: {
    backgroundColor: colors.glass.card,
    borderColor: colors.glass.border,
  },
});
