/**
 * Task Detail Screen — Enhanced with progress timeline and evidence section
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
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
import { getTaskEvidence } from "../../api/evidenceService";
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from "../../types/task.types";
import { Evidence } from "../../types/evidence.types";
import {
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  EVIDENCE_STATUS_LABELS,
} from "../../utils/constants";
import {
  formatDate,
  formatRelativeTime,
  isOverdue,
} from "../../utils/dateFormatter";

type TaskDetailRouteProp = RouteProp<TaskStackParamList, "TaskDetail">;

/* Timeline step config */
const TIMELINE_STEPS = [
  {
    status: TaskStatus.ASSIGNED,
    label: "Assigned",
    icon: "clipboard-clock-outline",
  },
  {
    status: TaskStatus.IN_PROGRESS,
    label: "In Progress",
    icon: "progress-clock",
  },
  {
    status: TaskStatus.SUBMITTED,
    label: "Submitted",
    icon: "clipboard-check-outline",
  },
  { status: TaskStatus.VERIFIED, label: "Verified", icon: "check-decagram" },
  { status: TaskStatus.COMPLETED, label: "Completed", icon: "check-circle" },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  assigned: 1,
  in_progress: 2,
  submitted: 3,
  verified: 4,
  completed: 5,
  rejected: -1,
};

