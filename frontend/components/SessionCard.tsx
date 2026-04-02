import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BehaviorBar from "./BehaviorBar";
import AnimatedPressable from "./AnimatedPressable";
import FadeInView from "./FadeInView";
import { colors, card, radius, space, fonts } from "../lib/theme";

type WindowSummary = {
  total: number;
  normal: number;
  drowsy: number;
  aggressive: number;
};

type SessionCardProps = {
  sessionId: string;
  date: string;
  roadType?: string;
  performanceScore: number;
  passed: boolean;
  durationMinutes?: number;
  windowSummary?: WindowSummary;
  instructorName?: string;
  reportReady?: boolean;
  variant?: "full" | "compact";
  delay?: number;
  onPress: () => void;
};

function getScoreColor(score: number) {
  if (score >= 80) return colors.green;
  if (score >= 60) return colors.amber;
  return colors.red;
}

function getScoreBg(score: number) {
  if (score >= 80) return colors.greenLight;
  if (score >= 60) return colors.amberBg;
  return colors.redLight;
}

export default function SessionCard({
  date,
  roadType,
  performanceScore,
  passed,
  durationMinutes,
  windowSummary,
  instructorName,
  reportReady = true,
  variant = "full",
  delay,
  onPress,
}: SessionCardProps) {
  const scoreColor = getScoreColor(performanceScore);
  const flagged = windowSummary ? windowSummary.aggressive + windowSummary.drowsy : 0;

  const cardContent = (
    <AnimatedPressable onPress={onPress} style={[card.base, s.card]}>
      {/* Top row: date + meta + score */}
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.date}>{date}</Text>
          <View style={s.metaRow}>
            {roadType && (
              <View style={s.metaItem}>
                <Ionicons name="car-outline" size={13} color={colors.subtext} />
                <Text style={s.metaText}>{roadType}</Text>
              </View>
            )}
            {durationMinutes !== undefined && (
              <View style={s.metaItem}>
                <Ionicons name="time-outline" size={13} color={colors.subtext} />
                <Text style={s.metaText}>{durationMinutes} min</Text>
              </View>
            )}
            {instructorName && variant === "compact" && (
              <View style={s.metaItem}>
                <Ionicons name="person-outline" size={13} color={colors.subtext} />
                <Text style={s.metaText}>{instructorName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Score badge */}
        {reportReady ? (
          <View style={[s.scoreBadge, { backgroundColor: getScoreBg(performanceScore) }]}>
            <Text style={[s.scoreText, { color: scoreColor }]}>{performanceScore}</Text>
            <Text style={[s.scoreUnit, { color: scoreColor }]}>/100</Text>
          </View>
        ) : (
          <View style={s.pendingBadge}>
            <Text style={s.pendingText}>Pending</Text>
          </View>
        )}
      </View>

      {/* Behavior bar (full variant only) */}
      {variant === "full" && windowSummary && windowSummary.total > 0 && (
        <BehaviorBar
          normal={windowSummary.normal}
          aggressive={windowSummary.aggressive}
          drowsy={windowSummary.drowsy}
          total={windowSummary.total}
          height={10}
          showLegend={false}
        />
      )}

      {/* Bottom row */}
      <View style={s.bottomRow}>
        <View style={s.statusRow}>
          {reportReady && (
            <View style={[s.statusBadge, { backgroundColor: passed ? colors.greenLight : colors.redLight }]}>
              <Ionicons
                name={passed ? "checkmark-circle" : "close-circle"}
                size={14}
                color={passed ? colors.green : colors.red}
              />
              <Text style={[s.statusText, { color: passed ? colors.greenDark : colors.redDark }]}>
                {passed ? "Good" : "Needs Work"}
              </Text>
            </View>
          )}
          {variant === "full" && flagged > 0 && (
            <View style={s.flaggedBadge}>
              <Ionicons name="warning-outline" size={12} color={colors.amberDark} />
              <Text style={s.flaggedText}>
                {flagged} flagged
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </View>
    </AnimatedPressable>
  );

  if (delay !== undefined) {
    return <FadeInView delay={delay}>{cardContent}</FadeInView>;
  }
  return cardContent;
}

const s = StyleSheet.create({
  card: {
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  date: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
    fontFamily: fonts.semibold,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.subtext,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 20,
    letterSpacing: -0.5,
    fontFamily: fonts.monoBold,
  },
  scoreUnit: {
    fontSize: 12,
    fontFamily: fonts.medium,
    marginLeft: 1,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.disabledBg,
    borderWidth: 1,
    borderColor: colors.disabledBorder,
  },
  pendingText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.disabled,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  flaggedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.amberBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  flaggedText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.amberDark,
  },
});
