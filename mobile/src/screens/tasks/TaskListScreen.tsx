/**
 * Task List Screen
 */

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing, typography } from "../../theme";
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <Text style={styles.subtitle}>{user?.district || "PHI"}</Text>
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by title, address, or district"
          value={search}
          onChangeText={setSearch}
          containerStyle={styles.searchInput}
        />
      </View>

      <TaskFilters value={filter} onChange={setFilter} />

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    marginBottom: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
