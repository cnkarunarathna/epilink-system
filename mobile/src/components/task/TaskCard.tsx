/**
 * Task Card Component
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Task } from "../../types/task.types";
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

interface TaskCardProps {
  task: Task;
  onPress?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
  const overdue = isOverdue(task.dueDate);
  const statusColor =
    colors.status[task.status as keyof typeof colors.status] ||
    colors.mutedForeground;

  return (
    <TouchableOpacity
      onPress={() => onPress?.(task)}
      style={[styles.card, shadows.sm]}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>
            {TASK_STATUS_LABELS[task.status]}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Type:</Text>
        <Text style={styles.metaValue}>{TASK_TYPE_LABELS[task.type]}</Text>
        <Text style={styles.metaSeparator}>•</Text>
        <Text style={styles.metaLabel}>Priority:</Text>
        <Text style={styles.metaValue}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </Text>
      </View>

      {task.address ? (
        <Text style={styles.address} numberOfLines={1}>
          {task.address}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={[styles.dueDate, overdue && styles.overdue]}>
          {task.dueDate ? `Due: ${formatDate(task.dueDate)}` : "No due date"}
        </Text>
        <Text style={styles.district}>{task.district?.name}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primaryForeground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: spacing.sm,
  },
  metaLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text,
    marginLeft: spacing.xs,
    marginRight: spacing.sm,
  },
  metaSeparator: {
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  address: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  dueDate: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  overdue: {
    color: colors.destructive,
    fontWeight: typography.fontWeight.medium,
  },
  district: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});
