/**
 * Input Component — Enhanced with leftIcon, password toggle, animated focus border
 */

import React, { useRef, useState } from "react";
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
  Animated,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, typography } from "../../theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  rightElement?: React.ReactNode;
  secureTextEntry?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  leftIcon,
  rightElement,
  secureTextEntry,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    props.onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    props.onBlur?.(e);
  };

  const animatedBorderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? colors.error : colors.input, colors.primary],
  });

  // Auto show/hide toggle when secureTextEntry is provided, unless caller provides rightElement
  const effectiveRightElement =
    rightElement ??
    (secureTextEntry !== undefined ? (
      <TouchableOpacity
        onPress={() => setShowPassword((v) => !v)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={showPassword ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={isFocused ? colors.primary : colors.mutedForeground}
        />
      </TouchableOpacity>
    ) : undefined);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View
        style={[
          styles.inputWrapper,
          { borderColor: animatedBorderColor },
          error && styles.inputWrapperError,
        ]}
      >
        {leftIcon && (
          <MaterialCommunityIcons
            name={leftIcon}
            size={18}
            color={isFocused ? colors.primary : colors.mutedForeground}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            effectiveRightElement ? styles.inputWithRightElement : undefined,
            style,
          ]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={secureTextEntry && !showPassword}
          {...props}
        />
        {effectiveRightElement && (
          <View style={styles.rightElement}>{effectiveRightElement}</View>
        )}
      </Animated.View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    minHeight: 48,
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  leftIcon: {
    marginLeft: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text,
    textAlignVertical: "center",
  },
  inputWithLeftIcon: {
    paddingLeft: spacing.sm,
  },
  inputWithRightElement: {
    paddingRight: spacing.xs,
  },
  rightElement: {
    paddingRight: spacing.md,
    paddingLeft: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
