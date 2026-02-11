/**
 * Task List Screen
 */

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
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
import { Input, Loading, ErrorMessage } from "../../components/common";
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
      {/* Hero Header Card */}
      <View style={[styles.heroCard, shadows.sm]}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.title}>My Tasks</Text>
            <Text style={styles.subtitle}>{user?.district || "PHI"}</Text>
          </View>
          <View style={styles.countPill}>
            <MaterialCommunityIcons
              name="clipboard-list"
              size={16}
              color={colors.primary}
            />
            <Text style={styles.countText}>{tasks.length}</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <Input
            placeholder="Search by title, address, or district"
            value={search}
            onChangeText={setSearch}
            containerStyle={styles.searchInput}
          />
        </View>

        <TaskFilters value={filter} onChange={setFilter} />
      </View>

      {isLoading ? (
        <Loading message="Loading tasks..." />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={handleTaskPress} />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="clipboard-alert-outline"
                size={64}
                color={colors.textSecondary}
                style={styles.emptyIcon}
              />
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
          <Text style={styles.retryText} onPress={refetch}>
            Tap to retry
          </Text>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    position: "absolute",
    left: spacing.lg + spacing.sm,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
    paddingLeft: spacing.xl,
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
  emptyIcon: {
    marginBottom: spacing.md,
    opacity: 0.5,
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
  retryText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
});
