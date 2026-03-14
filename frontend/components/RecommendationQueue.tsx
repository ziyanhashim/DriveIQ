import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { colors, card, radius, space, fonts } from "../lib/theme";
import AnimatedPressable from "./AnimatedPressable";
import FadeInView from "./FadeInView";

export type Recommendation = {
  id: string;
  icon: string;
  title: string;
  message: string;
  score?: number;
  priority?: "high" | "medium" | "low";
};

type RecommendationQueueProps = {
  items: Recommendation[];
  maxVisible?: number;
};

const PRIORITY_COLORS: Record<string, string> = {
  high: colors.red,
  medium: colors.amber,
  low: colors.blue,
};

export default function RecommendationQueue({ items, maxVisible = 3 }: RecommendationQueueProps) {
  const [expanded, setExpanded] = useState(false);

  // Sort by priority: high first
  const sorted = [...items].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority ?? "low"] ?? 2) - (order[b.priority ?? "low"] ?? 2);
  });

  const visible = expanded ? sorted : sorted.slice(0, maxVisible);
  const remaining = sorted.length - maxVisible;

  return (
    <View style={s.container}>
      {visible.map((item, index) => {
        const borderColor = PRIORITY_COLORS[item.priority ?? "low"] ?? colors.blue;
        return (
          <FadeInView key={item.id} delay={index * 80}>
            <View style={[s.item, { borderLeftColor: borderColor }]}>
              <View style={s.header}>
                <View style={s.headerLeft}>
                  <Text style={s.icon}>{item.icon}</Text>
                  <Text style={s.title}>{item.title}</Text>
                </View>
                {item.score !== undefined && (
                  <View style={s.scorePill}>
                    <Text style={s.scoreText}>{item.score}%</Text>
                  </View>
                )}
              </View>
              <Text style={s.message}>{item.message}</Text>
            </View>
          </FadeInView>
        );
      })}

      {!expanded && remaining > 0 && (
        <AnimatedPressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(true); }} style={s.showMore}>
          <Text style={s.showMoreText}>Show {remaining} more recommendation{remaining > 1 ? "s" : ""}</Text>
        </AnimatedPressable>
      )}

      {expanded && remaining > 0 && (
        <AnimatedPressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(false); }} style={s.showMore}>
          <Text style={s.showMoreText}>Show less</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 12,
  },
  item: {
    ...card.inner,
    borderLeftWidth: 4,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textAlt,
    flex: 1,
  },
  scorePill: {
    backgroundColor: colors.purpleLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.purpleBorder,
  },
  scoreText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.purpleDark,
  },
  message: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.subtext,
    lineHeight: 20,
  },
  showMore: {
    alignItems: "center",
    paddingVertical: 8,
  },
  showMoreText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.blue,
  },
});
