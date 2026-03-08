/**
 * AnimatedCounter — Animates a number from 0 to target value
 */

import React, { useEffect, useRef } from "react";
import { Animated, Text, TextStyle, StyleSheet } from "react-native";
import { animation } from "../../theme";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  delay?: number;
  style?: TextStyle;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 800,
  delay = 0,
  style,
  prefix = "",
  suffix = "",
  decimalPlaces = 0,
}) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const [displayText, setDisplayText] = React.useState(`${prefix}0${suffix}`);

  useEffect(() => {
    animValue.setValue(0);

    const timeout = setTimeout(() => {
      Animated.timing(animValue, {
        toValue: value,
        duration,
        useNativeDriver: false, // required for text updates
      }).start();
    }, delay);

    const listenerId = animValue.addListener(({ value: v }) => {
      const formatted =
        decimalPlaces > 0 ? v.toFixed(decimalPlaces) : Math.round(v).toString();
      setDisplayText(`${prefix}${formatted}${suffix}`);
    });

    return () => {
      clearTimeout(timeout);
      animValue.removeListener(listenerId);
    };
  }, [value, duration, delay, prefix, suffix, decimalPlaces, animValue]);

  return <Text style={style}>{displayText}</Text>;
};
