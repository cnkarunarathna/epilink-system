/**
 * Card Component
 */

import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing, borderRadius, shadows } from "../../theme";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  shadow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  shadow = true,
}) => {
  return (
    <View style={[styles.card, shadow && shadows.md, style]}>{children}</View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