export const TaskDetailScreen: React.FC = () => {
  const route = useRoute<TaskDetailRouteProp>();
  const { taskId } = route.params;

  const [task, setTask] = useState<Task | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTask = useCallback(
    async (refresh = false) => {
      setError(null);
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      try {
        const [taskData, evidenceData] = await Promise.allSettled([
          getTaskById(taskId),
          getTaskEvidence(taskId),
        ]);
        if (taskData.status === "fulfilled") setTask(taskData.value);
        if (evidenceData.status === "fulfilled")
          setEvidence(evidenceData.value);
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
  const currentOrder = STATUS_ORDER[task.status] ?? -1;
  const isRejected = task.status === TaskStatus.REJECTED;

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

  const getEvidenceStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return colors.success;
      case "rejected":
        return colors.destructive;
      default:
        return colors.warning;
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
      {/* Hero Card with priority accent */}
      <View
        style={[
          styles.heroCard,
          shadows.md,
          { borderLeftColor: getPriorityColor(), borderLeftWidth: 4 },
        ]}
      >
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

      {/* Progress Timeline */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.timeline}>
          {TIMELINE_STEPS.map((step, index) => {
            const stepOrder = STATUS_ORDER[step.status] ?? 0;
            const isActive = currentOrder >= stepOrder && !isRejected;
            const isCurrent = task.status === step.status;
            const isLast = index === TIMELINE_STEPS.length - 1;

            return (
              <View key={step.status} style={styles.timelineStep}>
                <View style={styles.timelineIndicator}>
                  <View
                    style={[
                      styles.timelineDot,
                      isActive && styles.timelineDotActive,
                      isCurrent && styles.timelineDotCurrent,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={step.icon as any}
                      size={14}
                      color={
                        isActive
                          ? colors.primaryForeground
                          : colors.textSecondary
                      }
                    />
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.timelineLine,
                        isActive &&
                          currentOrder > stepOrder &&
                          styles.timelineLineActive,
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.timelineLabel,
                    isActive && styles.timelineLabelActive,
                    isCurrent && styles.timelineLabelCurrent,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
        {isRejected && (
          <View style={styles.rejectedBadge}>
            <MaterialCommunityIcons
              name="close-circle"
              size={16}
              color={colors.destructive}
            />
            <Text style={styles.rejectedText}>Task Rejected</Text>
          </View>
        )}
      </Card>

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

      {/* Timestamps Card */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        {[
          {
            label: "Created",
            date: task.createdAt,
            icon: "plus-circle-outline",
          },
          { label: "Assigned", date: task.assignedAt, icon: "account-check" },
          { label: "Submitted", date: task.submittedAt, icon: "send-check" },
          { label: "Completed", date: task.completedAt, icon: "check-all" },
        ]
          .filter((item) => item.date)
          .map((item) => (
            <View key={item.label} style={styles.timestampRow}>
              <MaterialCommunityIcons
                name={item.icon as any}
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.timestampLabel}>{item.label}</Text>
              <Text style={styles.timestampValue}>
                {formatRelativeTime(item.date!)}
              </Text>
            </View>
          ))}

        {/* Assigned by */}
        {task.createdBy && (
          <View style={[styles.timestampRow, { marginTop: spacing.sm }]}>
            <MaterialCommunityIcons
              name="account-arrow-right"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.timestampLabel}>Assigned by</Text>
            <Text style={styles.timestampValue}>{task.createdBy.name}</Text>
          </View>
        )}
      </Card>

      {/* Rejection Reason */}
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

      {/* Evidence Section */}
      {evidence.length > 0 && (
        <Card style={styles.section}>
          <View style={styles.evidenceHeader}>
            <Text style={styles.sectionTitle}>Evidence</Text>
            <View style={styles.evidenceCount}>
              <Text style={styles.evidenceCountText}>{evidence.length}</Text>
            </View>
          </View>
          {evidence.map((item) => (
            <View key={item.id} style={styles.evidenceItem}>
              {item.imageUrl && (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.evidenceImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.evidenceInfo}>
                <View style={styles.evidenceStatusRow}>
                  <View
                    style={[
                      styles.evidenceStatusBadge,
                      {
                        backgroundColor:
                          getEvidenceStatusColor(item.status) + "18",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.evidenceStatusText,
                        {
                          color: getEvidenceStatusColor(item.status),
                        },
                      ]}
                    >
                      {EVIDENCE_STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                  <Text style={styles.evidenceDate}>
                    {formatRelativeTime(item.submittedAt)}
                  </Text>
                </View>
                {item.notes && (
                  <Text style={styles.evidenceNotes} numberOfLines={2}>
                    {item.notes}
                  </Text>
                )}
                {item.rejectionReason && (
                  <Text style={styles.evidenceRejection} numberOfLines={2}>
                    ❌ {item.rejectionReason}
                  </Text>
                )}
              </View>
            </View>
          ))}
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
    borderRadius: borderRadius.lg,
    overflow: "hidden",
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
  /* Timeline */
  timeline: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  timelineStep: {
    flex: 1,
    alignItems: "center",
  },
  timelineIndicator: {
    alignItems: "center",
    flexDirection: "row",
    width: "100%",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineDotCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  timelineLine: {
    position: "absolute",
    height: 2,
    backgroundColor: colors.border,
    left: "50%",
    right: "-50%",
    top: 13,
  },
  timelineLineActive: {
    backgroundColor: colors.primary,
  },
  timelineLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: "center",
    fontWeight: typography.fontWeight.medium,
  },
  timelineLabelActive: {
    color: colors.primary,
  },
  timelineLabelCurrent: {
    fontWeight: typography.fontWeight.bold,
  },
  rejectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.destructive + "10",
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  rejectedText: {
    fontSize: typography.fontSize.sm,
    color: colors.destructive,
    fontWeight: typography.fontWeight.semibold,
  },
  /* Details */
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
  /* Timestamps */
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  timestampLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  timestampValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: typography.fontWeight.medium,
  },
  /* Evidence */
  evidenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  evidenceCount: {
    backgroundColor: colors.primary + "18",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  evidenceCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  evidenceItem: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: borderRadius.md,
  },
  evidenceImage: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colors.border,
  },
  evidenceInfo: {
    flex: 1,
    justifyContent: "center",
  },
  evidenceStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  evidenceStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  evidenceStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  evidenceDate: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  evidenceNotes: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    marginTop: 2,
  },
  evidenceRejection: {
    fontSize: typography.fontSize.xs,
    color: colors.destructive,
    marginTop: 2,
  },
  /* Actions */
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
});
