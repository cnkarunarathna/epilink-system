/**
 * Task Filters Component
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { TaskStatus } from "../../types/task.types";
import { colors, spacing, typography, borderRadius } from "../../theme";

export type TaskFilterValue = TaskStatus | "all";

const FILTERS: { label: string; value: TaskFilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Assigned", value: TaskStatus.ASSIGNED },
  { label: "In Progress", value: TaskStatus.IN_PROGRESS },
  { label: "Submitted", value: TaskStatus.SUBMITTED },
  { label: "Completed", value: TaskStatus.COMPLETED },
];

interface TaskFiltersProps {
  value: TaskFilterValue;
  onChange: (value: TaskFilterValue) => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  value,
  onChange,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTERS.map((filter) => {
        const isActive = value === filter.value;
        return (
          <TouchableOpacity
            key={filter.value}
            onPress={() => onChange(filter.value)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  chipTextActive: {
    color: colors.primaryForeground,
  },
});
