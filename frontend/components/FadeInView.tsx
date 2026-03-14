import React, { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

type FadeInViewProps = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  translateY?: number;
  style?: any;
};

export default function FadeInView({
  children,
  delay = 0,
  duration = 400,
  translateY = 12,
  style,
}: FadeInViewProps) {
  const opacity = useSharedValue(0);
  const offsetY = useSharedValue(translateY);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    opacity.value = withDelay(delay, withTiming(1, { duration, easing }));
    offsetY.value = withDelay(delay, withTiming(0, { duration, easing }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offsetY.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}
