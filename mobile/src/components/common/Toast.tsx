/**
 * Toast / Snackbar component
 * Renders the active toast from ToastContext as an animated slide-up banner
 * positioned just above the floating tab bar.
 *
 * - Slides in from the bottom with a spring
 * - Auto-dismisses after `duration` ms
 * - Swipe down to dismiss early
 * - Four variants: success | error | warning | info
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Toast as ToastType, ToastVariant, useToastInternal } from "../../context/ToastContext";
import { colors, spacing, borderRadius, typography, animation, shadows } from "../../theme";

// ─── Variant config ───────────────────────────────────────────────────────────

const TAB_BAR_HEIGHT = 72; // approximate height of the floating CustomTabBar

interface VariantConfig {
  bg: string;
  border: string;
  iconColor: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}

function getVariantConfig(variant: ToastVariant): VariantConfig {
  switch (variant) {
    case "success":
      return {
        bg: colors.success + "14",
        border: colors.success + "40",
        iconColor: colors.success,
        icon: "check-circle",
      };
    case "error":
      return {
        bg: colors.destructive + "12",
        border: colors.destructive + "40",
        iconColor: colors.destructive,
        icon: "alert-circle",
      };
    case "warning":
      return {
        bg: colors.warning + "14",
        border: colors.warning + "45",
        iconColor: colors.warning,
        icon: "alert",
      };
    case "info":
    default:
      return {
        bg: colors.primary + "12",
        border: colors.primary + "35",
        iconColor: colors.primary,
        icon: "information",
      };
  }
}

// ─── Single toast item ────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
  bottomOffset: number;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, bottomOffset }) => {
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const swipeDelta = useRef(new Animated.Value(0)).current;
  const config = getVariantConfig(toast.variant);
  const dismissedRef = useRef(false);

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 120,
        duration: animation.normal,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: animation.normal,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(toast.id));
  };

  // Slide in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        ...animation.spring.bouncy,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: animation.fast,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  }, []);

  // Swipe-down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dx) < Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) swipeDelta.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 40) {
          dismiss();
        } else {
          Animated.spring(swipeDelta, {
            toValue: 0,
            ...animation.spring.snappy,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.toastWrapper,
        {
          bottom: bottomOffset,
          opacity,
          transform: [
            { translateY: Animated.add(translateY, swipeDelta) },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.toast,
          shadows.lg,
          {
            backgroundColor: colors.card,
            borderColor: config.border,
          },
        ]}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: config.iconColor }]} />

        {/* Icon */}
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: config.bg },
          ]}
        >
          <MaterialCommunityIcons
            name={config.icon}
            size={20}
            color={config.iconColor}
          />
        </View>

        {/* Message */}
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>

        {/* Action or dismiss */}
        {toast.action ? (
          <TouchableOpacity
            onPress={() => {
              toast.action!.onPress();
              dismiss();
            }}
            style={[styles.actionButton, { borderColor: config.iconColor + "50" }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionLabel, { color: config.iconColor }]}>
              {toast.action.label}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={dismiss} style={styles.closeButton} activeOpacity={0.6}>
            <MaterialCommunityIcons
              name="close"
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Container (renders active toasts) ───────────────────────────────────────

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToastInternal();
  const insets = useSafeAreaInsets();

  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom + spacing.md;

  if (toasts.length === 0) return null;

  return (
    <>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          bottomOffset={bottomOffset}
        />
      ))}
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toastWrapper: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 56,
    paddingRight: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
    marginRight: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text,
    lineHeight: 20,
    paddingVertical: spacing.md,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginLeft: spacing.sm,
  },
  actionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
});
