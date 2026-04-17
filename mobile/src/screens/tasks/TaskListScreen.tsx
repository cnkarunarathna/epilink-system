/**
 * Task List Screen — Enhanced with shimmer loading, staggered cards, gradient header,
 * swipe-to-filter (PanResponder), long-press context menu wiring, EmptyState,
 * KeyboardAvoidingView and animated search input handling.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
  EmptyState,
} from "../../components/common";
import { TaskCard, TaskFilters, TaskFilterValue } from "../../components/task";
import { useTasks } from "../../hooks/useTasks";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  Task,
  TaskStatus,
  UpdateTaskStatusRequest,
} from "../../types/task.types";
import { TaskStackNavigationProp } from "../../navigation/types";
import { TAB_BAR_HEIGHT } from "../../utils/responsive";
import { updateTaskStatus } from "../../api/taskService";
import { chatService } from "../../api/chatService";

// Measured height of a single TaskCard (including vertical margins) — used by getItemLayout
// to skip dynamic measurement and enable scroll-to-index.
const TASK_CARD_HEIGHT = 132;
const getItemLayout = (_: unknown, index: number) => ({
  length: TASK_CARD_HEIGHT,
  offset: TASK_CARD_HEIGHT * index,
  index,
});

// Filter cycle order for swipe-to-filter gesture
const FILTER_CYCLE: TaskFilterValue[] = [
  "all",
  TaskStatus.ASSIGNED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.SUBMITTED,
  TaskStatus.COMPLETED,
];

export const TaskListScreen: React.FC = () => {
  const navigation = useNavigation<TaskStackNavigationProp>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const listPaddingBottom = TAB_BAR_HEIGHT + insets.bottom + spacing.lg;
  const [filter, setFilter] = useState<TaskFilterValue>("all");
  const [search, setSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const { tasks, isLoading, isRefreshing, error, refresh, refetch } = useTasks({
    status: filter,
    assignedPhiId: user?.id,
    search,
  });

  const handleRefresh = useCallback(async () => {
    await refresh();
    showToast({ message: "Task list refreshed.", variant: "info" });
  }, [refresh, showToast]);

  // ─── Swipe-to-filter ─────────────────────────────────────────────────────
  const cycleFilter = useCallback((direction: 1 | -1) => {
    setFilter((current) => {
      const idx = FILTER_CYCLE.indexOf(current);
      const next =
        (idx + direction + FILTER_CYCLE.length) % FILTER_CYCLE.length;
      Haptics.selectionAsync();
      return FILTER_CYCLE[next];
    });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 20 && Math.abs(gs.dy) < 15,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) cycleFilter(+1); // swipe left → next filter
        if (gs.dx > 50) cycleFilter(-1); // swipe right → prev filter
      },
    }),
  ).current;

  // ─── Long-press action handlers ───────────────────────────────────────────
  const handleMarkInProgress = useCallback(
    async (task: Task) => {
      try {
        const req: UpdateTaskStatusRequest = { status: TaskStatus.IN_PROGRESS };
        await updateTaskStatus(task.id, req);
        showToast({
          message: "Task marked as In Progress.",
          variant: "success",
        });
        await refresh();
      } catch {
        showToast({
          message: "Failed to update task status.",
          variant: "error",
        });
      }
    },
    [refresh, showToast],
  );

  const handleViewOnMap = useCallback(
    (_task: Task) => {
      navigation.navigate("TaskMap");
    },
    [navigation],
  );

  const emptyMessage = useMemo(() => {
    if (filter === "all") return "No tasks assigned yet";
    return "No tasks found for this filter";
  }, [filter]);

  const emptySubtitle = useMemo(() => {
    if (filter === "all") return "Pull down to refresh";
    return "Try a different filter or pull to refresh";
  }, [filter]);

  // Batch-fetch unread counts whenever the task list changes
  useEffect(() => {
    if (tasks.length === 0) return;
    const ids = tasks.map((t) => t.id);
    chatService.getUnreadBatch(ids).then(setUnreadCounts).catch(() => {});
  }, [tasks]);

  const handleTaskPress = useCallback(
    (task: Task) => {
      navigation.navigate("TaskDetail", { taskId: task.id });
    },
    [navigation],
  );

  const handleOpenChat = useCallback(
    (task: Task) => {
      navigation.navigate("Chat", {
        taskId: task.id,
        taskTitle: task.title,
        isReadOnly:
          task.status === "completed" || task.status === "verified",
      });
    },
    [navigation],
  );

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
            returnKeyType="search"
            blurOnSubmit={true}
          />
        </View>

        <TaskFilters value={filter} onChange={setFilter} />
      </View>

      {isLoading ? (
        <ShimmerCardSkeleton count={4} />
      ) : (
        // KeyboardAvoidingView ensures the list shrinks when the search keyboard is open
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <FlatList
            {...panResponder.panHandlers}
            data={tasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: listPaddingBottom },
            ]}
            renderItem={({ item, index }) => (
              <TaskCard
                task={item}
                onPress={handleTaskPress}
                onMarkInProgress={handleMarkInProgress}
                onViewOnMap={handleViewOnMap}
                onOpenChat={handleOpenChat}
                unreadCount={unreadCounts[item.id] ?? 0}
                index={index}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
              />
            }
            // Render performance
            removeClippedSubviews={true}
            maxToRenderPerBatch={8}
            windowSize={5}
            initialNumToRender={6}
            getItemLayout={getItemLayout}
            ListEmptyComponent={
              <EmptyState
                icon="clipboard-check-outline"
                title={emptyMessage}
                subtitle={emptySubtitle}
                action={
                  filter !== "all"
                    ? {
                        label: "View All Tasks",
                        onPress: () => setFilter("all"),
                      }
                    : undefined
                }
              />
            }
            ListFooterComponent={
              error ? <ErrorMessage message={error} /> : null
            }
          />
        </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
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
    flexWrap: "wrap",
    gap: spacing.sm,
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
    minHeight: 32,
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
  retryContainer: {
    alignItems: "center",
    paddingBottom: spacing.lg,
  },
});
