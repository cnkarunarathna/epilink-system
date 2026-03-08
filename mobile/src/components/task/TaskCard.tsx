/**
 * Task Card Component — Enhanced with animated entrance, gradient strip, press scale
 */

import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Task, TaskType, TaskPriority } from "../../types/task.types";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animation,
} from "../../theme";
import {
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
} from "../../utils/constants";
import {
  formatDate,
  formatRelativeTime,
  isOverdue,
} from "../../utils/dateFormatter";

interface TaskCardProps {
  task: Task;
  onPress?: (task: Task) => void;
  index?: number;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onPress,
  index = 0,
}) => {
  const overdue = isOverdue(task.dueDate);
  const statusColor =
    colors.status[task.status as keyof typeof colors.status] ||
    colors.mutedForeground;

  const priorityColor =
    colors.priority[task.priority as keyof typeof colors.priority] ||
    colors.textSecondary;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    const delay = index * animation.staggerDelay;
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animation.slow,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          ...animation.spring.gentle,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [index, fadeAnim, slideAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      ...animation.spring.snappy,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...animation.spring.bouncy,
      useNativeDriver: true,
    }).start();
  };

  const getTypeIcon = (): string => {
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

  const getPriorityIcon = (): string => {
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

  const getPriorityGradient = (): readonly [string, string] => {
    switch (task.priority) {
      case TaskPriority.URGENT:
        return [colors.destructive, "#ff4444"] as const;
      case TaskPriority.HIGH:
        return [colors.warning, "#f0b429"] as const;
      case TaskPriority.MEDIUM:
        return [colors.primary, colors.primaryLight] as const;
      case TaskPriority.LOW:
        return [colors.textSecondary, "#8a918a"] as const;
      default:
        return [colors.textSecondary, "#8a918a"] as const;
    }
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        onPress={() => onPress?.(task)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.card, overdue && styles.cardOverdue]}
        activeOpacity={1}
      >
        {/* Priority gradient strip */}
        <LinearGradient
          colors={getPriorityGradient()}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.priorityStrip}
        />

        <View style={styles.cardContent}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {task.title}
            </Text>
            <View
              style={[styles.statusBadge, { backgroundColor: statusColor }]}
            >
              <Text style={styles.statusText}>
                {TASK_STATUS_LABELS[task.status]}
              </Text>
            </View>
          </View>

          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <View
                style={[
                  styles.metaIconBg,
                  { backgroundColor: colors.primary + "10" },
                ]}
              >
                <MaterialCommunityIcons
                  name={getTypeIcon() as any}
                  size={14}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.metaText}>{TASK_TYPE_LABELS[task.type]}</Text>
            </View>
            <View style={styles.metaItem}>
              <View
                style={[
                  styles.metaIconBg,
                  { backgroundColor: priorityColor + "10" },
                ]}
              >
                <MaterialCommunityIcons
                  name={getPriorityIcon() as any}
                  size={14}
                  color={priorityColor}
                />
              </View>
              <Text style={[styles.metaText, { color: priorityColor }]}>
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
                name="clock-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.relativeTime}>
                {formatRelativeTime(task.updatedAt)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    flexDirection: "row",
    overflow: "hidden",
    ...shadows.md,
  },
  cardOverdue: {
    borderColor: colors.destructive + "35",
  },
  priorityStrip: {
    width: 5,
  },
  cardContent: {
    flex: 1,
    padding: spacing.md,
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
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs / 2 + 1,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primaryForeground,
    letterSpacing: 0.3,
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
  metaIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  relativeTime: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
});
