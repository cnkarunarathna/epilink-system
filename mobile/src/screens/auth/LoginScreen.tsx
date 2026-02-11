/**
 * Login Screen
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { colors, spacing, typography } from "../../theme";
import { Button, Input, ErrorMessage } from "../../components/common";
import { loginSchema, LoginFormData } from "../../utils/validation";
import { useAuth } from "../../context/AuthContext";
import { getData, STORAGE_KEYS } from "../../utils/storage";

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>EpiLink</Text>
          <Text style={styles.subtitle}>PHI Mobile Login</Text>
        </View>

        <View style={styles.form}>
          {error && <ErrorMessage message={error} />}

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
            style={styles.submitButton}
          />

          <Text style={styles.helpText}>
            Only PHI users can access the mobile app.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
  submitButton: {
    marginTop: spacing.sm,
  },
  helpText: {
    marginTop: spacing.md,
    textAlign: "center",
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
});
