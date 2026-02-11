/**
 * Main Bottom Tab Navigator
 */

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MainTabParamList } from "./types";
import { TaskStackNavigator } from "./TaskStackNavigator";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { DevToolsScreen } from "../screens/dev/DevToolsScreen";
import { colors } from "../theme";

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tab.Screen
        name="Tasks"
        component={TaskStackNavigator}
        options={{
          tabBarLabel: "Tasks",
        }}
      />
      {/* Only show DevTools in development */}
      {__DEV__ && (
        <Tab.Screen
          name="DevTools"
          component={DevToolsScreen}
          options={{
            tabBarLabel: "Dev Tools",
          }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
        }}
      />
    </Tab.Navigator>
  );
};
