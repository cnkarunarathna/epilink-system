/**
 * Task Card Component
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Task, TaskType, TaskPriority } from "../../types/task.types";
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

  const getPriorityIcon = () => {
    switch (task.priority) {
      case TaskPriority.URGENT:
        return "alert-circle";
      case TaskPriority.HIGH:
        return "chevron-triple-up";
      case TaskPriority.MEDIUM:
        return "minus";
      case TaskPriority.LOW:
        return "chevron-triple-down";
      default:
        return "minus";
    }
  };

  return (
    <TouchableOpacity
      onPress={() => onPress?.(task)}
      style={[styles.card, shadows.md]}
      activeOpacity={0.7}
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

      <View style={styles.metaContainer}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons
            name={getTypeIcon()}
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.metaText}>{TASK_TYPE_LABELS[task.type]}</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons
            name={getPriorityIcon()}
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.metaText}>
            {TASK_PRIORITY_LABELS[task.priority]}
          </Text>
        </View>
      </View>

      {task.address && (
        <View style={styles.addressRow}>
          <MaterialCommunityIcons
            name="map-marker"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.address} numberOfLines={1}>
            {task.address}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <MaterialCommunityIcons
            name="calendar-clock"
            size={14}
            color={overdue ? colors.destructive : colors.textSecondary}
          />
          <Text style={[styles.dueDate, overdue && styles.overdue]}>
            {task.dueDate ? formatDate(task.dueDate) : "No due date"}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <MaterialCommunityIcons
            name="map-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.district}>{task.district?.name}</Text>
        </View>
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
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    lineHeight: 22,
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
  metaContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: typography.fontWeight.medium,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  address: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dueDate: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  overdue: {
    color: colors.destructive,
    fontWeight: typography.fontWeight.medium,
  },
  district: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
});
