/**
 * EpiLink PHI Mobile App
 * Main application entry point
 */

import React from "react";
import { StatusBar as RNStatusBar, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { AuthProvider } from "./src/context/AuthContext";
import { ToastProvider } from "./src/context/ToastContext";
import { ToastContainer } from "./src/components/common/Toast";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            <StatusBar
              style="dark"
              backgroundColor="#ffffff"
              translucent={false}
            />
            <RootNavigator />
            <ToastContainer />
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
