/**
 * Route Screen — optimized visit order for the PHI's active tasks.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │  MapView with road polyline  │  (flex 7, ~58% of screen)
 *   │  Numbered markers per stop   │
 *   │  Floating recenter button    │
 *   └──────────────────────────────┘
 *   ┌──────────────────────────────┐  ← floats over map with rounded top + shadow
 *   │  Drag handle                 │
 *   │  Summary bar (dist / time)   │
 *   │  Scrollable ordered stop list│  (flex 5, ~42% of screen)
 *   │   • Status chip              │
 *   │   • Navigate / Mark buttons  │
 *   └──────────────────────────────┘
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { getTasks, getOptimizedRoute, updateTaskStatus } from "../../api/taskService";
import { EmptyState, ShimmerPlaceholder } from "../../components/common";
import { Task, TaskStatus, RouteResult, RouteLeg } from "../../types/task.types";
import { useAuth } from "../../context/AuthContext";
import { MainTabNavigationProp } from "../../navigation/types";
import { colors, spacing, typography, borderRadius, shadows } from "../../theme";
import { useToast } from "../../context/ToastContext";
import { TAB_BAR_HEIGHT } from "../../utils/responsive";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.ASSIGNED: return colors.status.assigned;
    case TaskStatus.IN_PROGRESS: return colors.status.in_progress;
    case TaskStatus.PENDING: return colors.status.pending;
    case TaskStatus.REJECTED: return colors.status.rejected;
    case TaskStatus.COMPLETED: return colors.status.completed;
    case TaskStatus.VERIFIED: return colors.status.verified;
    default: return colors.mutedForeground;
  }
}

function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.IN_PROGRESS: return "In Progress";
    case TaskStatus.ASSIGNED: return "Assigned";
    case TaskStatus.PENDING: return "Pending";
    case TaskStatus.REJECTED: return "Rejected";
    default: return "";
  }
}

const ACTIVE_STATUSES: TaskStatus[] = [
  TaskStatus.ASSIGNED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REJECTED,
  TaskStatus.PENDING,
];

const DEFAULT_REGION: Region = {
  latitude: 7.8731,
  longitude: 80.7718,
  latitudeDelta: 1.5,
  longitudeDelta: 1.5,
};

const PANEL_OVERLAP = 24;

// ─── Skeleton ────────────────────────────────────────────────────────────────

const RouteScreenSkeleton: React.FC = () => (
  <View style={skeletonStyles.container}>
    <ShimmerPlaceholder height={260} borderRadiusValue={0} style={skeletonStyles.mapBlock} />
    <View style={skeletonStyles.panelHandle}>
      <View style={skeletonStyles.handleBar} />
    </View>
    <View style={skeletonStyles.summaryRow}>
      <ShimmerPlaceholder width={60} height={32} borderRadiusValue={8} />
      <ShimmerPlaceholder width={60} height={32} borderRadiusValue={8} />
      <ShimmerPlaceholder width={60} height={32} borderRadiusValue={8} />
    </View>
    {[0, 1, 2, 3].map((i) => (
      <View key={i} style={skeletonStyles.stopCard}>
        <ShimmerPlaceholder width={34} height={34} borderRadiusValue={17} />
        <View style={skeletonStyles.stopInfo}>
          <ShimmerPlaceholder width="55%" height={13} borderRadiusValue={6} />
          <ShimmerPlaceholder width="35%" height={10} borderRadiusValue={6} style={skeletonStyles.gap} />
          <ShimmerPlaceholder width="45%" height={10} borderRadiusValue={6} style={skeletonStyles.gap} />
        </View>
        <ShimmerPlaceholder width={36} height={36} borderRadiusValue={18} />
      </View>
    ))}
  </View>
);

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapBlock: {
    width: "100%",
  },
  panelHandle: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stopInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  gap: {
    marginTop: spacing.xs,
  },
});

// ─── Component ───────────────────────────────────────────────────────────────

export const RouteScreen: React.FC = () => {
  const navigation = useNavigation<MainTabNavigationProp>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const listPaddingBottom = TAB_BAR_HEIGHT + insets.bottom + spacing.lg;
  const mapRef = useRef<MapView>(null);

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Load tasks + route on mount ──────────────────────────────────────────

  const loadRoute = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const all = await getTasks({ assignedPhiId: user.id });
      const active = all.filter((t) => ACTIVE_STATUSES.includes(t.status));
      setTasks(active);

      const routableIds = active
        .filter((t) => t.latitude !== null && t.longitude !== null)
        .map((t) => t.id);

      if (routableIds.length < 2) {
        setRouteResult(null);
        return;
      }

      setRouteLoading(true);

      let origin: { lat: number; lng: number } | undefined;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({});
          origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch {
        // geolocation unavailable — proceed without origin
      }

      const result = await getOptimizedRoute(routableIds, origin);
      setRouteResult(result);

      const stopCount = result.orderedTaskIds.length;
      showToast({
        message: `Route optimised for ${stopCount} stop${stopCount !== 1 ? "s" : ""}.`,
        variant: "info",
      });

      if (result.orderedTaskIds.length > 0) {
        const taskMap = new Map(active.map((t) => [t.id, t]));
        const coords = result.orderedTaskIds
          .map((id) => taskMap.get(id))
          .filter((t): t is Task => t !== undefined && t.latitude !== null && t.longitude !== null)
          .map((t) => ({
            latitude: Number(t.latitude),
            longitude: Number(t.longitude),
          }));
        if (coords.length > 0) {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 60, right: 40, bottom: PANEL_OVERLAP + 80, left: 40 },
            animated: true,
          });
        }
      }
    } catch {
      setError("Failed to load route. Please try again.");
      showToast({ message: "Failed to load route. Please try again.", variant: "error" });
    } finally {
      setLoading(false);
      setRouteLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRoute();
  }, [loadRoute]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const orderedTasks = useMemo(() => {
    if (!routeResult) return [];
    return routeResult.orderedTaskIds
      .map((id) => taskById.get(id))
      .filter((t): t is Task => t !== undefined);
  }, [routeResult, taskById]);

  const polylineCoords = useMemo(() => {
    if (!routeResult || routeResult.polyline.length < 2) return [];
    return routeResult.polyline.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  }, [routeResult]);

  const hasAnyInProgress = useMemo(
    () => orderedTasks.some((t) => t.status === TaskStatus.IN_PROGRESS),
    [orderedTasks],
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleRecenter = useCallback(() => {
    if (orderedTasks.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const coords = orderedTasks
      .filter((t) => t.latitude !== null && t.longitude !== null)
      .map((t) => ({ latitude: Number(t.latitude), longitude: Number(t.longitude) }));
    if (coords.length > 0) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 40, bottom: PANEL_OVERLAP + 80, left: 40 },
        animated: true,
      });
    }
  }, [orderedTasks]);

  const handleNavigate = useCallback((task: Task) => {
    if (!task.latitude || !task.longitude) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lat = Number(task.latitude);
    const lng = Number(task.longitude);

    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    const appleMapsUrl = `maps://?daddr=${lat},${lng}&dirflg=d`;

    if (Platform.OS === "ios") {
      Alert.alert("Open in Maps", "Choose a navigation app", [
        { text: "Apple Maps", onPress: () => Linking.openURL(appleMapsUrl) },
        { text: "Google Maps", onPress: () => Linking.openURL(googleUrl) },
        { text: "Cancel", style: "cancel" },
      ]);
    } else {
      Linking.openURL(googleUrl);
    }
  }, []);

  const handleMarkInProgress = useCallback(
    async (task: Task) => {
      if (task.status === TaskStatus.IN_PROGRESS) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setMarkingId(task.id);
      try {
        await updateTaskStatus(task.id, { status: TaskStatus.IN_PROGRESS });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: TaskStatus.IN_PROGRESS } : t,
          ),
        );
        showToast({ message: "Task marked as In Progress.", variant: "success" });
      } catch {
        showToast({ message: "Failed to update task status.", variant: "error" });
      } finally {
        setMarkingId(null);
      }
    },
    [],
  );

  const handleGoToDetail = useCallback(
    (taskId: string) => {
      navigation.navigate("Tasks", { screen: "TaskDetail", params: { taskId } });
    },
    [navigation],
  );

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderStopItem = ({ item: task, index }: { item: Task; index: number }) => {
    const leg: RouteLeg | undefined = routeResult?.legs[index];
    const isInProgress = task.status === TaskStatus.IN_PROGRESS;
    const isCompleted =
      task.status === TaskStatus.COMPLETED || task.status === TaskStatus.VERIFIED;
    const isMarking = markingId === task.id;
    const isNext = index === 0 && !hasAnyInProgress;
    const statusLabel = getStatusLabel(task.status);

    return (
      <TouchableOpacity
        style={[styles.stopCard, isInProgress && styles.stopCardInProgress]}
        onPress={() => handleGoToDetail(task.id)}
        activeOpacity={0.8}
      >
        {/* Step number badge */}
        <View
          style={[
            styles.stepBadge,
            isCompleted && styles.stepBadgeDone,
            isInProgress && styles.stepBadgeActive,
          ]}
        >
          {isCompleted ? (
            <MaterialCommunityIcons name="check" size={15} color={colors.primaryForeground} />
          ) : isInProgress ? (
            <MaterialCommunityIcons name="progress-clock" size={15} color={colors.primaryForeground} />
          ) : (
            <Text style={styles.stepNumber}>{index + 1}</Text>
          )}
        </View>

        {/* Task info */}
        <View style={styles.stopInfo}>
          {/* Title + status chip row */}
          <View style={styles.stopTitleRow}>
            <Text style={styles.stopTitle} numberOfLines={1}>
              {task.title}
            </Text>
            {isNext && (
              <View style={styles.nextChip}>
                <Text style={styles.nextChipText}>NEXT</Text>
              </View>
            )}
            {!isNext && !isCompleted && statusLabel ? (
              <View
                style={[styles.statusChip, { backgroundColor: getStatusColor(task.status) + "22" }]}
              >
                <Text style={[styles.statusChipText, { color: getStatusColor(task.status) }]}>
                  {statusLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Address */}
          {task.address ? (
            <View style={styles.addressRow}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text style={styles.stopAddress} numberOfLines={1}>
                {task.address}
              </Text>
            </View>
          ) : null}

          {/* Leg info */}
          {leg ? (
            <View style={styles.legRow}>
              <View style={styles.legItem}>
                <MaterialCommunityIcons name="clock-fast" size={11} color={colors.mutedForeground} />
                <Text style={styles.legText}>{formatDuration(leg.durationSecs)}</Text>
              </View>
              <View style={styles.legDot} />
              <View style={styles.legItem}>
                <MaterialCommunityIcons name="road-variant" size={11} color={colors.mutedForeground} />
                <Text style={styles.legText}>{formatDistance(leg.distanceMeters)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={styles.stopActions}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => handleNavigate(task)}
            disabled={!task.latitude}
          >
            <MaterialCommunityIcons name="navigation-variant" size={18} color={colors.primary} />
          </TouchableOpacity>

          {!isCompleted && (
            <TouchableOpacity
              style={[styles.markButton, isInProgress && styles.markButtonActive]}
              onPress={() => handleMarkInProgress(task)}
              disabled={isInProgress || isMarking}
            >
              {isMarking ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <MaterialCommunityIcons
                  name={isInProgress ? "progress-check" : "play-circle-outline"}
                  size={18}
                  color={isInProgress ? colors.primaryForeground : colors.primary}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <RouteScreenSkeleton />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={52} color={colors.destructive} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadRoute}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const tasksWithLocation = tasks.filter((t) => t.latitude !== null && t.longitude !== null);

  if (tasksWithLocation.length < 2) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <EmptyState
          icon="map-marker-path"
          title="Not enough locations"
          subtitle="You need at least 2 active tasks with GPS coordinates to generate a route."
          action={{ label: "Refresh", onPress: loadRoute }}
        />
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  const mapCenter: Region =
    orderedTasks.length > 0 && orderedTasks[0].latitude
      ? {
          latitude: Number(orderedTasks[0].latitude),
          longitude: Number(orderedTasks[0].longitude),
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        }
      : DEFAULT_REGION;

  return (
    <View style={styles.container}>
      {/* ── Map ── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={mapCenter}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
        >
          {polylineCoords.length > 1 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={colors.primary}
              strokeWidth={4}
              lineDashPattern={undefined}
            />
          )}

          {orderedTasks.map((task, index) => {
            if (!task.latitude || !task.longitude) return null;
            const isCompleted =
              task.status === TaskStatus.COMPLETED || task.status === TaskStatus.VERIFIED;
            const isInProgress = task.status === TaskStatus.IN_PROGRESS;
            return (
              <Marker
                key={task.id}
                coordinate={{
                  latitude: Number(task.latitude),
                  longitude: Number(task.longitude),
                }}
                onPress={() => handleGoToDetail(task.id)}
              >
                <View
                  style={[
                    styles.mapMarker,
                    isCompleted && styles.mapMarkerDone,
                    isInProgress && styles.mapMarkerActive,
                  ]}
                >
                  {isCompleted ? (
                    <MaterialCommunityIcons name="check" size={13} color="#fff" />
                  ) : (
                    <Text style={styles.mapMarkerText}>{index + 1}</Text>
                  )}
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Map overlay banners — stacked vertically */}
        <View style={[styles.mapBanners, { top: insets.top + spacing.sm }]}>
          {routeLoading && (
            <View style={styles.recalcPill}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.recalcText}>Recalculating…</Text>
            </View>
          )}
          {routeResult?.usedSavedOrder && (
            <View style={styles.savedOrderPill}>
              <MaterialCommunityIcons name="shield-check" size={13} color={colors.primary} />
              <Text style={styles.savedOrderText}>Route set by supervisor</Text>
            </View>
          )}
          {routeResult?.routingUnavailable && !routeResult.usedSavedOrder && (
            <View style={styles.warningPill}>
              <MaterialCommunityIcons name="alert" size={13} color={colors.warning} />
              <Text style={styles.warningText}>Estimated order shown</Text>
            </View>
          )}
        </View>

        {/* Recenter button */}
        <TouchableOpacity
          style={[styles.recenterBtn, { bottom: PANEL_OVERLAP + spacing.md }]}
          onPress={handleRecenter}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* ── Stop list panel — floats over map ── */}
      <View style={styles.listPanel}>
        {/* Drag handle */}
        <View style={styles.panelHandleArea}>
          <View style={styles.handleBar} />
        </View>

        {/* Summary bar */}
        <LinearGradient
          colors={colors.gradient.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summaryBar}
        >
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <MaterialCommunityIcons
                name="map-marker-multiple"
                size={14}
                color="rgba(255,255,255,0.75)"
              />
              <Text style={styles.summaryStatValue}>{orderedTasks.length}</Text>
              <Text style={styles.summaryStatLabel}>
                stop{orderedTasks.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {routeResult?.totalDurationSecs != null && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={14}
                    color="rgba(255,255,255,0.75)"
                  />
                  <Text style={styles.summaryStatValue}>
                    {formatDuration(routeResult.totalDurationSecs)}
                  </Text>
                  <Text style={styles.summaryStatLabel}>est.</Text>
                </View>
              </>
            )}

            {routeResult?.totalDistanceMeters != null && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <MaterialCommunityIcons
                    name="road"
                    size={14}
                    color="rgba(255,255,255,0.75)"
                  />
                  <Text style={styles.summaryStatValue}>
                    {formatDistance(routeResult.totalDistanceMeters)}
                  </Text>
                  <Text style={styles.summaryStatLabel}>total</Text>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            onPress={loadRoute}
            style={styles.refreshBtn}
            disabled={routeLoading}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={18}
              color={routeLoading ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.95)"}
            />
          </TouchableOpacity>
        </LinearGradient>

        {/* Ordered stop cards */}
        <FlatList
          data={orderedTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderStopItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="routes"
              title="No stops yet"
              subtitle="Pull down to refresh or wait for route calculation."
            />
          }
          ListFooterComponent={
            routeResult?.tasksWithoutLocation.length
              ? (
                <Text style={styles.excludedNote}>
                  {routeResult.tasksWithoutLocation.length} task
                  {routeResult.tasksWithoutLocation.length !== 1 ? "s" : ""} excluded — no location set
                </Text>
              )
              : null
          }
        />
      </View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.destructive,
    textAlign: "center",
    lineHeight: typography.fontSize.base * 1.5,
  },
  retryBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  retryText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primaryForeground,
  },

  // ── Map ──
  mapContainer: {
    flex: 7,
  },
  map: {
    flex: 1,
  },
  mapMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
  mapMarkerDone: {
    backgroundColor: colors.success,
  },
  mapMarkerActive: {
    backgroundColor: colors.status.in_progress,
    borderColor: "#fff",
  },
  mapMarkerText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },

  // Overlay banners stacked vertically
  mapBanners: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  recalcPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.md,
  },
  recalcText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  savedOrderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary + "35",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  savedOrderText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  warningPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.warning + "50",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  warningText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning,
    fontWeight: typography.fontWeight.medium,
  },

  // Recenter button
  recenterBtn: {
    position: "absolute",
    right: spacing.md,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lg,
  },

  // ── Floating list panel ──
  listPanel: {
    flex: 5,
    backgroundColor: colors.background,
    borderTopLeftRadius: PANEL_OVERLAP,
    borderTopRightRadius: PANEL_OVERLAP,
    marginTop: -PANEL_OVERLAP,
    // iOS upward shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    // Android elevation
    elevation: 8,
  },
  panelHandleArea: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },

  // Summary bar
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  summaryStats: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  summaryStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  summaryStatValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  summaryStatLabel: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.72)",
    fontWeight: typography.fontWeight.regular,
  },
  summaryDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginHorizontal: 2,
  },
  refreshBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },

  // Stop list
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  stopCardInProgress: {
    borderLeftWidth: 3,
    borderLeftColor: colors.status.in_progress,
    paddingLeft: spacing.md - 3,
  },

  // Step badge
  stepBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepBadgeDone: {
    backgroundColor: colors.success,
  },
  stepBadgeActive: {
    backgroundColor: colors.status.in_progress,
  },
  stepNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },

  // Stop info
  stopInfo: {
    flex: 1,
    gap: 3,
  },
  stopTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  stopTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    flexShrink: 1,
  },
  nextChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  nextChipText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
    letterSpacing: 0.5,
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.2,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stopAddress: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  legRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  legItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  legDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.mutedForeground,
  },
  legText: {
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
  },

  // Action buttons
  stopActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexShrink: 0,
    alignSelf: "center",
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  markButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  markButtonActive: {
    backgroundColor: colors.primary,
  },

  excludedNote: {
    textAlign: "center",
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
});

export default RouteScreen;
