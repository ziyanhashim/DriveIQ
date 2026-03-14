import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors, fonts } from "../lib/theme";
import AnimatedCounter from "./AnimatedCounter";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ScoreRingProps = {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
};

function getScoreColor(score: number) {
  if (score >= 80) return colors.green;
  if (score >= 60) return colors.amber;
  return colors.red;
}

export default function ScoreRing({ score, size = 100, strokeWidth = 8, showLabel = true }: ScoreRingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const color = getScoreColor(score);

  const animatedOffset = useSharedValue(circumference);

  useEffect(() => {
    const progress = Math.min(100, Math.max(0, score));
    const targetOffset = circumference - (progress / 100) * circumference;
    animatedOffset.value = withDelay(
      200,
      withTiming(targetOffset, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: animatedOffset.value,
  }));

  return (
    <View style={[s.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={s.svg}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated progress arc */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={s.labelWrap}>
        <AnimatedCounter
          value={score}
          duration={1200}
          style={[s.scoreText, { color }]}
        />
        {showLabel && (
          <AnimatedCounter
            value={0}
            duration={0}
            suffix="/ 100"
            style={s.unitText}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    position: "absolute",
  },
  labelWrap: {
    alignItems: "center",
  },
  scoreText: {
    fontFamily: fonts.monoBold,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  unitText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.muted,
    marginTop: -2,
  },
});
