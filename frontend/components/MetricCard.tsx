import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, type_, radius, space, card, tint, TintKey, fonts } from "../lib/theme";
import FadeInView from "./FadeInView";

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: string;
  tintKey: TintKey;
  subtitle?: string;
  delay?: number;
};

export default function MetricCard({ label, value, icon, tintKey, subtitle, delay }: MetricCardProps) {
  const t = tint[tintKey];
  const content = (
    <View style={s.card}>
      <View style={[s.iconBox, { backgroundColor: t.bg, borderColor: t.border }]}>
        <Text style={s.iconText}>{icon}</Text>
      </View>
      <View style={s.info}>
        <Text style={s.label} numberOfLines={1}>{label}</Text>
        <Text style={s.value} numberOfLines={1}>{value}</Text>
        {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </View>
  );

  if (delay !== undefined) {
    return <FadeInView delay={delay}>{content}</FadeInView>;
  }
  return content;
}

const s = StyleSheet.create({
  card: {
    ...card.base,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 150,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  label: {
    ...type_.labelSm,
  },
  value: {
    fontSize: 18,
    color: colors.textAlt,
    marginTop: 3,
    fontFamily: fonts.monoBold,
  },
  subtitle: {
    ...type_.bodySm,
    marginTop: 2,
    fontFamily: fonts.medium,
  },
});
