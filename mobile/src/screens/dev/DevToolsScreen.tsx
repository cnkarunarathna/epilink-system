/**
 * Development Tools Screen
 * Shows API connection status and testing utilities
 * Only available in development mode
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { colors, spacing, typography, borderRadius } from "../../theme";
import { Card, Button, Loading } from "../../components/common";
import { API_CONFIG } from "../../utils/constants";
import {
  testBackendConnection,
  testLogin,
  getConnectionDiagnostics,
} from "../../utils/healthCheck";

export const DevToolsScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [lastTest, setLastTest] = useState<Date | null>(null);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const diagnostics = await getConnectionDiagnostics();
      setConnectionStatus(diagnostics);
      setLastTest(new Date());
    } catch (error) {
      console.error("Diagnostics failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const testLoginWithPHI = async () => {
    setIsLoading(true);
    try {
      const result = await testLogin("phi@epilink.gov.lk", "Phi@123");
      Alert.alert(result.success ? "✅ Success" : "❌ Failed", result.message, [
        { text: "OK" },
      ]);
    } catch (error: any) {
      Alert.alert("❌ Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !connectionStatus) {
    return <Loading message="Running diagnostics..." />;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Development Tools</Text>
        <Text style={styles.subtitle}>Backend Connection Testing</Text>
      </View>

      {/* API Configuration */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>API Configuration</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Base URL:</Text>
          <Text style={styles.value}>{API_CONFIG.BASE_URL}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Timeout:</Text>
          <Text style={styles.value}>{API_CONFIG.TIMEOUT}ms</Text>
        </View>
        {lastTest && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Last Test:</Text>
            <Text style={styles.value}>{lastTest.toLocaleTimeString()}</Text>
          </View>
        )}
      </Card>

      {/* Connection Status */}
      {connectionStatus && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          {connectionStatus.tests.map((test: any, index: number) => (
            <View key={index} style={styles.testResult}>
              <Text style={styles.testStatus}>
                {test.success ? "✅" : "❌"}
              </Text>
              <View style={styles.testDetails}>
                <Text style={styles.testMessage}>{test.message}</Text>
                {test.details && (
                  <Text style={styles.testDetailsText}>
                    {JSON.stringify(test.details, null, 2)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Action Buttons */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Test Actions</Text>
        <Button
          title="🔄 Refresh Connection Test"
          onPress={runDiagnostics}
          disabled={isLoading}
          style={styles.button}
        />
        <Button
          title="🔐 Test PHI Login"
          onPress={testLoginWithPHI}
          disabled={isLoading}
          variant="secondary"
          style={styles.button}
        />
      </Card>

      {/* Help Section */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Troubleshooting</Text>
        <Text style={styles.helpText}>
          • iOS Simulator: Backend should be at localhost:3001{"\n"}• Android
          Emulator: Backend should be at 10.0.2.2:3001{"\n"}• Physical Device:
          Use your computer's local IP{"\n"}• Make sure backend is running with
          'npm run start:dev'
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.primaryForeground,
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  section: {
    margin: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  value: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    flex: 1,
    textAlign: "right",
    fontFamily: "monospace",
  },
  testResult: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  testStatus: {
    fontSize: typography.fontSize.xl,
    marginRight: spacing.sm,
  },
  testDetails: {
    flex: 1,
  },
  testMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  testDetailsText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontFamily: "monospace",
    backgroundColor: colors.muted,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  button: {
    marginBottom: spacing.sm,
  },
  helpText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
