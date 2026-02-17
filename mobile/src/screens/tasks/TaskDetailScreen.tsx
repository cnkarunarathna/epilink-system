/**
 * Task Detail Screen
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TaskStackParamList } from "../../navigation/types";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../theme";
import { Button, Card, Loading, ErrorMessage } from "../../components/common";
import { getTaskById, updateTaskStatus } from "../../api/taskService";
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from "../../types/task.types";
import {
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
} from "../../utils/constants";
import { formatDate, isOverdue } from "../../utils/dateFormatter";

type TaskDetailRouteProp = RouteProp<TaskStackParamList, "TaskDetail">;

export const TaskDetailScreen: React.FC = () => {
  const route = useRoute<TaskDetailRouteProp>();
  const { taskId } = route.params;

  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTask = useCallback(
    async (refresh = false) => {
      setError(null);
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      try {
        const data = await getTaskById(taskId);
        setTask(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load task");
      } finally {
        refresh ? setIsRefreshing(false) : setIsLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    fetchTask(false);
  }, [fetchTask]);

  const handleStatusChange = async (status: TaskStatus) => {
    if (!task) return;
    setActionLoading(true);
    try {
      const updated = await updateTaskStatus(task.id, { status });
      setTask(updated);
    } catch (err: any) {
      setError(err?.message || "Failed to update task");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return <Loading message="Loading task..." />;
  }

  if (!task) {
    return (
      <View style={styles.container}>
        <ErrorMessage message={error || "Task not found"} />
      </View>
    );
  }

  const overdue = isOverdue(task.dueDate);

  const getTypeIcon = () => {
    switch (task.type) {
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

  const getPriorityColor = () => {
    switch (task.priority) {
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchTask(true)}
        />
      }
    >
      {/* Hero Card */}
      <View style={[styles.heroCard, shadows.md]}>
        <Card>
          <Text style={styles.title}>{task.title}</Text>
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: colors.status[task.status] },
              ]}
            >
              <Text style={styles.statusText}>
                {TASK_STATUS_LABELS[task.status]}
              </Text>
            </View>
            <View style={styles.metaBadge}>
              <MaterialCommunityIcons
                name={getTypeIcon()}
                size={12}
                color={colors.textSecondary}
              />
              <Text style={styles.metaBadgeText}>
                {TASK_TYPE_LABELS[task.type]}
              </Text>
            </View>
            <View style={styles.metaBadge}>
              <MaterialCommunityIcons
                name="flag"
                size={12}
                color={getPriorityColor()}
              />
              <Text style={styles.metaBadgeText}>
                {TASK_PRIORITY_LABELS[task.priority]}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Details Card */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>

        {task.description && (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="text"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.infoText}>{task.description}</Text>
          </View>
        )}

        {task.address && (
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.infoText}>{task.address}</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="calendar-clock"
            size={20}
            color={overdue ? colors.destructive : colors.textSecondary}
          />
          <Text style={[styles.infoText, overdue && styles.overdue]}>
            {task.dueDate ? `Due: ${formatDate(task.dueDate)}` : "No due date"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="map-outline"
            size={20}
            color={colors.textSecondary}
          />
          <Text style={styles.infoText}>District: {task.district?.name}</Text>
        </View>
      </Card>

      {task.rejectionReason && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Rejection Reason</Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={colors.destructive}
            />
            <Text style={[styles.infoText, { color: colors.destructive }]}>
              {task.rejectionReason}
            </Text>
          </View>
        </Card>
      )}

      {error && (
        <View style={styles.section}>
          <ErrorMessage message={error} />
        </View>
      )}

      <View style={styles.actions}>
        {task.status === TaskStatus.ASSIGNED && (
          <Button
            title="Start Task"
            onPress={() => handleStatusChange(TaskStatus.IN_PROGRESS)}
            loading={actionLoading}
          />
        )}
        {task.status === TaskStatus.IN_PROGRESS && (
          <Button
            title="Submit Task"
            onPress={() => handleStatusChange(TaskStatus.SUBMITTED)}
            loading={actionLoading}
          />
        )}
        {task.status === TaskStatus.REJECTED && (
          <Button
            title="Restart Task"
            onPress={() => handleStatusChange(TaskStatus.IN_PROGRESS)}
            loading={actionLoading}
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroCard: {
    margin: spacing.lg,
    marginBottom: spacing.md,
  },
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    lineHeight: 32,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    color: colors.primaryForeground,
    fontWeight: typography.fontWeight.medium,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.muted,
  },
  metaBadgeText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  infoRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text,
    lineHeight: 22,
  },
  overdue: {
    color: colors.destructive,
    fontWeight: typography.fontWeight.medium,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
});
