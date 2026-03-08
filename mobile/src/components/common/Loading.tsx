/**
 * Loading Component
 */

import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../../theme";

interface LoadingProps {
  message?: string;
  fullscreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  message,
  fullscreen = true,
}) => {
  return (
    <View style={fullscreen ? styles.fullscreen : styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  container: {
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  message: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
});
