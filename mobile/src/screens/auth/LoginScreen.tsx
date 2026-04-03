/**
 * Login Screen — Responsive, high-contrast layout with
 * staggered entrance, dynamic hero scaling, and polished form card.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Animated,
  Easing,
  TouchableOpacity,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../theme";
import { Button, Input, ErrorMessage } from "../../components/common";
import { loginSchema, LoginFormData } from "../../utils/validation";
import { useAuth } from "../../context/AuthContext";
import { getData, STORAGE_KEYS } from "../../utils/storage";

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = height < 700;
  const isLargeScreen = height > 900;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  // ── Animation refs ────────────────────────────────────────────────
  const fadeHeader = useRef(new Animated.Value(0)).current;
  const scaleHeader = useRef(new Animated.Value(0.92)).current;
  const fadeForm = useRef(new Animated.Value(0)).current;
  const slideForm = useRef(new Animated.Value(50)).current;
  const fadeVersion = useRef(new Animated.Value(0)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;
  const orbFloat2 = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    const loadRememberMe = async () => {
      const stored = await getData(STORAGE_KEYS.REMEMBER_ME);
      setRememberMe(stored === "true");
    };
    loadRememberMe();
  }, []);

  useEffect(() => {
    // Staggered entrance
    Animated.stagger(200, [
      Animated.parallel([
        Animated.timing(fadeHeader, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.spring(scaleHeader, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeForm, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(slideForm, {
          toValue: 0,
          tension: 45,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(fadeVersion, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating orb 1 (vertical)
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat, {
          toValue: 1,
          duration: 3800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(orbFloat, {
          toValue: 0,
          duration: 3800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Floating orb 2 (offset phase)
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat2, {
          toValue: 1,
          duration: 4800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(orbFloat2, {
          toValue: 0,
          duration: 4800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Icon badge gentle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.08,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fadeHeader, scaleHeader, fadeForm, slideForm, fadeVersion, orbFloat, orbFloat2, pulseScale]);

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      await login(data, rememberMe);
    } catch (err: any) {
      const message =
        err?.message || "Login failed. Please check your credentials.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic hero height based on screen size
  const heroHeight = isSmallScreen ? 200 : isLargeScreen ? 300 : 255;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.gradient.splash[0]} />

      {/* ── Hero Gradient ── */}
      <LinearGradient
        colors={colors.gradient.splash}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroGradient, { height: heroHeight }]}
      >
        {/* Decorative orbs */}
        <Animated.View
          style={[
            styles.decorOrb1,
            {
              transform: [
                {
                  translateY: orbFloat.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -18],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.decorOrb2,
            {
              transform: [
                {
                  translateY: orbFloat2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 14],
                  }),
                },
              ],
            },
          ]}
        />
        <View style={styles.decorOrb3} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: width > 400 ? spacing.xl : spacing.md,
            paddingTop: isSmallScreen ? spacing.xxl : spacing.xxxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header Section ── */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeHeader,
              transform: [{ scale: scaleHeader }],
              marginBottom: isSmallScreen ? spacing.md : spacing.xl,
            },
          ]}
        >
          {/* Logo row */}
          <View style={styles.logoContainer}>
            <Animated.View
              style={[
                styles.iconBadge,
                shadows.xl,
                { transform: [{ scale: pulseScale }] },
              ]}
            >
              <MaterialCommunityIcons
                name="pulse"
                size={isSmallScreen ? 26 : 32}
                color={colors.primaryForeground}
              />
            </Animated.View>
            <View style={styles.brandText}>
              <Text style={[styles.title, { fontSize: isSmallScreen ? 28 : 36 }]}>
                Epi<Text style={styles.titleHighlight}>Link</Text>
              </Text>
            </View>
          </View>

          {/* Divider pill */}
          <View style={styles.subtitlePill}>
            <MaterialCommunityIcons
              name="shield-check"
              size={13}
              color={colors.primaryForeground}
              style={{ marginRight: 5 }}
            />
            <Text style={styles.subtitlePillText}>PHI Mobile Login</Text>
          </View>

          <Text style={styles.tagline}>
            Dengue Risk Monitoring & Cleanup Management
          </Text>
        </Animated.View>

        {/* ── Form Card ── */}
        <Animated.View
          style={[
            styles.form,
            shadows.lg,
            {
              opacity: fadeForm,
              transform: [{ translateY: slideForm }],
            },
          ]}
        >
          {/* Top accent stripe with gradient */}
          <LinearGradient
            colors={["#1cb657", "#00823c"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.formAccentStripe}
          />

          {/* Card inner */}
          <View style={styles.formInner}>
            {/* Section label */}
            <Text style={styles.formSectionLabel}>Sign in to your account</Text>

            {error && <ErrorMessage message={error} />}

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Email Address"
                  placeholder="phi@epilink.gov.lk"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  leftIcon="email-outline"
                  value={value}
                  onChangeText={onChange}
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  secureTextEntry
                  leftIcon="lock-outline"
                  value={value}
                  onChangeText={onChange}
                  error={errors.password?.message}
                />
              )}
            />

            {/* Options row */}
            <View style={styles.optionsRow}>
              {/* Remember me */}
              <View style={styles.rememberLeft}>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  trackColor={{
                    false: colors.border,
                    true: colors.primaryLight,
                  }}
                  thumbColor={rememberMe ? colors.primary : "#f0f0f0"}
                  style={styles.switchCompact}
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </View>

              {/* Forgot password */}
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <Button
              title={isLoading ? "Signing in…" : "Sign In"}
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              disabled={isLoading}
              variant="gradient"
              icon="login"
              size="large"
            />

            {/* Info notice */}
            <View style={styles.helpRow}>
              <MaterialCommunityIcons
                name="information-outline"
                size={13}
                color={colors.textSecondary}
                style={{ marginTop: 1 }}
              />
              <Text style={styles.helpText}>
                Access is restricted to registered PHI officers only.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Footer ── */}
        <Animated.View style={[styles.footer, { opacity: fadeVersion }]}>
          <View style={styles.footerBadge}>
            <MaterialCommunityIcons
              name="shield-lock-outline"
              size={12}
              color={colors.textSecondary}
            />
            <Text style={styles.versionText}>EpiLink v1.0.0 · Secure</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // ── Root ──────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Hero ──────────────────────────────────────────────────────────
  heroGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
  },
  decorOrb1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: 20,
    right: -40,
  },
  decorOrb2: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(74,222,128,0.10)",
    bottom: 30,
    left: 24,
  },
  decorOrb3: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: 80,
    left: 60,
  },

  // ── Scroll content ────────────────────────────────────────────────
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: spacing.xl,
  },

  // ── Header ────────────────────────────────────────────────────────
  header: {
    alignItems: "center",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  brandText: {
    justifyContent: "center",
  },
  title: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
    letterSpacing: -0.5,
  },
  titleHighlight: {
    color: "#4ade80",
  },
  subtitlePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,130,60,0.55)",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  subtitlePillText: {
    fontSize: typography.fontSize.xs,
    color: colors.primaryForeground,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.4,
  },
  tagline: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.70)",
    textAlign: "center",
    letterSpacing: 0.2,
  },

  // ── Form Card ─────────────────────────────────────────────────────
  form: {
    backgroundColor: colors.card,
    borderRadius: borderRadius["3xl"],
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    // Subtle green-tinted shadow
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  formAccentStripe: {
    height: 4,
  },
  formInner: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  formSectionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: 0.1,
  },

  // ── Options row ───────────────────────────────────────────────────
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    marginTop: -spacing.xs,
  },
  rememberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  switchCompact: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  rememberText: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: typography.fontWeight.medium,
  },
  forgotPasswordText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },

  // ── Help row ──────────────────────────────────────────────────────
  helpRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  helpText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    lineHeight: typography.fontSize.xs * 1.6,
  },

  // ── Footer ────────────────────────────────────────────────────────
  footer: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  footerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.muted,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  versionText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: 0.3,
  },
});
