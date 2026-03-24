/**
 * Login Screen — Enhanced with gradient hero, animated form entrance, floating decorations
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  // Animations
  const fadeHeader = useRef(new Animated.Value(0)).current;
  const fadeForm = useRef(new Animated.Value(0)).current;
  const slideForm = useRef(new Animated.Value(40)).current;
  const fadeVersion = useRef(new Animated.Value(0)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
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
    Animated.stagger(250, [
      Animated.timing(fadeHeader, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeForm, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(slideForm, {
          toValue: 0,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(fadeVersion, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating orb
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(orbFloat, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fadeHeader, fadeForm, slideForm, fadeVersion, orbFloat]);

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Gradient hero top */}
      <LinearGradient
        colors={colors.gradient.splash}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
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
                    outputRange: [0, -15],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View style={styles.decorOrb2} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <Animated.View style={[styles.header, { opacity: fadeHeader }]}>
          <View style={styles.logoContainer}>
            <View style={[styles.iconBadge, shadows.xl]}>
              <MaterialCommunityIcons
                name="pulse"
                size={32}
                color={colors.primaryForeground}
              />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.title}>
                Epi<Text style={styles.titleHighlight}>Link</Text>
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle}>PHI Mobile Login</Text>
          <Text style={styles.tagline}>
            Dengue Risk Monitoring & Cleanup Management
          </Text>
        </Animated.View>

        {/* Form Card */}
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
          {error && <ErrorMessage message={error} />}

          <View style={styles.fieldContainer}>
            <View style={styles.fieldIconContainer}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.fieldInput}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Email"
                    placeholder="phi@epilink.gov.lk"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={value}
                    onChangeText={onChange}
                    error={errors.email?.message}
                  />
                )}
              />
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <View style={styles.fieldIconContainer}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.fieldInput}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Password"
                    placeholder="Enter your password"
                    secureTextEntry
                    value={value}
                    onChangeText={onChange}
                    error={errors.password?.message}
                  />
                )}
              />
            </View>
          </View>

          <View style={styles.rememberRow}>
            <Text style={styles.rememberText}>Remember me</Text>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              trackColor={{
                false: colors.border,
                true: colors.primaryLight,
              }}
              thumbColor={rememberMe ? colors.primary : colors.card}
            />
          </View>

          <Button
            title={isLoading ? "Signing in..." : "Sign In"}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            disabled={isLoading}
            variant="gradient"
            icon="login"
            size="large"
          />

          <Text style={styles.helpText}>
            Only PHI users can access the mobile app.
          </Text>
        </Animated.View>

        <Animated.Text style={[styles.versionText, { opacity: fadeVersion }]}>
          EpiLink v1.0.0
        </Animated.Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
  },
  decorOrb1: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: 30,
    right: -30,
  },
  decorOrb2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(74,222,128,0.08)",
    bottom: 20,
    left: 20,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  brandText: {
    justifyContent: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  titleHighlight: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  tagline: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    opacity: 0.6,
    textAlign: "center",
  },
  form: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius["2xl"],
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  fieldIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + "10",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    marginTop: 30,
  },
  fieldInput: {
    flex: 1,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  rememberText: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: typography.fontWeight.medium,
  },
  helpText: {
    marginTop: spacing.md,
    textAlign: "center",
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  versionText: {
    textAlign: "center",
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xl,
    opacity: 0.5,
  },
});
