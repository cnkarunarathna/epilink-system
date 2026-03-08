/**
 * Splash Screen — Enhanced with fade-in animation and tagline
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
} from "../../theme";

export const SplashScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      {/* Subtle background accent */}
      <View style={styles.bgAccent} />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
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
        <Text style={styles.tagline}>Dengue Risk Monitoring</Text>
      </Animated.View>

      <ActivityIndicator
        size="large"
        color={colors.primary}
        style={styles.loader}
      />

      <Text style={styles.footerText}>Epidemiology Unit, Sri Lanka</Text>
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
  bgAccent: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primary,
    opacity: 0.04,
  },
  content: {
    alignItems: "center",
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
    fontWeight: typography.fontWeight.medium,
  },
  tagline: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    opacity: 0.6,
  },
  loader: {
    marginTop: spacing.xl,
  },
  footerText: {
    position: "absolute",
    bottom: spacing.xxl,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    opacity: 0.4,
  },
});
