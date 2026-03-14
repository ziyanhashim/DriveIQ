import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from "react-native-reanimated";

type AnimatedCounterProps = {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  style?: any;
};

export default function AnimatedCounter({
  value,
  duration = 800,
  suffix = "",
  prefix = "",
  style,
}: AnimatedCounterProps) {
  const animatedValue = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayValue)(current);
      }
    },
    [animatedValue]
  );

  return (
    <Text style={style}>
      {prefix}{displayValue}{suffix}
    </Text>
  );
}
