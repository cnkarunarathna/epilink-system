/**
 * Main Bottom Tab Navigator — Custom floating tab bar
 *
 * Tab bar: Home | Tasks | Map | Risk | My Route
 * Profile is hidden from tab bar — accessible by tapping the avatar on the Home screen.
 *
 * Design:
 *  - Floating pill container with rounded-full shape, card bg, green-tinted shadow
 *  - Active tab: gradient pill background + icon (white) + label (white bold) with spring scale-in
 *  - Inactive tab: icon only (muted color) + spring scale-down on deactivation
 *  - Haptic feedback on every tab press
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Animated,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MainTabParamList } from "./types";
import { HomeScreen } from "../screens/home/HomeScreen";
import { TaskStackNavigator } from "./TaskStackNavigator";
import { TaskMapScreen } from "../screens/tasks/TaskMapScreen";
import { RiskMapScreen } from "../screens/risk/RiskMapScreen";
import { RouteScreen } from "../screens/tasks/RouteScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";
import { colors, spacing, borderRadius, typography, animation } from "../theme";

// ─── Tab config ──────────────────────────────────────────────────────────────

type TabConfig = {
  name: keyof MainTabParamList;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconFocused: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
};

const TAB_CONFIG: TabConfig[] = [
  {
    name: "Home",
    label: "Home",
    icon: "home-variant-outline",
    iconFocused: "home-variant",
  },
  {
    name: "Tasks",
    label: "Tasks",
    icon: "clipboard-list-outline",
    iconFocused: "clipboard-list",
  },
  {
    name: "TaskMap",
    label: "Map",
    icon: "map-outline",
    iconFocused: "map-marker-radius",
  },
  {
    name: "RiskMap",
    label: "Risk",
    icon: "shield-outline",
    iconFocused: "shield-alert",
  },
  {
    name: "Route",
    label: "Route",
    icon: "map-marker-path",
    iconFocused: "map-marker-path",
  },
];

// ─── Single tab item ──────────────────────────────────────────────────────────

interface TabItemProps {
  config: TabConfig;
  focused: boolean;
  onPress: () => void;
}

type NestedRoute = {
  name: string;
  state?: {
    index: number;
    routes: NestedRoute[];
  };
};

const getDeepFocusedRouteName = (route: NestedRoute): string => {
  let current = route;
  while (current.state?.routes && typeof current.state.index === "number") {
    const next = current.state.routes[current.state.index];
    if (!next) break;
    current = next;
  }
  return current.name;
};

const TabItem: React.FC<TabItemProps> = ({ config, focused, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.92)).current;
  const labelOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.92,
        ...animation.spring.bouncy,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: focused ? 1 : 0,
        duration: focused ? animation.normal : animation.fast,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  const iconName = focused ? config.iconFocused : config.icon;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.tabItem}
    >
      <Animated.View
        style={[styles.tabItemInner, { transform: [{ scale: scaleAnim }] }]}
      >
        {focused ? (
          // Active: gradient pill with icon + label
          <LinearGradient
            colors={colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activePill}
          >
            <MaterialCommunityIcons
              name={iconName}
              size={20}
              color={colors.primaryForeground}
            />
            <Animated.Text
              style={[styles.activeLabel, { opacity: labelOpacity }]}
              numberOfLines={1}
            >
              {config.label}
            </Animated.Text>
          </LinearGradient>
        ) : (
          // Inactive: icon only
          <View style={styles.inactiveIcon}>
            <MaterialCommunityIcons
              name={iconName}
              size={22}
              color={colors.textSecondary}
            />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Custom floating tab bar ─────────────────────────────────────────────────

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const mountAnim = useRef(new Animated.Value(0)).current;

  // Slide up on mount
  useEffect(() => {
    Animated.spring(mountAnim, {
      toValue: 1,
      delay: 200,
      ...animation.spring.gentle,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleTabPress = (routeName: string, isFocused: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isFocused) {
      navigation.navigate(routeName);
    }
  };

  const visibleTabs = TAB_CONFIG; // exactly matches the 5 visible tabs
  const activeTabRoute = state.routes[state.index] as unknown as NestedRoute;
  const activeNestedRouteName = getDeepFocusedRouteName(activeTabRoute);

  // Hide bottom bar on full-screen Chat route for focused messaging UX
  if (activeTabRoute.name === "Tasks" && activeNestedRouteName === "Chat") {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.barWrapper,
        {
          paddingBottom: insets.bottom + spacing.sm,
          transform: [
            {
              translateY: mountAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              }),
            },
          ],
          opacity: mountAnim,
        },
      ]}
    >
      <View style={styles.barContainer}>
        {visibleTabs.map((config) => {
          const routeIndex = state.routes.findIndex(
            (r) => r.name === config.name,
          );
          const isFocused = state.index === routeIndex;

          return (
            <TabItem
              key={config.name}
              config={config}
              focused={isFocused}
              onPress={() => handleTabPress(config.name, isFocused)}
            />
          );
        })}
      </View>
    </Animated.View>
  );
};

// ─── Navigator ────────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Tasks" component={TaskStackNavigator} />
      <Tab.Screen name="TaskMap" component={TaskMapScreen} />
      <Tab.Screen name="RiskMap" component={RiskMapScreen} />
      <Tab.Screen name="Route" component={RouteScreen} />
      {/* Profile — hidden from bar, navigated via Home screen avatar */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarButton: () => null }}
      />
      {/* Notifications — hidden from bar, navigated via Home screen bell */}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  barWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  barContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius["3xl"],
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    // Layered shadow — elevation + colored outer glow
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
    // Inner border for glass effect
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  tabItemInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    // Glow under active pill on iOS
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  activeLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
    letterSpacing: 0.2,
  },
  inactiveIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
