import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/theme";

type BehaviorBarProps = {
  normal: number;
  aggressive: number;
  drowsy: number;
  total: number;
  height?: number;
  showLegend?: boolean;
  showPercentages?: boolean;
};

export default function BehaviorBar({
  normal,
  aggressive,
  drowsy,
  total,
  height = 12,
  showLegend = true,
  showPercentages = false,
}: BehaviorBarProps) {
  if (total === 0) return null;

  const nPct = (normal / total) * 100;
  const dPct = (drowsy / total) * 100;
  const aPct = (aggressive / total) * 100;

  const segments = [
    { pct: nPct, color: colors.green, label: "Normal", count: normal },
    { pct: dPct, color: colors.amber, label: "Drowsy", count: drowsy },
    { pct: aPct, color: colors.red, label: "Aggressive", count: aggressive },
  ].filter((seg) => seg.pct > 0);

  return (
    <View>
      <View style={[s.track, { height }]}>
        {segments.map((seg, i) => (
          <View
            key={seg.label}
            style={[
              s.segment,
              {
                flex: seg.pct,
                backgroundColor: seg.color,
              },
              i === 0 && { borderTopLeftRadius: height / 2, borderBottomLeftRadius: height / 2 },
              i === segments.length - 1 && { borderTopRightRadius: height / 2, borderBottomRightRadius: height / 2 },
            ]}
          />
        ))}
      </View>
      {showLegend && (
        <View style={s.legend}>
          <LegendItem color={colors.green} label="Normal" count={normal} total={total} showPct={showPercentages} />
          <LegendItem color={colors.amber} label="Drowsy" count={drowsy} total={total} showPct={showPercentages} />
          <LegendItem color={colors.red} label="Aggressive" count={aggressive} total={total} showPct={showPercentages} />
        </View>
      )}
    </View>
  );
}

function LegendItem({ color, label, count, total, showPct }: { color: string; label: string; count: number; total: number; showPct: boolean }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={s.legendItem}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.legendText}>
        {label} {showPct ? `${pct}%` : count}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 999,
    overflow: "hidden",
  },
  segment: {
    height: "100%",
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.subtext,
  },
});
