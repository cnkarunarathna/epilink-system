/**
 * Button Component — Enhanced with press scale animation & haptic feedback
 */

import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Animated,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  borderRadius,
  typography,
  animation,
} from "../../theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "destructive" | "gradient";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  haptic?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  haptic = true,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
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

  const handlePress = () => {
    if (disabled || loading) {
      return;
    }

    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.base,
      ...styles[size],
    };

    if (disabled || loading) {
      return { ...baseStyle, ...styles.disabled };
    }

    switch (variant) {
      case "primary":
        return { ...baseStyle, ...styles.primary };
      case "secondary":
        return { ...baseStyle, ...styles.secondary };
      case "outline":
        return { ...baseStyle, ...styles.outline };
      case "destructive":
        return { ...baseStyle, ...styles.destructive };
      case "gradient":
        return { ...baseStyle, backgroundColor: "transparent" };
      default:
        return { ...baseStyle, ...styles.primary };
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      ...styles.text,
      ...styles[`${size}Text` as keyof typeof styles],
    };

    switch (variant) {
      case "primary":
      case "gradient":
        return { ...baseTextStyle, ...styles.primaryText };
      case "secondary":
        return { ...baseTextStyle, ...styles.secondaryText };
      case "outline":
        return { ...baseTextStyle, ...styles.outlineText };
      case "destructive":
        return { ...baseTextStyle, ...styles.destructiveText };
      default:
        return { ...baseTextStyle, ...styles.primaryText };
    }
  };

  const iconColor =
    variant === "outline"
      ? colors.primary
      : variant === "secondary"
        ? colors.secondaryForeground
        : colors.primaryForeground;

  const content = (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator
          color={
            variant === "outline" ? colors.primary : colors.primaryForeground
          }
        />
      ) : (
        <>
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={size === "small" ? 16 : 20}
              color={iconColor}
              style={styles.icon}
            />
          )}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </View>
  );

  const buttonContent =
    variant === "gradient" && !disabled && !loading ? (
      <LinearGradient
        colors={colors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[getButtonStyle(), styles[size], style]}
      >
        {content}
      </LinearGradient>
    ) : (
      <View style={[getButtonStyle(), style]}>{content}</View>
    );

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {buttonContent}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 20,
  },
  icon: {
    marginRight: spacing.sm,
  },
  // Sizes
  small: {
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  medium: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  large: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  destructive: {
    backgroundColor: colors.destructive,
  },
  disabled: {
    backgroundColor: colors.muted,
    opacity: 0.6,
  },
  // Text styles
  text: {
    fontWeight: typography.fontWeight.semibold,
  },
  smallText: {
    fontSize: typography.fontSize.sm,
  },
  mediumText: {
    fontSize: typography.fontSize.base,
  },
  largeText: {
    fontSize: typography.fontSize.lg,
  },
  primaryText: {
    color: colors.primaryForeground,
  },
  secondaryText: {
    color: colors.secondaryForeground,
  },
  outlineText: {
    color: colors.primary,
  },
  destructiveText: {
    color: colors.destructiveForeground,
  },
});
