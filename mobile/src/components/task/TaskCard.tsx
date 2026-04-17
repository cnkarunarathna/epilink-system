/**
 * Task Card Component — Enhanced with animated entrance, gradient strip, press scale
 */

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
} from "react-native";
import * as Haptics from "expo-haptics";
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
import { accessibleFontSize } from "../../utils/responsive";

interface TaskCardProps {
  task: Task;
  onPress?: (task: Task) => void;
  onMarkInProgress?: (task: Task) => void;
  onViewOnMap?: (task: Task) => void;
  onOpenChat?: (task: Task) => void;
  unreadCount?: number;
  index?: number;
}

const TaskCardInner: React.FC<TaskCardProps> = ({
  task,
  onPress,
  onMarkInProgress,
  onViewOnMap,
  onOpenChat,
  unreadCount = 0,
  index = 0,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);
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

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuVisible(true);
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      }}
    >
      {/* Long-press context menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle} numberOfLines={1}>
              {task.title}
            </Text>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                setMenuVisible(false);
                onPress?.(task);
              }}
            >
              <View
                style={[
                  styles.menuItemIcon,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.menuItemText}>View Details</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {onOpenChat && (
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setMenuVisible(false);
                  onOpenChat(task);
                }}
              >
                <View
                  style={[
                    styles.menuItemIcon,
                    { backgroundColor: colors.primaryLight + "15" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chat-processing-outline"
                    size={20}
                    color={colors.primaryLight}
                  />
                </View>
                <Text style={styles.menuItemText}>Open Chat</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}

            {task.status === "assigned" && onMarkInProgress ? (
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setMenuVisible(false);
                  onMarkInProgress(task);
                }}
              >
                <View
                  style={[
                    styles.menuItemIcon,
                    { backgroundColor: colors.status.in_progress + "15" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="progress-clock"
                    size={20}
                    color={colors.status.in_progress}
                  />
                </View>
                <Text style={styles.menuItemText}>Mark In Progress</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ) : null}

            {onViewOnMap ? (
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setMenuVisible(false);
                  onViewOnMap(task);
                }}
              >
                <View
                  style={[
                    styles.menuItemIcon,
                    { backgroundColor: colors.primaryLight + "15" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={20}
                    color={colors.primaryLight}
                  />
                </View>
                <Text style={styles.menuItemText}>View on Map</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemCancel]}
              activeOpacity={0.7}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <TouchableOpacity
        onPress={() => onPress?.(task)}
        onLongPress={handleLongPress}
        delayLongPress={300}
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
            <View style={styles.headerRight}>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <MaterialCommunityIcons
                    name="chat-processing"
                    size={10}
                    color={colors.primaryForeground}
                  />
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>
                  {TASK_STATUS_LABELS[task.status]}
                </Text>
              </View>
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
            <View style={styles.footerLeft}>
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
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Only re-render when the task's own data, unread count, or index changes
export const TaskCard = React.memo(
  TaskCardInner,
  (prev, next) =>
    prev.task.id === next.task.id &&
    prev.task.status === next.task.status &&
    prev.unreadCount === next.unreadCount &&
    prev.index === next.index,
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    flexDirection: "row",
    overflow: "hidden",
    minHeight: 132,
    ...shadows.md,
  },
  cardOverdue: {
    borderColor: colors.destructive + "35",
  },
  priorityStrip: {
    width: 6,
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
    flexWrap: "wrap",
  },
  title: {
    flex: 1,
    fontSize: accessibleFontSize(typography.fontSize.base),
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    lineHeight: 22,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
  },
  unreadBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.destructive,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 2,
    minWidth: 20,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs / 2 + 1,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: accessibleFontSize(typography.fontSize.xs),
    fontWeight: typography.fontWeight.semibold,
    color: colors.primaryForeground,
    letterSpacing: 0.3,
  },
  metaContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
    flexWrap: "wrap",
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
    fontSize: accessibleFontSize(typography.fontSize.sm),
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
    fontSize: accessibleFontSize(typography.fontSize.sm),
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
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
    flexWrap: "wrap",
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dueDate: {
    fontSize: accessibleFontSize(typography.fontSize.xs),
    color: colors.textSecondary,
  },
  overdue: {
    color: colors.destructive,
    fontWeight: typography.fontWeight.medium,
  },
  relativeTime: {
    fontSize: accessibleFontSize(typography.fontSize.xs),
    color: colors.textSecondary,
  },
  // ─── Long-press context menu ──────────────────────────────────────────────
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius["2xl"],
    borderTopRightRadius: borderRadius["2xl"],
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    ...shadows.lg,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  menuTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    minHeight: 48,
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text,
  },
  menuItemCancel: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: "center",
  },
  menuCancelText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
