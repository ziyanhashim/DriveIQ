import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, card, radius, btn, type_, fonts } from "../lib/theme";
import AnimatedPressable from "./AnimatedPressable";
import FadeInView from "./FadeInView";

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ icon = "document-text-outline", title, text, actionLabel, onAction }: EmptyStateProps) {
  return (
    <FadeInView>
      <View style={s.container}>
        <Ionicons name={icon} size={44} color={colors.muted} />
        {title ? <Text style={s.title}>{title}</Text> : null}
        <Text style={s.text}>{text}</Text>
        {actionLabel && onAction ? (
          <AnimatedPressable onPress={onAction} style={s.action}>
            <Text style={s.actionText}>{actionLabel}</Text>
          </AnimatedPressable>
        ) : null}
      </View>
    </FadeInView>
  );
}

const s = StyleSheet.create({
  container: {
    ...card.base,
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  text: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.subtext,
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 21,
  },
  action: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  actionText: {
    ...type_.btnOutline,
  },
});
