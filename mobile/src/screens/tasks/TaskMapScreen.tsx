/**
 * Task Map Screen - Enhanced with Interactive UI/UX
 */

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Animated,
  ScrollView,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import MapView, {
  Marker,
  Region,
  PROVIDER_GOOGLE,
  Callout,
} from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTasks } from "../../hooks/useTasks";
import { useAuth } from "../../context/AuthContext";
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from "../../types/task.types";
import { MainTabNavigationProp } from "../../navigation/types";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../theme";
import {
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
} from "../../utils/constants";
import { formatDate, isOverdue } from "../../utils/dateFormatter";

const DEFAULT_REGION: Region = {
  latitude: 7.8731,
  longitude: 80.7718,
  latitudeDelta: 2.5,
  longitudeDelta: 2.5,
};

// ─── Memoized marker view ────────────────────────────────────────────────────
// Hoisted to module scope so React.memo comparator is effective.
// tracksViewChanges is set to `isSelected` on the parent Marker — only the
// selected marker pays the re-measure cost; all others are frozen.

interface MarkerViewProps {
  markerColor: string;
  isSelected: boolean;
}

const MarkerView = React.memo<MarkerViewProps>(({ markerColor, isSelected }) => (
  <View
    style={[
      styles.markerContainer,
      isSelected && styles.markerContainerSelected,
    ]}
  >
    <View
      style={[
        styles.markerDot,
        { backgroundColor: markerColor },
        isSelected && styles.markerDotSelected,
      ]}
    />
    <View
      style={[
        styles.markerRing,
        { borderColor: markerColor },
        isSelected && styles.markerRingSelected,
      ]}
    />
    {isSelected && (
      <View
        style={[styles.markerPulse, { borderColor: markerColor }]}
      />
    )}
  </View>
), (prev, next) => prev.markerColor === next.markerColor && prev.isSelected === next.isSelected);

