/**
 * Task Map Screen
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { useTasks } from "../../hooks/useTasks";
import { useAuth } from "../../context/AuthContext";
import { Task } from "../../types/task.types";
import { TaskStackNavigationProp } from "../../navigation/types";
import { colors, spacing, typography } from "../../theme";
import { TASK_STATUS_LABELS } from "../../utils/constants";

const DEFAULT_REGION: Region = {
  latitude: 7.8731,
  longitude: 80.7718,
  latitudeDelta: 2.5,
  longitudeDelta: 2.5,
};

export const TaskMapScreen: React.FC = () => {
  const navigation = useNavigation<TaskStackNavigationProp>();
  const { user } = useAuth();
  const { tasks, isLoading, error } = useTasks({
    status: "all",
    assignedPhiId: user?.id,
  });

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "granted" | "denied"
  >("idle");

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

  const handleMarkerPress = (task: Task) => {
    navigation.navigate("TaskDetail", { taskId: task.id });
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={region}
          region={region}
          onRegionChangeComplete={setRegion}
        >
          {taskMarkers.map((task) => (
            <Marker
              key={task.id}
              coordinate={{
                latitude: Number(task.latitude),
                longitude: Number(task.longitude),
              }}
              title={task.title}
              description={TASK_STATUS_LABELS[task.status]}
              pinColor={colors.status[task.status]}
              onPress={() => handleMarkerPress(task)}
            />
          ))}
        </MapView>
      )}

      {locationStatus === "denied" && (
        <View style={styles.banner}>
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
  banner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 20,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.muted,
    padding: spacing.sm,
    borderRadius: 12,
  },
  bannerError: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.destructive,
    padding: spacing.sm,
    borderRadius: 12,
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
    padding: spacing.md,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
