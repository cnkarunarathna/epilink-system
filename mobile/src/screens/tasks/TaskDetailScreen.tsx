/**
 * Task Detail Screen — Enhanced with animated timeline, gradient hero, spring actions
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  Animated,
  Easing,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TaskStackParamList } from "../../navigation/types";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animation,
} from "../../theme";
import { Button, Card, Loading, ErrorMessage } from "../../components/common";
import { useToast } from "../../context/ToastContext";
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
  MIN_EVIDENCE_COUNTS,
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
  const navigation = useNavigation();
  const { taskId } = route.params;
  const { showToast } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Animations
  const fadeHero = useRef(new Animated.Value(0)).current;
  const slideHero = useRef(new Animated.Value(20)).current;
  const fadeProgress = useRef(new Animated.Value(0)).current;
  const fadeDetails = useRef(new Animated.Value(0)).current;
  const slideDetails = useRef(new Animated.Value(20)).current;
  const fadeEvidence = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

        // Staggered entrance
        Animated.stagger(150, [
          Animated.parallel([
            Animated.timing(fadeHero, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(slideHero, {
              toValue: 0,
              ...animation.spring.gentle,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(fadeProgress, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(fadeDetails, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(slideDetails, {
              toValue: 0,
              ...animation.spring.gentle,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(fadeEvidence, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();

        // Pulse on current timeline dot
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.2,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ).start();
      }
    },
    [
      taskId,
      fadeHero,
      slideHero,
      fadeProgress,
      fadeDetails,
      slideDetails,
      fadeEvidence,
      pulseAnim,
    ],
  );

  useEffect(() => {
    fetchTask(false);
  }, [fetchTask]);

  const STATUS_TOAST_LABELS: Partial<Record<TaskStatus, string>> = {
    [TaskStatus.IN_PROGRESS]: "Task started — good luck!",
    [TaskStatus.SUBMITTED]: "Task submitted for review",
  };

  const handleStatusChange = async (status: TaskStatus) => {
    if (!task) return;
    setActionLoading(true);
    try {
      const updated = await updateTaskStatus(task.id, { status });
      setTask(updated);
      const label = STATUS_TOAST_LABELS[status];
      if (label) showToast({ message: label, variant: "success" });
    } catch (err: any) {
      const msg = err?.message || "Failed to update task";
      setError(msg);
      showToast({ message: msg, variant: "error" });
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

  const getPriorityGradient = (): readonly [string, string] => {
    switch (task.priority) {
      case TaskPriority.URGENT:
        return [colors.destructive, "#ff4444"] as const;
      case TaskPriority.HIGH:
        return [colors.warning, "#f0b429"] as const;
      case TaskPriority.MEDIUM:
        return [colors.primary, colors.primaryLight] as const;
      default:
        return [colors.textSecondary, "#8a918a"] as const;
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
      {/* Hero Card with gradient accent */}
      <Animated.View
        style={{
          opacity: fadeHero,
          transform: [{ translateY: slideHero }],
        }}
      >
        <View style={[styles.heroCard, shadows.lg]}>
          <LinearGradient
            colors={getPriorityGradient()}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroGradientStrip}
          />
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
                  name={getTypeIcon() as any}
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
      </Animated.View>

      {/* Animated Progress Timeline */}
      <Animated.View style={{ opacity: fadeProgress }}>
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
                    <Animated.View
                      style={[
                        styles.timelineDot,
                        isActive && styles.timelineDotActive,
                        isCurrent && styles.timelineDotCurrent,
                        isCurrent && {
                          transform: [{ scale: pulseAnim }],
                        },
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
                    </Animated.View>
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
      </Animated.View>

      {/* Details Card */}
      <Animated.View
        style={{
          opacity: fadeDetails,
          transform: [{ translateY: slideDetails }],
        }}
      >
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>

          {task.description && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <MaterialCommunityIcons
                  name="text"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.infoText}>{task.description}</Text>
            </View>
          )}

          {task.address && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.infoText}>{task.address}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <View
              style={[
                styles.infoIcon,
                overdue && { backgroundColor: colors.destructive + "12" },
              ]}
            >
              <MaterialCommunityIcons
                name="calendar-clock"
                size={18}
                color={overdue ? colors.destructive : colors.primary}
              />
            </View>
            <Text style={[styles.infoText, overdue && styles.overdue]}>
              {task.dueDate
                ? `Due: ${formatDate(task.dueDate)}`
                : "No due date"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <MaterialCommunityIcons
                name="map-outline"
                size={18}
                color={colors.primary}
              />
            </View>
            <Text style={styles.infoText}>District: {task.district?.name}</Text>
          </View>
        </Card>
      </Animated.View>

      {/* Timestamps Card */}
      <Animated.View
        style={{
          opacity: fadeDetails,
          transform: [{ translateY: slideDetails }],
        }}
      >
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
                <View style={styles.timestampIcon}>
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={14}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.timestampLabel}>{item.label}</Text>
                <Text style={styles.timestampValue}>
                  {formatRelativeTime(item.date!)}
                </Text>
              </View>
            ))}

          {task.createdBy && (
            <View style={[styles.timestampRow, { marginTop: spacing.sm }]}>
              <View style={styles.timestampIcon}>
                <MaterialCommunityIcons
                  name="account-arrow-right"
                  size={14}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.timestampLabel}>Assigned by</Text>
              <Text style={styles.timestampValue}>{task.createdBy.name}</Text>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Rejection Reason */}
      {task.rejectionReason && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Rejection Reason</Text>
          <View style={styles.infoRow}>
            <View
              style={[
                styles.infoIcon,
                { backgroundColor: colors.destructive + "12" },
              ]}
            >
              <MaterialCommunityIcons
                name="alert-circle"
                size={18}
                color={colors.destructive}
              />
            </View>
            <Text style={[styles.infoText, { color: colors.destructive }]}>
              {task.rejectionReason}
            </Text>
          </View>
        </Card>
      )}

      {/* Evidence Section */}
      {evidence.length > 0 && (
        <Animated.View style={{ opacity: fadeEvidence }}>
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
        </Animated.View>
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
            variant="gradient"
            icon="play"
            size="large"
          />
        )}

        {(task.status === TaskStatus.IN_PROGRESS ||
          task.status === TaskStatus.REJECTED) && (
          <Button
            title="Add Evidence"
            onPress={() =>
              (navigation as any).navigate("EvidenceUpload", { taskId })
            }
            variant="outline"
            icon="camera-plus"
            size="large"
          />
        )}

        {task.status === TaskStatus.IN_PROGRESS && (() => {
          const minRequired = MIN_EVIDENCE_COUNTS[task.type] ?? 1;
          const hasEnough = evidence.length >= minRequired;
          return (
            <>
              {!hasEnough && (
                <View style={styles.evidenceWarning}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={16}
                    color={colors.warning}
                  />
                  <Text style={styles.evidenceWarningText}>
                    At least {minRequired} photo
                    {minRequired > 1 ? "s" : ""} required before submitting
                  </Text>
                </View>
              )}
              <Button
                title="Submit Task"
                onPress={() => handleStatusChange(TaskStatus.SUBMITTED)}
                loading={actionLoading}
                disabled={!hasEnough}
                variant="gradient"
                icon="send"
                size="large"
              />
            </>
          );
        })()}

        {task.status === TaskStatus.REJECTED && (
          <Button
            title="Restart Task"
            onPress={() => handleStatusChange(TaskStatus.IN_PROGRESS)}
            loading={actionLoading}
            variant="gradient"
            icon="restart"
            size="large"
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
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    flexDirection: "row",
  },
  heroGradientStrip: {
    width: 5,
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
    paddingVertical: spacing.xs + 1,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    color: colors.primaryForeground,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.3,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
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
    width: 30,
    height: 30,
    borderRadius: 15,
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
    borderWidth: 3,
    borderColor: colors.primaryLight + "50",
  },
  timelineLine: {
    position: "absolute",
    height: 3,
    backgroundColor: colors.border,
    left: "50%",
    right: "-50%",
    top: 14,
    borderRadius: 1.5,
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
    borderRadius: borderRadius.lg,
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
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + "10",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text,
    lineHeight: 22,
    paddingTop: 4,
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
  timestampIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary + "10",
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: borderRadius.lg,
  },
  evidenceImage: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
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
  evidenceWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warning + "14",
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  evidenceWarningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning,
    fontWeight: typography.fontWeight.medium,
  },
});
