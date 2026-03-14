import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, card, radius, type_, fonts } from "../lib/theme";
import AnimatedProgressBar from "./AnimatedProgressBar";

export type MatrixRow = {
  label: string;
  value: string | number;
  maxValue?: number;
  trend?: "up" | "down" | "flat";
};

type PerformanceMatrixProps = {
  rows: MatrixRow[];
  columns?: number;
};

const TREND_ICONS: Record<string, { symbol: string; color: string }> = {
  up: { symbol: "↑", color: colors.green },
  down: { symbol: "↓", color: colors.red },
  flat: { symbol: "—", color: colors.subtext },
};

export default function PerformanceMatrix({ rows, columns = 2 }: PerformanceMatrixProps) {
  const basisPct = columns === 3 ? "31%" : "48%";

  return (
    <View style={s.grid}>
      {rows.map((row, index) => {
        const trend = row.trend ? TREND_ICONS[row.trend] : null;
        const numVal = typeof row.value === "number" ? row.value : parseFloat(String(row.value));
        const pct = row.maxValue && !isNaN(numVal) ? Math.min(100, Math.max(0, (numVal / row.maxValue) * 100)) : null;
        const barColor = pct !== null ? (pct >= 80 ? colors.green : pct >= 60 ? colors.amber : colors.red) : colors.green;

        return (
          <View key={row.label} style={[s.cell, { flexBasis: basisPct as any }]}>
            <View style={s.cellHeader}>
              <Text style={s.cellLabel}>{row.label}</Text>
              {trend && (
                <Text style={[s.trendIcon, { color: trend.color }]}>{trend.symbol}</Text>
              )}
            </View>
            <Text style={s.cellValue}>{row.value}</Text>
            {pct !== null && (
              <AnimatedProgressBar percentage={pct} color={barColor} height={5} delay={index * 100} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cell: {
    ...card.inner,
    flexGrow: 1,
    minWidth: 140,
    padding: 14,
  },
  cellHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cellLabel: {
    ...type_.labelSm,
  },
  trendIcon: {
    fontSize: 14,
    fontFamily: fonts.extrabold,
  },
  cellValue: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.textAlt,
    marginTop: 6,
  },
});
