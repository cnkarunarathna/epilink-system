/**
 * AnimatedCard — Wrapper with fade+scale entry and press-scale feedback
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  TouchableWithoutFeedback,
  ViewStyle,
  StyleSheet,
} from "react-native";
import { colors, borderRadius, shadows, animation } from "../../theme";

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
  onPress?: () => void;
  pressScale?: number;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  delay = 0,
  style,
  onPress,
  pressScale = 0.97,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleEntry = useRef(new Animated.Value(0.92)).current;
  const scalePress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animation.slow,
          useNativeDriver: true,
        }),
        Animated.spring(scaleEntry, {
          toValue: 1,
          ...animation.spring.gentle,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay, fadeAnim, scaleEntry]);

  const handlePressIn = () => {
    Animated.spring(scalePress, {
      toValue: pressScale,
      ...animation.spring.snappy,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scalePress, {
      toValue: 1,
      ...animation.spring.bouncy,
      useNativeDriver: true,
    }).start();
  };

  const animatedStyle: Animated.AnimatedProps<ViewStyle> = {
    opacity: fadeAnim,
    transform: [{ scale: Animated.multiply(scaleEntry, scalePress) }],
  };

  const content = (
    <Animated.View style={[styles.card, animatedStyle, style]}>
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableWithoutFeedback
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {content}
      </TouchableWithoutFeedback>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
});
