import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, radius, space } from "../../lib/theme";

const MOCK_NOTIFICATIONS: Record<
  string,
  { id: string; title: string; timeLabel: string; body: string }
> = {
  n1: {
    id: "n1",
    title: "Report ready for Student A",
    timeLabel: "5 min ago",
    body: "A performance report has been generated. You can review it and share notes with the learner.",
  },
  n2: {
    id: "n2",
    title: "Session scheduled for 3:30 PM",
    timeLabel: "1 hour ago",
    body: "A new session was scheduled. Please make sure availability and location details are confirmed.",
  },
  n3: {
    id: "n3",
    title: "Vehicle VEH-2847 maintenance due",
    timeLabel: "2 hours ago",
    body: "Vehicle maintenance is due. Please schedule service to avoid interruptions during lessons.",
  },
};

export default function NotificationDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const notif = useMemo(() => {
    if (!id) return null;
    return MOCK_NOTIFICATIONS[String(id)] ?? null;
  }, [id]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Notification</Text>

      {notif ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{notif.title}</Text>
          <Text style={styles.time}>{notif.timeLabel}</Text>

          <View style={styles.divider} />

          <Text style={styles.body}>{notif.body}</Text>

          <Pressable style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Acknowledge (mock)</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Not found</Text>
          <Text style={styles.body}>This notification ID doesn't exist in mock data.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBgAlt },
  content: { padding: space.lg, paddingBottom: 28 },

  backBtn: { paddingVertical: 6, paddingHorizontal: space.xs, alignSelf: "flex-start" },
  backText: { color: colors.blue, fontFamily: fonts.extrabold, fontSize: 13 },

  title: { color: colors.text, fontFamily: fonts.extrabold, fontSize: 22, marginTop: space.sm, marginBottom: space.md },

  card: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.lg,
  },
  cardTitle: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 14 },
  time: { color: colors.subtextAlt, fontFamily: fonts.bold, fontSize: 12, marginTop: 6 },

  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: space.md },

  body: { color: colors.text, fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },

  primaryBtn: {
    marginTop: space.lg,
    backgroundColor: colors.blue,
    borderRadius: radius.input,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { color: "#FFFFFF", fontFamily: fonts.extrabold, fontSize: 13 },
});
