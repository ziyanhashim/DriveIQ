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
        <Text style={{ marginTop: 10, fontWeight: "800", color: "#667085" }}>
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
    .map((r: any) => r?.analysis?.overall ?? r?.performance_score)
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
                    <View style={[styles.scorePill, { backgroundColor: score >= 70 ? "#ECFDF3" : "#FEF2F2" }]}>
                      <Text style={[styles.scoreText, { color: score >= 70 ? "#16A34A" : "#B91C1C" }]}>
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
  page: { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: 16, paddingBottom: 28 },

  header: {
    paddingVertical: 10,
    marginBottom: 12,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4, alignSelf: "flex-start" },
  backText: { color: "#2563EB", fontWeight: "900", fontSize: 13 },

  title: { color: "#0B1220", fontWeight: "900", fontSize: 22, marginTop: 8 },
  subTitle: { color: "#667085", fontWeight: "700", fontSize: 12, marginTop: 6 },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 16,
    padding: 14,
  },

  topRow: { flexDirection: "row", alignItems: "center" },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#4F46E5", fontWeight: "900", fontSize: 16 },

  name: { color: "#101828", fontWeight: "900", fontSize: 16 },
  emailText: { color: "#667085", fontWeight: "700", fontSize: 12, marginTop: 4 },

  section: { marginTop: 16 },
  sectionTitle: { color: "#101828", fontWeight: "900", fontSize: 13, marginBottom: 10 },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F2F4F7",
  },
  kLabel: { color: "#667085", fontWeight: "800", fontSize: 12 },
  kValue: { color: "#101828", fontWeight: "900", fontSize: 12 },

  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F2F4F7",
  },
  sessionDate: { color: "#101828", fontWeight: "900", fontSize: 12 },
  sessionMeta: { color: "#667085", fontWeight: "700", fontSize: 11, marginTop: 2 },

  scorePill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: "center",
  },
  scoreText: { fontWeight: "900", fontSize: 13 },

  emptyTitle: { color: "#101828", fontWeight: "900", fontSize: 14 },
  emptyText: { color: "#667085", fontWeight: "700", fontSize: 12, marginTop: 6 },
});
