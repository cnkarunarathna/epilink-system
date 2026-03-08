/**
 * Splash Screen — Enhanced with multi-stage staggered animations, gradient bg, pulsating ring
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
} from "../../theme";

export const SplashScreen: React.FC = () => {
  const fadeIcon = useRef(new Animated.Value(0)).current;
  const scaleIcon = useRef(new Animated.Value(0.5)).current;
  const fadeTitle = useRef(new Animated.Value(0)).current;
  const slideTitle = useRef(new Animated.Value(20)).current;
  const fadeTagline = useRef(new Animated.Value(0)).current;
  const fadeLoader = useRef(new Animated.Value(0)).current;
  const fadeFooter = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(0.4)).current;
  const scaleRing = useRef(new Animated.Value(0.8)).current;

  // Decorative orb animations
  const orbFloat1 = useRef(new Animated.Value(0)).current;
  const orbFloat2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance
    Animated.stagger(200, [
      // 1. Icon entrance
      Animated.parallel([
        Animated.spring(scaleIcon, {
          toValue: 1,
          tension: 40,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(fadeIcon, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // 2. Title slide up
      Animated.parallel([
        Animated.timing(fadeTitle, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideTitle, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // 3. Tagline
      Animated.timing(fadeTagline, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // 4. Loader
      Animated.timing(fadeLoader, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // 5. Footer
      Animated.timing(fadeFooter, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsating ring loop
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseRing, {
            toValue: 0.8,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleRing, {
            toValue: 1.3,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseRing, {
            toValue: 0.2,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleRing, {
            toValue: 0.8,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();

    // Floating orbs
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat1, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(orbFloat1, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat2, {
          toValue: 1,
          duration: 5000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(orbFloat2, {
          toValue: 0,
          duration: 5000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [
    fadeIcon,
    scaleIcon,
    fadeTitle,
    slideTitle,
    fadeTagline,
    fadeLoader,
    fadeFooter,
    pulseRing,
    scaleRing,
    orbFloat1,
    orbFloat2,
  ]);

  return (
    <LinearGradient
      colors={colors.gradient.splash}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Floating decorative orbs */}
      <Animated.View
        style={[
          styles.orb1,
          {
            transform: [
              {
                translateY: orbFloat1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -20],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb2,
          {
            transform: [
              {
                translateY: orbFloat2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 15],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb3,
          {
            transform: [
              {
                translateX: orbFloat1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 10],
                }),
              },
            ],
          },
        ]}
      />

      <View style={styles.content}>
        {/* Pulsating ring behind icon */}
        <View style={styles.iconWrapper}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                opacity: pulseRing,
                transform: [{ scale: scaleRing }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.iconBadge,
              shadows.xl,
              {
                opacity: fadeIcon,
                transform: [{ scale: scaleIcon }],
              },
            ]}
          >
            <MaterialCommunityIcons
              name="pulse"
              size={44}
              color={colors.primaryForeground}
            />
          </Animated.View>
        </View>

        {/* Title */}
        <Animated.View
          style={{
            opacity: fadeTitle,
            transform: [{ translateY: slideTitle }],
          }}
        >
          <Text style={styles.title}>
            Epi<Text style={styles.titleHighlight}>Link</Text>
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={{ opacity: fadeTagline }}>
          <Text style={styles.subtitle}>PHI Mobile</Text>
          <Text style={styles.tagline}>Dengue Risk Monitoring & Action</Text>
        </Animated.View>
      </View>

      {/* Loader */}
      <Animated.View style={[styles.loaderContainer, { opacity: fadeLoader }]}>
        <ActivityIndicator size="large" color="rgba(255,255,255,0.7)" />
      </Animated.View>

      {/* Footer */}
      <Animated.Text style={[styles.footerText, { opacity: fadeFooter }]}>
        Epidemiology Unit, Sri Lanka
      </Animated.Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    width: 120,
    height: 120,
  },
  pulseRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: borderRadius["2xl"],
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  title: {
    fontSize: 44,
    fontWeight: typography.fontWeight.bold,
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
  },
  titleHighlight: {
    color: "#4ade80",
  },
  subtitle: {
    fontSize: 20,
    color: "rgba(255,255,255,0.8)",
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  tagline: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.5)",
    marginTop: spacing.xs,
    textAlign: "center",
  },
  loaderContainer: {
    marginTop: spacing.xxl,
  },
  footerText: {
    position: "absolute",
    bottom: spacing.xxl,
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.5,
  },
  // Decorative orbs
  orb1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.04)",
    top: "15%",
    right: -40,
  },
  orb2: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(74,222,128,0.06)",
    bottom: "20%",
    left: -30,
  },
  orb3: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.03)",
    top: "40%",
    left: 40,
  },
});
