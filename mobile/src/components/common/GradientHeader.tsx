/**
 * GradientHeader — Reusable header with LinearGradient background
 */

import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, typography, borderRadius } from "../../theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  rightAccessory?: React.ReactNode;
  gradientColors?: readonly [string, string, ...string[]];
  style?: ViewStyle;
  compact?: boolean;
}

export const GradientHeader: React.FC<GradientHeaderProps> = ({
  title,
  subtitle,
  icon,
  rightAccessory,
  gradientColors = colors.gradient.header,
  style,
  compact = false,
}) => {
  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[compact ? styles.containerCompact : styles.container, style]}
    >
      <View style={styles.content}>
        <View style={styles.left}>
          {icon && (
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name={icon}
                size={compact ? 18 : 22}
                color={colors.primaryForeground}
              />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text
              style={compact ? styles.titleCompact : styles.title}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {rightAccessory && <View style={styles.right}>{rightAccessory}</View>}
      </View>

      {/* Decorative circle overlays */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    overflow: "hidden",
    position: "relative",
  },
  containerCompact: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    overflow: "hidden",
    position: "relative",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  titleCompact: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  right: {
    marginLeft: spacing.md,
  },
  decorCircle1: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -40,
    right: -20,
  },
  decorCircle2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -30,
    left: 40,
  },
});
