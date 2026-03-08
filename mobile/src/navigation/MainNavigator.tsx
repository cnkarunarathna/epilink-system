/**
 * Main Bottom Tab Navigator — Enhanced with custom styling, active indicator, haptics
 */

import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MainTabParamList } from "./types";
import { HomeScreen } from "../screens/home/HomeScreen";
import { TaskStackNavigator } from "./TaskStackNavigator";
import { TaskMapScreen } from "../screens/tasks/TaskMapScreen";
import { RiskMapScreen } from "../screens/risk/RiskMapScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { colors, spacing, borderRadius, shadows, typography } from "../theme";

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 0,
          height: 72 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 10,
          ...shadows.xl,
          ...Platform.select({
            ios: {
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
            },
            android: {
              elevation: 12,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: typography.fontWeight.semibold,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : undefined}>
              <MaterialCommunityIcons
                name="home-variant"
                size={focused ? 26 : 24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TaskStackNavigator}
        options={{
          tabBarLabel: "Tasks",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : undefined}>
              <MaterialCommunityIcons
                name="clipboard-list"
                size={focused ? 26 : 24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="TaskMap"
        component={TaskMapScreen}
        options={{
          tabBarLabel: "Map",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : undefined}>
              <MaterialCommunityIcons
                name="map-marker-radius"
                size={focused ? 26 : 24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="RiskMap"
        component={RiskMapScreen}
        options={{
          tabBarLabel: "Risk",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : undefined}>
              <MaterialCommunityIcons
                name="shield-alert"
                size={focused ? 26 : 24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : undefined}>
              <MaterialCommunityIcons
                name="account-circle"
                size={focused ? 26 : 24}
                color={color}
              />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  activeTab: {
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
    marginTop: 3,
  },
});