export const TaskMapScreen: React.FC = () => {
  const navigation = useNavigation<MainTabNavigationProp>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { tasks, isLoading, error } = useTasks({
    status: "all",
    assignedPhiId: user?.id,
  });

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "granted" | "denied"
  >("idle");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const requestLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationStatus("denied");
          return;
        }
        setLocationStatus("granted");
        const current = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        });
      } catch {
        setLocationStatus("denied");
      }
    };

    requestLocation();
  }, []);

  const taskMarkers = useMemo(() => {
    return tasks.filter((task) => task.latitude && task.longitude);
  }, [tasks]);

  const taskStats = useMemo(() => {
    const assigned = tasks.filter((t) => t.status === "assigned").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    return { assigned, inProgress, completed };
  }, [tasks]);

  const handleMarkerPress = (task: Task) => {
    setSelectedTask(task);
    // Center map on selected task
    if (task.latitude && task.longitude) {
      mapRef.current?.animateToRegion(
        {
          latitude: Number(task.latitude),
          longitude: Number(task.longitude),
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        500,
      );
    }
    // Animate slide in
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const handleCloseDetail = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSelectedTask(null);
    });
  };

  const handleNavigateToDetail = () => {
    if (selectedTask) {
      handleCloseDetail();
      setTimeout(() => {
        navigation.navigate("Tasks", {
          screen: "TaskDetail",
          params: { taskId: selectedTask.id },
        });
      }, 250);
    }
  };

  const handleZoomIn = () => {
    const newRegion = {
      ...region,
      latitudeDelta: region.latitudeDelta / 2,
      longitudeDelta: region.longitudeDelta / 2,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 300);
  };

  const handleZoomOut = () => {
    const newRegion = {
      ...region,
      latitudeDelta: Math.min(region.latitudeDelta * 2, 10),
      longitudeDelta: Math.min(region.longitudeDelta * 2, 10),
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 300);
  };

  const handleMyLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (newStatus !== "granted") {
          return;
        }
      }
      const current = await Location.getCurrentPositionAsync({});
      const newRegion = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const getTypeIcon = (type: TaskType) => {
    switch (type) {
      case TaskType.CLEANUP:
        return "broom";
      case TaskType.FOGGING:
        return "spray";
      case TaskType.INSPECTION:
        return "clipboard-check";
      case TaskType.INVESTIGATION:
        return "magnify";
      default:
        return "clipboard-text";
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT:
        return colors.destructive;
      case TaskPriority.HIGH:
        return colors.warning;
      case TaskPriority.MEDIUM:
        return colors.primary;
      case TaskPriority.LOW:
        return colors.textSecondary;
      default:
        return colors.textSecondary;
    }
  };

  const customMapStyle = [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
  ];

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={region}
            onRegionChangeComplete={setRegion}
            customMapStyle={customMapStyle}
            showsUserLocation={true}
            showsMyLocationButton={false}
            followsUserLocation={false}
            showsCompass={false}
            onPress={() => selectedTask && handleCloseDetail()}
          >
            {taskMarkers.map((task) => {
              const isSelected = selectedTask?.id === task.id;
              const markerColor = colors.status[task.status] || colors.primary;
              return (
                <Marker
                  key={task.id}
                  coordinate={{
                    latitude: Number(task.latitude),
                    longitude: Number(task.longitude),
                  }}
                  onPress={() => handleMarkerPress(task)}
                  tracksViewChanges={isSelected}
                >
                  <MarkerView markerColor={markerColor} isSelected={isSelected} />
                </Marker>
              );
            })}
          </MapView>

          {/* Floating Header Card */}
          <View
            style={[styles.headerCard, { top: insets.top + 20 }, shadows.lg]}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View style={styles.iconBadge}>
                  <MaterialCommunityIcons
                    name="map-marker-radius"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.headerInfo}>
                  <Text style={styles.headerTitle}>Task Locations</Text>
                  <Text style={styles.headerSubtitle}>
                    {taskMarkers.length} task
                    {taskMarkers.length !== 1 ? "s" : ""} on map
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowLegend(!showLegend)}
                style={styles.legendToggle}
              >
                <MaterialCommunityIcons
                  name={showLegend ? "eye-off" : "eye"}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Pills */}
          <View
            style={[styles.statsCard, { top: insets.top + 90 }, shadows.md]}
          >
            <TouchableOpacity style={styles.statPill}>
              <View
                style={[
                  styles.statDot,
                  { backgroundColor: colors.status.assigned },
                ]}
              />
              <Text style={styles.statLabel}>Assigned</Text>
              <Text style={styles.statText}>{taskStats.assigned}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statPill}>
              <View
                style={[
                  styles.statDot,
                  { backgroundColor: colors.status.in_progress },
                ]}
              />
              <Text style={styles.statLabel}>Active</Text>
              <Text style={styles.statText}>{taskStats.inProgress}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statPill}>
              <View
                style={[
                  styles.statDot,
                  { backgroundColor: colors.status.completed },
                ]}
              />
              <Text style={styles.statLabel}>Done</Text>
              <Text style={styles.statText}>{taskStats.completed}</Text>
            </TouchableOpacity>
          </View>

          {/* Zoom Controls */}
          <View
            style={[styles.zoomControls, { top: insets.top + 180 }, shadows.md]}
          >
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={handleZoomIn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="plus"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <View style={styles.zoomDivider} />
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={handleZoomOut}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="minus"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          {/* My Location Button */}
          <TouchableOpacity
            style={[
              styles.myLocationButton,
              { top: insets.top + 280 },
              shadows.md,
            ]}
            onPress={handleMyLocation}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>

          {/* Enhanced Legend Card with Toggle */}
          {showLegend && taskMarkers.length > 0 && (
            <Animated.View
              style={[styles.legendCard, { opacity: fadeAnim }, shadows.md]}
            >
              <View style={styles.legendHeader}>
                <MaterialCommunityIcons
                  name="format-list-bulleted"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.legendTitle}>Task Status</Text>
              </View>
              <View style={styles.legendContent}>
                {[
                  {
                    status: "assigned" as const,
                    label: "Assigned",
                    icon: "clock-outline",
                  },
                  {
                    status: "in_progress" as const,
                    label: "In Progress",
                    icon: "progress-clock",
                  },
                  {
                    status: "completed" as const,
                    label: "Completed",
                    icon: "check-circle",
                  },
                ].map((item) => (
                  <View key={item.status} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: colors.status[item.status] },
                      ]}
                    />
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={14}
                      color={colors.textSecondary}
                      style={styles.legendIcon}
                    />
                    <Text style={styles.legendText}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.legendHint}>Tap markers to view details</Text>
            </Animated.View>
          )}

          {/* Task Detail Sliding Panel */}
          {selectedTask && (
            <Animated.View
              style={[
                styles.taskDetailPanel,
                {
                  bottom: insets.bottom,
                  transform: [
                    {
                      translateY: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [500, 0],
                      }),
                    },
                  ],
                },
                shadows.lg,
              ]}
            >
              <View style={styles.panelHandle}>
                <View style={styles.panelHandleBar} />
              </View>

              <ScrollView
                style={styles.panelScroll}
                contentContainerStyle={styles.panelContent}
              >
                {/* Header */}
                <View style={styles.panelHeader}>
                  <View style={styles.panelHeaderLeft}>
                    <View
                      style={[
                        styles.panelStatusBadge,
                        { backgroundColor: colors.status[selectedTask.status] },
                      ]}
                    >
                      <Text style={styles.panelStatusText}>
                        {TASK_STATUS_LABELS[selectedTask.status]}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleCloseDetail}
                      style={styles.closeButton}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.panelTitle}>{selectedTask.title}</Text>

                {/* Meta Info */}
                <View style={styles.panelMeta}>
                  <View style={styles.panelMetaItem}>
                    <MaterialCommunityIcons
                      name={getTypeIcon(selectedTask.type)}
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.panelMetaText}>
                      {TASK_TYPE_LABELS[selectedTask.type]}
                    </Text>
                  </View>
                  <View style={styles.panelMetaItem}>
                    <MaterialCommunityIcons
                      name="flag"
                      size={16}
                      color={getPriorityColor(selectedTask.priority)}
                    />
                    <Text style={styles.panelMetaText}>
                      {TASK_PRIORITY_LABELS[selectedTask.priority]}
                    </Text>
                  </View>
                </View>

                {/* Details */}
                {selectedTask.address && (
                  <View style={styles.panelDetail}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={18}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.panelDetailText}>
                      {selectedTask.address}
                    </Text>
                  </View>
                )}

                {selectedTask.dueDate && (
                  <View style={styles.panelDetail}>
                    <MaterialCommunityIcons
                      name="calendar-clock"
                      size={18}
                      color={
                        isOverdue(selectedTask.dueDate)
                          ? colors.destructive
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.panelDetailText,
                        isOverdue(selectedTask.dueDate) && styles.overdueText,
                      ]}
                    >
                      Due: {formatDate(selectedTask.dueDate)}
                    </Text>
                  </View>
                )}

                {/* Action Button */}
                <TouchableOpacity
                  style={styles.viewDetailButton}
                  onPress={handleNavigateToDetail}
                >
                  <Text style={styles.viewDetailButtonText}>
                    View Full Details
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color={colors.primaryForeground}
                  />
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          )}
        </>
      )}

      {locationStatus === "denied" && (
        <View style={[styles.banner, { top: insets.top + 20 }]}>
          <Text style={styles.bannerText}>
            Location access is disabled. Showing default map region.
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.bannerError}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      )}

      {!isLoading && taskMarkers.length === 0 && !error && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="map-marker-off"
            size={48}
            color={colors.textSecondary}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyText}>
            No tasks with locations to display on the map.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  markerContainer: {
    position: "relative",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  markerContainerSelected: {
    width: 44,
    height: 44,
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.card,
  },
  markerDotSelected: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.card,
  },
  markerRing: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    opacity: 0.3,
  },
  markerRingSelected: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    opacity: 0.5,
  },
  markerPulse: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    opacity: 0.6,
  },
  headerCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  legendToggle: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.muted,
  },
  statsCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-around",
    gap: spacing.sm,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  statText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  legendCard: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: 160,
  },
  legendHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  legendTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  legendContent: {
    gap: spacing.xs,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendIcon: {
    marginLeft: -spacing.xs,
  },
  legendText: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
  },
  legendHint: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  zoomControls: {
    position: "absolute",
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  myLocationButton: {
    position: "absolute",
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  taskDetailPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: "50%",
  },
  panelHandle: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  panelHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  panelScroll: {
    maxHeight: 400,
  },
  panelContent: {
    padding: spacing.lg,
  },
  panelHeader: {
    marginBottom: spacing.sm,
  },
  panelHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelStatusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  panelStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.card,
    textTransform: "uppercase",
  },
  closeButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.muted,
  },
  panelTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  panelMeta: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  panelMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  panelMetaText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  panelDetail: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  panelDetailText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  overdueText: {
    color: colors.destructive,
    fontWeight: typography.fontWeight.medium,
  },
  viewDetailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  viewDetailButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primaryForeground,
  },
  banner: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.muted,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  bannerError: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.destructive,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  bannerText: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    textAlign: "center",
  },
  emptyState: {
    position: "absolute",
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
  },
  emptyIcon: {
    marginBottom: spacing.sm,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
