/**
 * EmptyState — contextual empty list/screen placeholder
 * Icon + title + optional subtitle + optional CTA button
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing, typography, borderRadius } from "../../theme";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  action,
}) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.muted, colors.border]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconCircle}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={44}
          color={colors.textSecondary}
        />
      </LinearGradient>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant="outline"
          size="small"
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxWidth: 360,
    alignSelf: "center",
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: "center",
    lineHeight: 22,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
});
