/**
 * Task List Screen — Enhanced with shimmer loading, staggered cards, gradient header
 */

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../theme";
import {
  Input,
  ErrorMessage,
  AnimatedCounter,
  ShimmerCardSkeleton,
  Button,
} from "../../components/common";
import { TaskCard, TaskFilters, TaskFilterValue } from "../../components/task";
import { useTasks } from "../../hooks/useTasks";
import { useAuth } from "../../context/AuthContext";
import { Task } from "../../types/task.types";
import { TaskStackNavigationProp } from "../../navigation/types";

export const TaskListScreen: React.FC = () => {
  const navigation = useNavigation<TaskStackNavigationProp>();
  const { user } = useAuth();
  const [filter, setFilter] = useState<TaskFilterValue>("all");
  const [search, setSearch] = useState("");

  const { tasks, isLoading, isRefreshing, error, refresh, refetch } = useTasks({
    status: filter,
    assignedPhiId: user?.id,
    search,
  });

  const emptyMessage = useMemo(() => {
    if (filter === "all") return "No tasks assigned yet";
    return "No tasks found for this filter";
  }, [filter]);

  const handleTaskPress = (task: Task) => {
    navigation.navigate("TaskDetail", { taskId: task.id });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Enhanced Hero Header */}
      <View style={styles.heroCard}>
        <LinearGradient
          colors={colors.gradient.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={styles.heroDecorCircle} />
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.title}>My Tasks</Text>
              <Text style={styles.subtitle}>{user?.district || "PHI"}</Text>
            </View>
            <View style={styles.countPill}>
              <MaterialCommunityIcons
                name="clipboard-list"
                size={16}
                color={colors.primaryForeground}
              />
              <AnimatedCounter value={tasks.length} style={styles.countText} />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchContainer}>
          <Input
            placeholder="Search by title, address, or district"
            value={search}
            onChangeText={setSearch}
            leftIcon="magnify"
            containerStyle={styles.searchInput}
          />
        </View>

        <TaskFilters value={filter} onChange={setFilter} />
      </View>

      {isLoading ? (
        <ShimmerCardSkeleton count={4} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <TaskCard task={item} onPress={handleTaskPress} index={index} />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <LinearGradient
                colors={[colors.muted, colors.border]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIconCircle}
              >
                <MaterialCommunityIcons
                  name="clipboard-alert-outline"
                  size={48}
                  color={colors.textSecondary}
                />
              </LinearGradient>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
              {error && <ErrorMessage message={error} />}
            </View>
          }
          ListFooterComponent={error ? <ErrorMessage message={error} /> : null}
          onRefresh={refresh}
          refreshing={isRefreshing}
        />
      )}

      {!isLoading && !isRefreshing && !tasks.length && error && (
        <View style={styles.retryContainer}>
          <Button
            title="Retry"
            onPress={refetch}
            variant="outline"
            size="small"
            icon="refresh"
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  heroGradient: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
    position: "relative",
  },
  heroDecorCircle: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -20,
    right: -10,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 2,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.7)",
    marginTop: spacing.xs,
  },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  searchInput: {
    marginBottom: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  retryContainer: {
    alignItems: "center",
    paddingBottom: spacing.lg,
  },
});
