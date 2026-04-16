/**
 * Notifications Screen
 * Phase A: derives actionable alerts from existing API data (no push token needed).
 *
 * Alert sources:
 *  - Overdue tasks  → from task stats
 *  - Rejected tasks → from task stats
 *  - High/Very High district risk prediction → from analytics
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { getTaskStats } from "../../api/taskService";
import { getDistrictLatest } from "../../api/analyticsService";
import { useAuth } from "../../context/AuthContext";
import { MainTabNavigationProp } from "../../navigation/types";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animation,
} from "../../theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = "critical" | "warning" | "info";

interface NotificationItem {
  id: string;
  severity: AlertSeverity;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
  body: string;
  action?: {
    label: string;
    screen: keyof MainTabNavigationProp["navigate"] extends never ? any : any;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityColor(s: AlertSeverity): string {
  switch (s) {
    case "critical":
      return colors.destructive;
    case "warning":
      return colors.warning;
    case "info":
      return colors.primary;
  }
}

function severityBg(s: AlertSeverity): string {
  switch (s) {
    case "critical":
      return colors.destructive + "12";
    case "warning":
      return colors.warning + "12";
    case "info":
      return colors.primary + "10";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<MainTabNavigationProp>();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Entrance animation
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  const buildAlerts = useCallback(
    async (refresh = false) => {
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      const items: NotificationItem[] = [];

      try {
        const [statsResult, districtResult] = await Promise.allSettled([
          getTaskStats(),
          getDistrictLatest(),
        ]);

        if (statsResult.status === "fulfilled") {
          const s = statsResult.value;

          if (s.overdueCount > 0) {
            items.push({
              id: "overdue",
              severity: s.overdueCount >= 5 ? "critical" : "warning",
              icon: "clock-alert",
              title: `${s.overdueCount} Overdue Task${s.overdueCount !== 1 ? "s" : ""}`,
              body: "These tasks have passed their due date. Review and take action as soon as possible.",
              action: { label: "View Tasks", screen: "Tasks" },
            });
          }

          if (s.rejected > 0) {
            items.push({
              id: "rejected",
              severity: "warning",
              icon: "close-circle-outline",
              title: `${s.rejected} Rejected Task${s.rejected !== 1 ? "s" : ""}`,
              body: "Some of your submitted tasks were rejected. Open them to view the reason and resubmit.",
              action: { label: "View Tasks", screen: "Tasks" },
            });
          }
        }

        if (districtResult.status === "fulfilled" && user?.district) {
          const match = districtResult.value.find(
            (d) => d.district.toLowerCase() === user.district?.toLowerCase(),
          );
          if (match) {
            const cases = match.predicted_cases;
            if (cases >= 50) {
              items.push({
                id: "risk-high",
                severity: cases >= 100 ? "critical" : "warning",
                icon: cases >= 100 ? "alert-octagon" : "alert",
                title: `${cases >= 100 ? "Very High" : "High"} Disease Risk — ${match.district}`,
                body: `Predicted ${cases} cases for Week ${match.week}, ${match.year}. Prioritise inspections in high-density areas.`,
                action: { label: "View Risk Map", screen: "RiskMap" },
              });
            }
          }
        }
      } catch {
        // Partial failure is fine — show whatever was collected
      } finally {
        refresh ? setIsRefreshing(false) : setIsLoading(false);
      }

      if (items.length === 0) {
        items.push({
          id: "all-clear",
          severity: "info",
          icon: "check-circle-outline",
          title: "All Clear",
          body: "No overdue tasks, rejections, or high-risk alerts right now. Keep up the great work!",
        });
      }

      setAlerts(items);

      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(slideUp, {
          toValue: 0,
          ...animation.spring.gentle,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [user?.district, fadeIn, slideUp],
  );

  useEffect(() => {
    buildAlerts();
  }, [buildAlerts]);

  const handleAction = (screen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screen as any);
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: NotificationItem;
    index: number;
  }) => {
    const accent = severityColor(item.severity);
    const bg = severityBg(item.severity);

    return (
      <Animated.View
        style={{
          opacity: fadeIn,
          transform: [{ translateY: slideUp }],
        }}
      >
        <View style={[styles.card, shadows.sm, { borderColor: accent + "30" }]}>
          {/* Left accent bar */}
          <View style={[styles.cardAccent, { backgroundColor: accent }]} />

          <View style={styles.cardBody}>
            {/* Icon + title row */}
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: bg }]}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={20}
                  color={accent}
                />
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>

            {/* Body */}
            <Text style={styles.cardBody2}>{item.body}</Text>

            {/* Action */}
            {item.action && (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { borderColor: accent + "50", backgroundColor: bg },
                ]}
                onPress={() => handleAction(item.action!.screen)}
                activeOpacity={0.75}
              >
                <Text style={[styles.actionText, { color: accent }]}>
                  {item.action.label}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={14}
                  color={accent}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <LinearGradient
        colors={colors.gradient.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.decorCircle} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={colors.primaryForeground}
            />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSub}>Alerts for your district</Text>
          </View>
          {alerts.length > 0 && alerts[0].id !== "all-clear" && (
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{alerts.length}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* List */}
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => buildAlerts(true)}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons
                name="bell-sleep-outline"
                size={48}
                color={colors.border}
              />
              <Text style={styles.emptyText}>No alerts right now</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius["3xl"],
    borderBottomRightRadius: borderRadius["3xl"],
    overflow: "hidden",
    position: "relative",
  },
  decorCircle: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -30,
    right: -20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  headerSub: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  badgePill: {
    backgroundColor: colors.destructive,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  badgePillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 120,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 96,
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  cardBody: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  cardTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    lineHeight: 22,
  },
  cardBody2: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "space-between",
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.xs,
    minHeight: 44,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
});
