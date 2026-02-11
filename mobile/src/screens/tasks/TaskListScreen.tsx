/**
 * Task List Screen - Placeholder
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../theme";

export const TaskListScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Task List</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
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
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
