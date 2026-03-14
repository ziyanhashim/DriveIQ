import React from "react";
import { Pressable, Platform, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { cursor } from "../lib/theme";

type AnimatedPressableProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  scaleDown?: number;
  hitSlop?: number;
};

const SPRING_CONFIG = { damping: 15, stiffness: 300, mass: 0.8 };

const AnimatedPressableInner = Animated.createAnimatedComponent(Pressable);

export default function AnimatedPressable({
  children,
  onPress,
  disabled = false,
  style,
  scaleDown = 0.97,
  hitSlop,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(scaleDown, SPRING_CONFIG);
    opacity.value = withSpring(0.85, SPRING_CONFIG);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
    opacity.value = withSpring(1, SPRING_CONFIG);
  };

  const handleHoverIn = () => {
    if (disabled) return;
    scale.value = withSpring(1.015, SPRING_CONFIG);
  };

  const handleHoverOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  const webProps = Platform.OS === "web" ? {
    onHoverIn: handleHoverIn,
    onHoverOut: handleHoverOut,
  } : {};

  return (
    <AnimatedPressableInner
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      style={[
        animatedStyle,
        disabled ? cursor.notAllowed : cursor.pointer,
        disabled && s.disabled,
        style,
      ]}
      {...webProps}
    >
      {children}
    </AnimatedPressableInner>
  );
}

const s = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
});
