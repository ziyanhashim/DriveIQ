import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiGet } from "../../lib/api";
import { colors, fonts, radius, space } from "../../lib/theme";

function initialsFromName(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (a + b).toUpperCase() || "—";
}

export default function StudentProfileScreen() {
  const routerNav = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    apiGet(`/instructor/student/${id}/history`)
      .then((data: any) => {
        setStudent(data?.student || null);
        setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
        setResults(Array.isArray(data?.results) ? data.results : []);
      })
      .catch((e: any) => {
        setError(e?.message || "Failed to load student profile");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.page, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10, fontFamily: fonts.extrabold, color: colors.subtextAlt }}>
          Loading student profile…
        </Text>
      </View>
    );
  }

  if (error || !student) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => routerNav.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Student Profile</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>{error ? "Error" : "Student not found"}</Text>
          <Text style={styles.emptyText}>{error || "No data available for this student."}</Text>
        </View>
      </ScrollView>
    );
  }

  // Compute overview stats
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const scores = results
    .map((r: any) => r?.performance_score ?? r?.analysis?.overall)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const lastSession = sessions[0];
  const lastSessionDate = lastSession?.created_at
    ? new Date(lastSession.created_at).toLocaleDateString()
    : lastSession?.started_at
    ? new Date(lastSession.started_at).toLocaleDateString()
    : "—";

  const name = student?.name || student?.user_id || "—";
  const email = student?.email || "—";
  const initials = initialsFromName(name);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => routerNav.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Student Profile</Text>
        <Text style={styles.subTitle}>{email}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.emailText}>{email}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.kvRow}>
            <Text style={styles.kLabel}>Sessions Completed</Text>
            <Text style={styles.kValue}>{completedCount}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kLabel}>Last Session</Text>
            <Text style={styles.kValue}>{lastSessionDate}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kLabel}>Average Score</Text>
            <Text style={styles.kValue}>{avgScore !== null ? `${avgScore}` : "—"}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kLabel}>Total Results</Text>
            <Text style={styles.kValue}>{results.length}</Text>
          </View>
        </View>

        {sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            {sessions.slice(0, 5).map((s: any, i: number) => {
              const date = s?.created_at
                ? new Date(s.created_at).toLocaleDateString()
                : "—";
              const status = s?.status || "—";
              const score = s?.performance_score;
              return (
                <View key={s?.session_id || i} style={styles.sessionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionDate}>{date}</Text>
                    <Text style={styles.sessionMeta}>
                      {s?.road_type ? `${s.road_type} · ` : ""}{status}
                    </Text>
                  </View>
                  {typeof score === "number" && score > 0 ? (
                    <View style={[styles.scorePill, { backgroundColor: score >= 60 ? colors.greenLight : colors.redLight }]}>
                      <Text style={[styles.scoreText, { color: score >= 60 ? colors.green : colors.redDark }]}>
                        {score}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBgAlt },
  content: { padding: space.lg, paddingBottom: 28 },

  header: {
    paddingVertical: 10,
    marginBottom: space.md,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: space.xs, alignSelf: "flex-start" },
  backText: { color: colors.blue, fontFamily: fonts.extrabold, fontSize: 13 },

  title: { color: colors.text, fontFamily: fonts.extrabold, fontSize: 22, marginTop: space.sm },
  subTitle: { color: colors.subtextAlt, fontFamily: fonts.bold, fontSize: 12, marginTop: 6 },

  card: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.lg,
  },

  topRow: { flexDirection: "row", alignItems: "center" },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.blueDark,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  avatarText: { color: "#FFFFFF", fontFamily: fonts.extrabold, fontSize: 16 },

  name: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 16 },
  emailText: { color: colors.subtextAlt, fontFamily: fonts.bold, fontSize: 12, marginTop: space.xs },

  section: { marginTop: space.lg },
  sectionTitle: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 13, marginBottom: 10 },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  kLabel: { color: colors.subtextAlt, fontFamily: fonts.extrabold, fontSize: 12 },
  kValue: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 12 },

  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  sessionDate: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 12 },
  sessionMeta: { color: colors.subtextAlt, fontFamily: fonts.bold, fontSize: 11, marginTop: 2 },

  scorePill: {
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: "center",
  },
  scoreText: { fontFamily: fonts.extrabold, fontSize: 13 },

  emptyTitle: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 14 },
  emptyText: { color: colors.subtextAlt, fontFamily: fonts.bold, fontSize: 12, marginTop: 6 },
});
