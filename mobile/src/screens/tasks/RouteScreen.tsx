/**
 * Route Screen — optimized visit order for the PHI's active tasks.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │  MapView with road polyline  │  (flex 1, ~55% of screen)
 *   │  Numbered markers per stop   │
 *   └──────────────────────────────┘
 *   ┌──────────────────────────────┐
 *   │  Summary bar (dist / time)   │
 *   │  Scrollable ordered stop list│  (flex 1, ~45% of screen)
 *   │   • Navigate button          │
 *   │   • Mark In-Progress shortcut│
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
import { Task, TaskStatus, RouteResult, RouteLeg } from "../../types/task.types";
import { useAuth } from "../../context/AuthContext";
import { MainTabNavigationProp } from "../../navigation/types";
import { colors, spacing, typography, borderRadius, shadows } from "../../theme";

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

// ─── Component ───────────────────────────────────────────────────────────────

export const RouteScreen: React.FC = () => {
  const navigation = useNavigation<MainTabNavigationProp>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
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

      // Try to get current location as origin
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

      // Fit map to all task coordinates
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
            edgePadding: { top: 60, right: 40, bottom: 40, left: 40 },
            animated: true,
          });
        }
      }
    } catch {
      setError("Failed to load route. Please try again.");
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

  // Polyline: backend returns [lng, lat]; react-native-maps expects { latitude, longitude }
  const polylineCoords = useMemo(() => {
    if (!routeResult || routeResult.polyline.length < 2) return [];
    return routeResult.polyline.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  }, [routeResult]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleNavigate = useCallback((task: Task) => {
    if (!task.latitude || !task.longitude) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lat = Number(task.latitude);
    const lng = Number(task.longitude);

    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    const appleMapsUrl = `maps://?daddr=${lat},${lng}&dirflg=d`;

    if (Platform.OS === "ios") {
      Alert.alert("Open in Maps", "Choose a navigation app", [
        {
          text: "Apple Maps",
          onPress: () => Linking.openURL(appleMapsUrl),
        },
        {
          text: "Google Maps",
          onPress: () => Linking.openURL(googleUrl),
        },
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
      } catch {
        Alert.alert("Error", "Failed to update task status.");
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

    return (
      <TouchableOpacity
        style={styles.stopCard}
        onPress={() => handleGoToDetail(task.id)}
        activeOpacity={0.85}
      >
        {/* Step number badge */}
        <View style={[styles.stepBadge, isCompleted && styles.stepBadgeDone]}>
          {isCompleted ? (
            <MaterialCommunityIcons name="check" size={14} color={colors.primaryForeground} />
          ) : (
            <Text style={styles.stepNumber}>{index + 1}</Text>
          )}
        </View>

        {/* Task info */}
        <View style={styles.stopInfo}>
          <Text style={styles.stopTitle} numberOfLines={1}>
            {task.title}
          </Text>
          {task.address ? (
            <Text style={styles.stopAddress} numberOfLines={1}>
              {task.address}
            </Text>
          ) : null}
          {leg ? (
            <Text style={styles.stopMeta}>
              {formatDuration(leg.durationSecs)} · {formatDistance(leg.distanceMeters)}
            </Text>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={styles.stopActions}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => handleNavigate(task)}
            disabled={!task.latitude}
          >
            <MaterialCommunityIcons
              name="navigation"
              size={18}
              color={colors.primary}
            />
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
                  name={isInProgress ? "progress-clock" : "play-circle-outline"}
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
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Calculating your route…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.destructive} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadRoute}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const tasksWithLocation = tasks.filter((t) => t.latitude !== null && t.longitude !== null);

  if (tasksWithLocation.length < 2) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <MaterialCommunityIcons name="map-marker-off" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>Not enough locations</Text>
        <Text style={styles.emptySubtitle}>
          You need at least 2 active tasks with GPS coordinates to generate a route.
        </Text>
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  const mapCenter: Region = orderedTasks.length > 0 && orderedTasks[0].latitude
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
          {/* Road polyline */}
          {polylineCoords.length > 1 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={colors.primary}
              strokeWidth={4}
            />
          )}

          {/* Numbered markers */}
          {orderedTasks.map((task, index) => {
            if (!task.latitude || !task.longitude) return null;
            const isCompleted =
              task.status === TaskStatus.COMPLETED || task.status === TaskStatus.VERIFIED;
            return (
              <Marker
                key={task.id}
                coordinate={{
                  latitude: Number(task.latitude),
                  longitude: Number(task.longitude),
                }}
                onPress={() => handleGoToDetail(task.id)}
              >
                <View style={[styles.mapMarker, isCompleted && styles.mapMarkerDone]}>
                  {isCompleted ? (
                    <MaterialCommunityIcons name="check" size={12} color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.mapMarkerText}>{index + 1}</Text>
                  )}
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Recalculate overlay */}
        {routeLoading && (
          <View style={[styles.recalcOverlay, { top: insets.top + spacing.sm }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.recalcText}>Recalculating…</Text>
          </View>
        )}

        {/* Unavailable warning */}
        {routeResult?.routingUnavailable && (
          <View style={[styles.warningBanner, { top: insets.top + spacing.sm }]}>
            <MaterialCommunityIcons name="alert" size={14} color={colors.warning} />
            <Text style={styles.warningText}>Road routing unavailable — estimated order shown</Text>
          </View>
        )}
      </View>

      {/* ── Stop list ── */}
      <View style={styles.listContainer}>
        {/* Summary bar */}
        <LinearGradient
          colors={colors.gradient.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summaryBar}
        >
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="map-marker-multiple" size={16} color={colors.primaryForeground} />
            <Text style={styles.summaryText}>
              {orderedTasks.length} stop{orderedTasks.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {routeResult?.totalDurationSecs != null && (
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primaryForeground} />
              <Text style={styles.summaryText}>
                {formatDuration(routeResult.totalDurationSecs)}
              </Text>
            </View>
          )}
          {routeResult?.totalDistanceMeters != null && (
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="road" size={16} color={colors.primaryForeground} />
              <Text style={styles.summaryText}>
                {formatDistance(routeResult.totalDistanceMeters)}
              </Text>
            </View>
          )}
          <TouchableOpacity onPress={loadRoute} style={styles.refreshBtn} disabled={routeLoading}>
            <MaterialCommunityIcons
              name="refresh"
              size={18}
              color={routeLoading ? "rgba(255,255,255,0.4)" : colors.primaryForeground}
            />
          </TouchableOpacity>
        </LinearGradient>

        {/* Ordered stop cards */}
        <FlatList
          data={orderedTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderStopItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            routeResult?.tasksWithoutLocation.length
              ? (
                <Text style={styles.excludedNote}>
                  {routeResult.tasksWithoutLocation.length} task
                  {routeResult.tasksWithoutLocation.length !== 1 ? "s" : ""} excluded (no location set)
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
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.destructive,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  retryText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primaryForeground,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // Map
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
  mapMarkerDone: {
    backgroundColor: colors.success,
  },
  mapMarkerText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  recalcOverlay: {
    position: "absolute",
    alignSelf: "center",
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
  warningBanner: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.text,
  },

  // Stop list
  listContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primaryForeground,
  },
  refreshBtn: {
    marginLeft: "auto",
    padding: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepBadgeDone: {
    backgroundColor: colors.success,
  },
  stepNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  stopInfo: {
    flex: 1,
    gap: 2,
  },
  stopTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  stopAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  stopMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  stopActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexShrink: 0,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  markButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + "15",
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
  },
});

export default RouteScreen;
