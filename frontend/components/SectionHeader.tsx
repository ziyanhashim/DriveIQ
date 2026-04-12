import React from "react";
import { View, Text, StyleSheet, TextStyle } from "react-native";
import { colors, type_, radius, fonts } from "../lib/theme";

type SectionHeaderProps = {
  icon: string;
  iconBg?: string;
  label: string;
  count?: number;
  right?: React.ReactNode;
  labelStyle?: TextStyle;
};

export default function SectionHeader({ icon, iconBg = colors.borderLight, label, count, right, labelStyle }: SectionHeaderProps) {
  return (
    <View style={s.row}>
      <View style={s.left}>
        <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
          <Text style={s.iconText}>{icon}</Text>
        </View>
        <Text style={[s.label, labelStyle]}>{label}</Text>
        {count !== undefined && count > 0 && (
          <View style={s.countBadge}>
            <Text style={s.countText}>{count}</Text>
          </View>
        )}
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 16,
  },
  label: {
    ...type_.cardTitle,
  },
  countBadge: {
    backgroundColor: colors.blue,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: fonts.bold,
  },
});
