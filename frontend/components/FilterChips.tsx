import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors, radius, fonts } from "../lib/theme";
import AnimatedPressable from "./AnimatedPressable";

export type ChipOption = {
  label: string;
  count?: number;
  color?: string;
};

type FilterChipsProps = {
  options: ChipOption[] | string[];
  value: string;
  onChange: (label: string) => void;
  showCounts?: boolean;
};

function normalizeOptions(options: ChipOption[] | string[]): ChipOption[] {
  return options.map((o) =>
    typeof o === "string" ? { label: o } : o
  );
}

export default function FilterChips({ options, value, onChange, showCounts = false }: FilterChipsProps) {
  const chips = normalizeOptions(options);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.scroll}
    >
      {chips.map((chip) => {
        const active = chip.label === value;
        const chipColor = chip.color ?? colors.blue;

        return (
          <AnimatedPressable
            key={chip.label}
            onPress={() => onChange(chip.label)}
            scaleDown={0.95}
            style={[
              s.chip,
              active && { backgroundColor: chipColor, borderColor: chipColor },
            ]}
          >
            {!active && chip.color && (
              <View style={[s.dot, { backgroundColor: chipColor }]} />
            )}
            <Text
              style={[
                s.chipText,
                active && { color: "#FFFFFF", fontFamily: fonts.semibold },
              ]}
            >
              {chip.label}
              {showCounts && chip.count !== undefined ? ` (${chip.count})` : ""}
            </Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderMid,
    backgroundColor: colors.cardBg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 13,
    color: colors.subtext,
    fontFamily: fonts.medium,
  },
});
