/**
 * Profile Screen — Enhanced with gradient header, animated avatar, animated progress
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
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
import { getTaskStats } from "../../api/taskService";
import { TaskStats } from "../../types/task.types";
import { API_CONFIG } from "../../utils/constants";

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animations
  const fadeHeader = useRef(new Animated.Value(0)).current;
  const scaleAvatar = useRef(new Animated.Value(0.7)).current;
  const fadeContent = useRef(new Animated.Value(0)).current;
  const slideContent = useRef(new Animated.Value(30)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;

  const fetchStats = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const data = await getTaskStats();
      setStats(data);
    } catch {
      // silently handle
    } finally {
      if (refresh) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    // Entrance animations
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(fadeHeader, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAvatar, {
          toValue: 1,
          tension: 40,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeContent, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideContent, {
          toValue: 0,
          ...animation.spring.gentle,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Subtle ring rotation
    Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [fadeHeader, scaleAvatar, fadeContent, slideContent, ringRotation]);

  // Animate progress bar when stats change
  useEffect(() => {
    if (stats && stats.total > 0) {
      const percent = stats.completed / stats.total;
      Animated.spring(progressWidth, {
        toValue: percent,
        tension: 30,
        friction: 8,
        useNativeDriver: false,
      }).start();
    }
  }, [stats, progressWidth]);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch {
            // handled
          }
        },
      },
    ]);
  };

  const initials = (user?.name || "P")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRoleName = (role?: string) => {
    switch (role) {
      case "phi":
        return "Public Health Inspector";
      case "supervisor":
        return "Supervisor";
      case "admin":
        return "Administrator";
      default:
        return role || "PHI";
    }
  };

  const rotateInterpolation = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchStats(true)}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient Profile Header */}
        <Animated.View style={{ opacity: fadeHeader }}>
          <LinearGradient
            colors={colors.gradient.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />

            <View style={styles.avatarContainer}>
              {/* Rotating gradient ring */}
              <Animated.View
                style={[
                  styles.avatarRing,
                  { transform: [{ rotate: rotateInterpolation }] },
                ]}
              >
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0.5)",
                    "rgba(255,255,255,0.1)",
                    "rgba(255,255,255,0.5)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarRingGradient}
                />
              </Animated.View>
              <Animated.View
                style={[styles.avatar, { transform: [{ scale: scaleAvatar }] }]}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </Animated.View>
              <View style={styles.onlineIndicator} />
            </View>

            <Text style={styles.userName}>{user?.name || "PHI User"}</Text>
            <Text style={styles.userEmail}>{user?.email || ""}</Text>
            <View style={styles.roleBadge}>
              <MaterialCommunityIcons
                name="shield-check"
                size={14}
                color="rgba(255,255,255,0.9)"
              />
              <Text style={styles.roleText}>{getRoleName(user?.role)}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={{
            opacity: fadeContent,
            transform: [{ translateY: slideContent }],
          }}
        >
          {/* Info Cards */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionAccentBar} />
              <Text style={styles.sectionTitle}>Account Information</Text>
            </View>

            <View style={[styles.infoCard, shadows.md]}>
              <View style={styles.infoRow}>
                <LinearGradient
                  colors={[colors.primary + "15", colors.primary + "08"]}
                  style={styles.infoIconContainer}
                >
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={20}
                    color={colors.primary}
                  />
                </LinearGradient>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{user?.email || "—"}</Text>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <LinearGradient
                  colors={[colors.primary + "15", colors.primary + "08"]}
                  style={styles.infoIconContainer}
                >
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={20}
                    color={colors.primary}
                  />
                </LinearGradient>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>District</Text>
                  <Text style={styles.infoValue}>
                    {user?.district || "Not assigned"}
                  </Text>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <LinearGradient
                  colors={[colors.primary + "15", colors.primary + "08"]}
                  style={styles.infoIconContainer}
                >
                  <MaterialCommunityIcons
                    name="shield-account-outline"
                    size={20}
                    color={colors.primary}
                  />
                </LinearGradient>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Role</Text>
                  <Text style={styles.infoValue}>
                    {getRoleName(user?.role)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Task Stats */}
          {stats && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionAccentBar} />
                <Text style={styles.sectionTitle}>My Performance</Text>
              </View>
              <View style={[styles.statsCard, shadows.md]}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <AnimatedCounter
                      value={stats.total}
                      delay={300}
                      style={styles.statNumber}
                    />
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <AnimatedCounter
                      value={stats.completed}
                      delay={400}
                      style={{
                        ...styles.statNumber,
                        color: colors.status.completed,
                      }}
                    />
                    <Text style={styles.statLabel}>Done</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <AnimatedCounter
                      value={stats.inProgress}
                      delay={500}
                      style={{
                        ...styles.statNumber,
                        color: colors.status.in_progress,
                      }}
                    />
                    <Text style={styles.statLabel}>Active</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <AnimatedCounter
                      value={stats.overdueCount}
                      delay={600}
                      style={{
                        ...styles.statNumber,
                        ...(stats.overdueCount > 0
                          ? { color: colors.destructive }
                          : {}),
                      }}
                    />
                    <Text style={styles.statLabel}>Overdue</Text>
                  </View>
                </View>

                {/* Animated completion bar */}
                {stats.total > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <Animated.View
                        style={[
                          styles.progressFill,
                          {
                            width: progressWidth.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0%", "100%"],
                            }),
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={colors.gradient.accent}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFill}
                        />
                      </Animated.View>
                    </View>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressPercent}>
                        {Math.round((stats.completed / stats.total) * 100)}%
                      </Text>
                      <Text style={styles.progressText}>completion rate</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* App Info  */}
          {__DEV__ && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionAccentBar} />
                <Text style={styles.sectionTitle}>App Info</Text>
              </View>
              <View style={[styles.infoCard, shadows.md]}>
                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={[colors.primary + "15", colors.primary + "08"]}
                    style={styles.infoIconContainer}
                  >
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </LinearGradient>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Version</Text>
                    <Text style={styles.infoValue}>1.0.0</Text>
                  </View>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={[colors.primary + "15", colors.primary + "08"]}
                    style={styles.infoIconContainer}
                  >
                    <MaterialCommunityIcons
                      name="server-network"
                      size={20}
                      color={colors.primary}
                    />
                  </LinearGradient>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>API Server</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                      {API_CONFIG.BASE_URL}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Logout Button */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.logoutButton, shadows.md]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleLogout();
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="logout"
                size={20}
                color={colors.destructive}
              />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerText}>EpiLink PHI Mobile v1.0.0</Text>
          <View style={{ height: spacing.xl }} />
        </Animated.View>
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
  headerGradient: {
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: borderRadius["3xl"],
    borderBottomRightRadius: borderRadius["3xl"],
    overflow: "hidden",
    position: "relative",
  },
  decorCircle1: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -20,
    right: -20,
  },
  decorCircle2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: 10,
    left: 20,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: spacing.md,
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: "hidden",
  },
  avatarRingGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 46,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
  },
  userName: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  userEmail: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  roleText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: "rgba(255,255,255,0.9)",
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionAccentBar: {
    width: 3,
    height: 16,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: typography.fontWeight.medium,
    marginTop: 1,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  progressContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressBar: {
    height: 10,
    backgroundColor: colors.muted,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  progressPercent: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.destructive + "25",
  },
  logoutText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.destructive,
  },
  footerText: {
    textAlign: "center",
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.md,
    opacity: 0.6,
  },
});
