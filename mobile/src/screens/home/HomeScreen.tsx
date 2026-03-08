/**
 * Home Dashboard Screen — PHI-focused overview
 * Uses existing backend endpoints: /tasks/stats, /analytics/districts/latest
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { getTaskStats } from "../../api/taskService";
import {
  getDistrictLatest,
  DistrictPrediction,
} from "../../api/analyticsService";
import { TaskStats } from "../../types/task.types";
import { MainTabNavigationProp } from "../../navigation/types";

export const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<MainTabNavigationProp>();
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [districtRisk, setDistrictRisk] = useState<DistrictPrediction | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const fetchData = useCallback(
    async (refresh = false) => {
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      try {
        const [statsData, districtData] = await Promise.allSettled([
          getTaskStats(),
          getDistrictLatest(),
        ]);
        if (statsData.status === "fulfilled") setStats(statsData.value);
        if (districtData.status === "fulfilled" && user?.district) {
          const match = districtData.value.find(
            (d) => d.district.toLowerCase() === user.district?.toLowerCase(),
          );
          if (match) setDistrictRisk(match);
        }
      } catch {
        // silently handle
      } finally {
        refresh ? setIsRefreshing(false) : setIsLoading(false);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    },
    [user?.district, fadeAnim],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getRiskLevel = (cases: number) => {
    if (cases >= 100) return "Very High";
    if (cases >= 50) return "High";
    if (cases >= 25) return "Medium";
    if (cases >= 10) return "Low";
    return "Very Low";
  };

  const getRiskColor = (cases: number) => {
    if (cases >= 100) return colors.destructive;
    if (cases >= 50) return colors.warning;
    if (cases >= 25) return "#e5851e";
    if (cases >= 10) return colors.success;
    return colors.textSecondary;
  };

  const getRiskIcon = (cases: number): string => {
    if (cases >= 100) return "alert-octagon";
    if (cases >= 50) return "alert";
    if (cases >= 25) return "alert-circle-outline";
    if (cases >= 10) return "shield-check";
    return "help-circle-outline";
  };

  const statCards = [
    {
      label: "Assigned",
      value: stats?.assigned ?? 0,
      icon: "clipboard-clock-outline" as const,
      color: colors.status.assigned,
    },
    {
      label: "In Progress",
      value: stats?.inProgress ?? 0,
      icon: "progress-clock" as const,
      color: colors.status.in_progress,
    },
    {
      label: "Submitted",
      value: stats?.submitted ?? 0,
      icon: "clipboard-check-outline" as const,
      color: colors.status.submitted,
    },
    {
      label: "Completed",
      value: stats?.completed ?? 0,
      icon: "check-circle" as const,
      color: colors.status.completed,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.name || "PHI"}</Text>
            <View style={styles.rolePill}>
              <MaterialCommunityIcons
                name="shield-account"
                size={12}
                color={colors.primary}
              />
              <Text style={styles.roleText}>Public Health Inspector</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(user?.name || "P").charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* District info */}
        {user?.district && (
          <View style={styles.districtBanner}>
            <MaterialCommunityIcons
              name="map-marker"
              size={16}
              color={colors.primary}
            />
            <Text style={styles.districtText}>{user.district} District</Text>
          </View>
        )}

        {/* Overdue Alert */}
        {stats && stats.overdueCount > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => navigation.navigate("Tasks")}
            activeOpacity={0.8}
          >
            <View style={styles.alertIcon}>
              <MaterialCommunityIcons
                name="clock-alert"
                size={20}
                color={colors.destructive}
              />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>
                {stats.overdueCount} Overdue{" "}
                {stats.overdueCount === 1 ? "Task" : "Tasks"}
              </Text>
              <Text style={styles.alertSubtitle}>
                Tap to view and take action
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {/* Task Stats */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.sectionTitle}>My Task Overview</Text>
          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <View key={card.label} style={[styles.statCard, shadows.sm]}>
                <View
                  style={[
                    styles.statIconCircle,
                    { backgroundColor: card.color + "18" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={card.icon}
                    size={22}
                    color={card.color}
                  />
                </View>
                <Text style={styles.statValue}>{card.value}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* Total summary */}
          {stats && (
            <View style={[styles.totalCard, shadows.sm]}>
              <View style={styles.totalLeft}>
                <Text style={styles.totalLabel}>Total Tasks</Text>
                <Text style={styles.totalValue}>{stats.total}</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalRight}>
                <Text style={styles.totalLabel}>Rejected</Text>
                <Text
                  style={[styles.totalValue, { color: colors.destructive }]}
                >
                  {stats.rejected}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* District Risk */}
        {districtRisk && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.sectionTitle}>District Risk Level</Text>
            <View style={[styles.riskCard, shadows.sm]}>
              <View style={styles.riskHeader}>
                <View style={styles.riskLeft}>
                  <View
                    style={[
                      styles.riskIconCircle,
                      {
                        backgroundColor:
                          getRiskColor(districtRisk.predicted_cases) + "18",
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={getRiskIcon(districtRisk.predicted_cases) as any}
                      size={24}
                      color={getRiskColor(districtRisk.predicted_cases)}
                    />
                  </View>
                  <View>
                    <Text style={styles.riskDistrict}>
                      {districtRisk.district}
                    </Text>
                    <Text style={styles.riskWeek}>
                      Week {districtRisk.week}, {districtRisk.year}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.riskBadge,
                    {
                      backgroundColor:
                        getRiskColor(districtRisk.predicted_cases) + "18",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.riskBadgeText,
                      {
                        color: getRiskColor(districtRisk.predicted_cases),
                      },
                    ]}
                  >
                    {getRiskLevel(districtRisk.predicted_cases)}
                  </Text>
                </View>
              </View>
              <View style={styles.riskStats}>
                <View style={styles.riskStatItem}>
                  <MaterialCommunityIcons
                    name="virus"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.riskStatValue}>
                    {districtRisk.predicted_cases}
                  </Text>
                  <Text style={styles.riskStatLabel}>Cases</Text>
                </View>
                {districtRisk.temperature != null && (
                  <View style={styles.riskStatItem}>
                    <MaterialCommunityIcons
                      name="thermometer"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.riskStatValue}>
                      {districtRisk.temperature.toFixed(1)}°
                    </Text>
                    <Text style={styles.riskStatLabel}>Temp</Text>
                  </View>
                )}
                {districtRisk.precipitation != null && (
                  <View style={styles.riskStatItem}>
                    <MaterialCommunityIcons
                      name="weather-rainy"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.riskStatValue}>
                      {districtRisk.precipitation.toFixed(0)}mm
                    </Text>
                    <Text style={styles.riskStatLabel}>Rain</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionCard, shadows.sm]}
            onPress={() => navigation.navigate("Tasks")}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.primary + "15" },
              ]}
            >
              <MaterialCommunityIcons
                name="clipboard-list"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={styles.actionText}>View Tasks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, shadows.sm]}
            onPress={() => navigation.navigate("TaskMap")}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.primaryDark + "15" },
              ]}
            >
              <MaterialCommunityIcons
                name="map-marker-radius"
                size={24}
                color={colors.primaryDark}
              />
            </View>
            <Text style={styles.actionText}>Task Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, shadows.sm]}
            onPress={() => navigation.navigate("Profile")}
            activeOpacity={0.7}
          >
            <View
              style={[styles.actionIcon, { backgroundColor: colors.accent }]}
            >
              <MaterialCommunityIcons
                name="account-circle"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={styles.actionText}>Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    marginLeft: spacing.md,
  },
  greeting: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  userName: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary + "12",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  roleText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  districtBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
  },
  districtText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.secondaryForeground,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.destructive + "0C",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.destructive + "25",
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.destructive + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.destructive,
  },
  alertSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    width: "48%" as any,
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2,
  },
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalLeft: {
    flex: 1,
    alignItems: "center",
  },
  totalDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  totalRight: {
    flex: 1,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  totalValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  riskCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  riskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  riskLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  riskIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  riskDistrict: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  riskWeek: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  riskBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  riskBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  riskStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  riskStatItem: {
    alignItems: "center",
    gap: 2,
  },
  riskStatValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  riskStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  actionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    textAlign: "center",
  },
});
