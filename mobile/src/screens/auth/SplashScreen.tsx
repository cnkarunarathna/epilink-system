/**
 * Splash Screen - Initial loading screen
 */

import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
} from "../../theme";

export const SplashScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={[styles.iconBadge, shadows.lg]}>
          <MaterialCommunityIcons
            name="pulse"
            size={40}
            color={colors.primaryForeground}
          />
        </View>
        <View style={styles.brandText}>
          <Text style={styles.title}>
            Epi<Text style={styles.titleHighlight}>Link</Text>
          </Text>
        </View>
      </View>
      <Text style={styles.subtitle}>PHI Mobile</Text>
      <ActivityIndicator
        size="large"
        color={colors.primary}
        style={styles.loader}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  brandText: {
    justifyContent: "center",
  },
  title: {
    fontSize: 40,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  titleHighlight: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  loader: {
    marginTop: spacing.lg,
  },
});
