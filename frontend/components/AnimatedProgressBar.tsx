import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "../lib/theme";

type AnimatedProgressBarProps = {
  percentage: number;
  color: string;
  height?: number;
  delay?: number;
  duration?: number;
};

export default function AnimatedProgressBar({
  percentage,
  color,
  height = 6,
  delay = 0,
  duration = 600,
}: AnimatedProgressBarProps) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      delay,
      withTiming(Math.min(100, Math.max(0, percentage)), {
        duration,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [percentage]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%` as any,
    backgroundColor: color,
  }));

  return (
    <View style={[s.track, { height }]}>
      <Animated.View style={[s.fill, { height }, animatedStyle]} />
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    borderRadius: 999,
    backgroundColor: colors.borderFaint,
    overflow: "hidden",
  },
  fill: {
    borderRadius: 999,
  },
});
