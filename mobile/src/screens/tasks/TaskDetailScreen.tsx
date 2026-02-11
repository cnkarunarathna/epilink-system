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
import { TaskStackParamList } from "../../navigation/types";
import { colors, spacing, typography, borderRadius } from "../../theme";
import { Button, Card, Loading, ErrorMessage } from "../../components/common";
import { getTaskById, updateTaskStatus } from "../../api/taskService";
import { Task, TaskStatus } from "../../types/task.types";
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
      <Card style={styles.section}>
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
            <Text style={styles.metaBadgeText}>
              {TASK_TYPE_LABELS[task.type]}
            </Text>
          </View>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>
              {TASK_PRIORITY_LABELS[task.priority]}
            </Text>
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        {task.description ? (
          <Text style={styles.bodyText}>{task.description}</Text>
        ) : (
          <Text style={styles.mutedText}>No description provided.</Text>
        )}
        {task.address ? (
          <Text style={styles.bodyText}>{task.address}</Text>
        ) : (
          <Text style={styles.mutedText}>No address provided.</Text>
        )}
        <Text style={[styles.bodyText, overdue && styles.overdue]}>
          {task.dueDate ? `Due: ${formatDate(task.dueDate)}` : "No due date"}
        </Text>
        <Text style={styles.bodyText}>District: {task.district?.name}</Text>
      </Card>

      {task.rejectionReason ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Rejection Reason</Text>
          <Text style={styles.bodyText}>{task.rejectionReason}</Text>
        </Card>
      ) : null}

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
  section: {
    margin: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  bodyText: {
    fontSize: typography.fontSize.base,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  mutedText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    color: colors.primaryForeground,
    fontWeight: typography.fontWeight.medium,
  },
  metaBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.muted,
  },
  metaBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
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
