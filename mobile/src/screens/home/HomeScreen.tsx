/**
 * Home Dashboard Screen — Enhanced with gradient header, staggered animations,
 * animated counters, and premium card design
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animation,
} from "../../theme";
import { AnimatedCounter } from "../../components/common";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getTaskStats } from "../../api/taskService";
import {
  getDistrictLatest,
  DistrictPrediction,
} from "../../api/analyticsService";
import { TaskStats } from "../../types/task.types";
import { MainTabNavigationProp } from "../../navigation/types";
import {
  scale,
  TAB_BAR_HEIGHT,
  HEADER_PADDING_BOTTOM,
} from "../../utils/responsive";

// ─── Module-level constants ───────────────────────────────────────────────────

const STALE_TIME_MS = 30_000; // 30-second stale threshold — prevents re-fetch on tab focus

// Stats card width: two cards + one gap fit exactly within the horizontal padding
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.floor(
  (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2,
);

// ─── ActionCard — hoisted to module scope so React never re-creates the type ──
// Defining this inside HomeScreen would cause every HomeScreen render to create
// a *new* component type, forcing all three cards to fully unmount + remount.

interface ActionCardProps {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

const ActionCard = React.memo<ActionCardProps>(({ icon, label, color, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.93,
      ...animation.spring.snappy,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...animation.spring.bouncy,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.actionCard, shadows.md]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <LinearGradient
          colors={[color + "15", color + "08"]}
          style={styles.actionIcon}
        >
          <MaterialCommunityIcons
            name={icon as any}
            size={24}
            color={color}
          />
        </LinearGradient>
        <Text style={styles.actionText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<MainTabNavigationProp>();
  const insets = useSafeAreaInsets();
  const scrollPaddingBottom = TAB_BAR_HEIGHT + insets.bottom + spacing.lg;
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [districtRisk, setDistrictRisk] = useState<DistrictPrediction | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Alert banner pulse (fires when overdue tasks >= 3)
  const alertPulse = useRef(new Animated.Value(0.2)).current;
  const alertPulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (stats && stats.overdueCount >= 3) {
      alertPulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(alertPulse, {
            toValue: 0.65,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(alertPulse, {
            toValue: 0.2,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      alertPulseLoop.current.start();
    } else {
      alertPulseLoop.current?.stop();
      alertPulse.setValue(0.2);
    }
    return () => alertPulseLoop.current?.stop();
  }, [stats?.overdueCount]);

  // Stale-time gate — prevent re-fetch within 30 s of the last fetch
  const lastFetchTime = useRef<number>(0);

  // Staggered entrance anims
  const fadeHeader = useRef(new Animated.Value(0)).current;
  const fadeAlert = useRef(new Animated.Value(0)).current;
  const fadeStats = useRef(new Animated.Value(0)).current;
  const slideStats = useRef(new Animated.Value(30)).current;
  const fadeRisk = useRef(new Animated.Value(0)).current;
  const slideRisk = useRef(new Animated.Value(30)).current;
  const fadeActions = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(
    async (refresh = false) => {
      const now = Date.now();
      if (!refresh && now - lastFetchTime.current < STALE_TIME_MS) return;
      lastFetchTime.current = now;

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
        if (refresh) showToast({ message: "Dashboard updated.", variant: "info" });
        // Content sections stagger in after data arrives; header animates separately on mount
        Animated.stagger(120, [
          Animated.timing(fadeAlert, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(fadeStats, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(slideStats, {
              toValue: 0,
              ...animation.spring.gentle,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(fadeRisk, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(slideRisk, {
              toValue: 0,
              ...animation.spring.gentle,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(fadeActions, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
    // Animated.Value refs are stable — omit from deps intentionally
    [user?.district, showToast], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Header fades in immediately on mount — no data needed
  useEffect(() => {
    Animated.timing(fadeHeader, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient Greeting Header */}
        <Animated.View style={{ opacity: fadeHeader }}>
          <LinearGradient
            colors={colors.gradient.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientHeader}
          >
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />

            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.greeting}>{getGreeting()},</Text>
                <Text style={styles.userName}>{user?.name || "PHI"}</Text>
                <View style={styles.rolePill}>
                  <MaterialCommunityIcons
                    name="shield-account"
                    size={12}
                    color="rgba(255,255,255,0.9)"
                  />
                  <Text style={styles.roleText}>Public Health Inspector</Text>
                </View>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={styles.bellButton}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate("Notifications");
                  }}
                >
                  <MaterialCommunityIcons
                    name="bell-outline"
                    size={22}
                    color="rgba(255,255,255,0.85)"
                  />
                  {stats && (stats.overdueCount > 0 || stats.rejected > 0) && (
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>
                        {Math.min(stats.overdueCount + stats.rejected, 9)}
                        {stats.overdueCount + stats.rejected > 9 ? "+" : ""}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Profile")}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.1)"]}
                    style={styles.avatarCircle}
                  >
                    <Text style={styles.avatarText}>
                      {(user?.name || "P").charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* District info */}
            {user?.district && (
              <View style={styles.districtBanner}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={14}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={styles.districtText}>
                  {user.district} District
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Overdue Alert */}
        {stats && stats.overdueCount > 0 && (
          <Animated.View style={{ opacity: fadeAlert }}>
            <TouchableOpacity
              style={[
                styles.alertBanner,
                {
                  borderColor: alertPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [colors.destructive + "20", colors.destructive + "AA"],
                  }) as any,
                },
              ]}
              onPress={() => navigation.navigate("Tasks")}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.destructive + "18", colors.destructive + "08"]}
                style={styles.alertIconCircle}
              >
                <MaterialCommunityIcons
                  name="clock-alert"
                  size={20}
                  color={colors.destructive}
                />
              </LinearGradient>
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
          </Animated.View>
        )}

        {/* Task Stats */}
        <Animated.View
          style={{
            opacity: fadeStats,
            transform: [{ translateY: slideStats }],
          }}
        >
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionAccentBar} />
            <Text style={styles.sectionTitle}>My Task Overview</Text>
          </View>
          <View style={styles.statsGrid}>
            {statCards.map((card, i) => (
              <View key={card.label} style={[styles.statCard, shadows.md]}>
                <LinearGradient
                  colors={[card.color + "18", card.color + "08"]}
                  style={styles.statIconCircle}
                >
                  <MaterialCommunityIcons
                    name={card.icon}
                    size={22}
                    color={card.color}
                  />
                </LinearGradient>
                <AnimatedCounter
                  value={card.value}
                  delay={i * 100 + 300}
                  style={styles.statValue}
                />
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* Total summary */}
          {stats && (
            <View style={[styles.totalCard, shadows.md]}>
              <View style={styles.totalLeft}>
                <Text style={styles.totalLabel}>Total Tasks</Text>
                <AnimatedCounter
                  value={stats.total}
                  delay={600}
                  style={styles.totalValue}
                />
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalRight}>
                <Text style={styles.totalLabel}>Rejected</Text>
                <AnimatedCounter
                  value={stats.rejected}
                  delay={700}
                  style={{ ...styles.totalValue, color: colors.destructive }}
                />
              </View>
            </View>
          )}
        </Animated.View>

        {/* District Risk */}
        {districtRisk && (
          <Animated.View
            style={{
              opacity: fadeRisk,
              transform: [{ translateY: slideRisk }],
            }}
          >
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionAccentBar} />
              <Text style={styles.sectionTitle}>District Risk Level</Text>
            </View>
            <View style={[styles.riskCard, shadows.md]}>
              <View style={styles.riskHeader}>
                <View style={styles.riskLeft}>
                  <LinearGradient
                    colors={[
                      getRiskColor(districtRisk.predicted_cases) + "20",
                      getRiskColor(districtRisk.predicted_cases) + "08",
                    ]}
                    style={styles.riskIconCircle}
                  >
                    <MaterialCommunityIcons
                      name={getRiskIcon(districtRisk.predicted_cases) as any}
                      size={24}
                      color={getRiskColor(districtRisk.predicted_cases)}
                    />
                  </LinearGradient>
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
                  <AnimatedCounter
                    value={districtRisk.predicted_cases}
                    delay={800}
                    style={styles.riskStatValue}
                  />
                  <Text style={styles.riskStatLabel}>Cases</Text>
                </View>
                {districtRisk.temperature != null && (
                  <View style={styles.riskStatItem}>
                    <MaterialCommunityIcons
                      name="thermometer"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <AnimatedCounter
                      value={districtRisk.temperature}
                      delay={900}
                      decimalPlaces={1}
                      suffix="°"
                      style={styles.riskStatValue}
                    />
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
                    <AnimatedCounter
                      value={districtRisk.precipitation}
                      delay={1000}
                      suffix="mm"
                      style={styles.riskStatValue}
                    />
                    <Text style={styles.riskStatLabel}>Rain</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Quick Actions */}
        <Animated.View style={{ opacity: fadeActions }}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionAccentBar} />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate("Tasks")}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={14}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.actionsRow}>
            <ActionCard
              icon="clipboard-list"
              label="View Tasks"
              color={colors.primary}
              onPress={() => navigation.navigate("Tasks")}
            />
            <ActionCard
              icon="map-marker-path"
              label="My Route"
              color={colors.primaryDark}
              onPress={() => navigation.navigate("Route")}
            />
            <ActionCard
              icon="map-marker-radius"
              label="Task Map"
              color={colors.primaryLight}
              onPress={() => navigation.navigate("TaskMap")}
            />
          </View>
        </Animated.View>

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
  // Gradient header
  gradientHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: HEADER_PADDING_BOTTOM,
    borderBottomLeftRadius: borderRadius["3xl"],
    borderBottomRightRadius: borderRadius["3xl"],
    overflow: "hidden",
    position: "relative",
  },
  decorCircle1: {
    position: "absolute",
    width: scale(140),
    height: scale(140),
    borderRadius: scale(70),
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -30,
    right: -20,
  },
  decorCircle2: {
    position: "absolute",
    width: scale(90),
    height: scale(90),
    borderRadius: scale(45),
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -20,
    left: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 2,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    marginLeft: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.destructive,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: "rgba(0,130,60,0.9)",
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
    lineHeight: 13,
  },
  greeting: {
    fontSize: typography.fontSize.base,
    color: "rgba(255,255,255,0.75)",
    fontWeight: typography.fontWeight.medium,
  },
  userName: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
    marginTop: 2,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  roleText: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.9)",
    fontWeight: typography.fontWeight.medium,
  },
  avatarCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
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
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    zIndex: 2,
  },
  districtText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: "rgba(255,255,255,0.9)",
  },
  // Alert
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.sm,
  },
  alertIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  // Section
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionAccentBar: {
    width: 3,
    height: 16,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  // Stats
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconCircle: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
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
  // Total
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
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
  // Risk
  riskCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
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
    width: scale(46),
    height: scale(46),
    borderRadius: scale(23),
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
  // Actions
  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
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
