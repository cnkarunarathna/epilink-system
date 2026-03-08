/**
 * Task Filters Component — Enhanced with animated transitions & haptics
 */

import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { TaskStatus } from "../../types/task.types";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  animation,
} from "../../theme";

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

const FilterChip: React.FC<{
  filter: { label: string; value: TaskFilterValue };
  isActive: boolean;
  onPress: () => void;
}> = ({ filter, isActive, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.92,
        ...animation.spring.snappy,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...animation.spring.bouncy,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        {isActive ? (
          <LinearGradient
            colors={colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.chip, styles.chipActive]}
          >
            <Text style={[styles.chipText, styles.chipTextActive]}>
              {filter.label}
            </Text>
          </LinearGradient>
        ) : (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{filter.label}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

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
      {FILTERS.map((filter) => (
        <FilterChip
          key={filter.value}
          filter={filter}
          isActive={value === filter.value}
          onPress={() => onChange(filter.value)}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.muted,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: "transparent",
    borderWidth: 0,
    paddingVertical: spacing.sm + 3.5,
    paddingHorizontal: spacing.lg + 1.5,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.semibold,
  },
  chipTextActive: {
    color: colors.primaryForeground,
  },
});
