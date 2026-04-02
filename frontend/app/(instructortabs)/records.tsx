import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "../../lib/api";
import { colors, fonts, radius, space, shadow, card, page, tint } from "../../lib/theme";
import FadeInView from "../../components/FadeInView";

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function scoreColor(s: number) {
  if (s >= 80) return colors.green;
  if (s >= 60) return colors.yellow;
  return colors.red;
}

function scoreTintKey(s: number) {
  if (s >= 80) return "green" as const;
  if (s >= 60) return "yellow" as const;
  return "red" as const;
}

function roadTypeFrom(result: any): string {
  if (result?.road_type) return result.road_type;
  const csv: string = result?.dataset_used?.csv || "";
  if (csv.toLowerCase().includes("motorway")) return "Motorway";
  if (csv.toLowerCase().includes("secondary")) return "Secondary";
  return "—";
}

// ─── Types ──────────────────────────────────────────────────────────────────

type SessionResult = {
  session_id: string;
  date: string;
  roadType: string;
  score: number;
  passed: boolean;
  behavior: string;
};

type LearnerGroup = {
  learnerId: string;
  name: string;
  sessionCount: number;
  avgScore: number;
  sessions: SessionResult[];
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState<any[]>([]);
  const [resultsRaw, setResultsRaw] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "score">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const [l, r, sess] = await Promise.all([
        apiGet("/instructor/learners").catch(() => []),
        apiGet("/records/instructor").catch(() => []),
        apiGet("/sessions").catch(() => []),
      ]);
      setLearners(Array.isArray(l) ? l : []);
      setResultsRaw(Array.isArray(r) ? r : []);

      // Enrich learners with names from sessions (covers mismatched bookings)
      const sessArr = Array.isArray(sess) ? sess : [];
      const knownIds = new Set((Array.isArray(l) ? l : []).map((x: any) => x?.user_id));
      for (const s of sessArr) {
        if (s?.trainee_id && s?.trainee_name && !knownIds.has(s.trainee_id)) {
          (Array.isArray(l) ? l : []).push({ user_id: s.trainee_id, name: s.trainee_name, role: "trainee" });
          knownIds.add(s.trainee_id);
        }
      }
      setLearners(Array.isArray(l) ? [...l] : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  // Map user_id → name (from learners + result docs)
  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of learners) {
      if (l?.user_id) m[l.user_id] = l?.name || l?.email || "Unknown";
    }
    // Also pick up names from result docs (trainee_name or instructor_name fields)
    for (const r of resultsRaw) {
      const tid = r?.trainee_id;
      if (tid && !m[tid]) {
        m[tid] = r?.trainee_name || r?.instructor_name || "Unknown Student";
      }
    }
    return m;
  }, [learners, resultsRaw]);

  // Group results by learner, keep individual sessions
  const groups: LearnerGroup[] = useMemo(() => {
    const byTrainee = new Map<string, any[]>();
    for (const r of resultsRaw) {
      const tid = r?.trainee_id;
      if (!tid) continue;
      if (!byTrainee.has(tid)) byTrainee.set(tid, []);
      byTrainee.get(tid)!.push(r);
    }

    return Array.from(byTrainee.entries()).map(([traineeId, results]) => {
      results.sort((a, b) => {
        const da = a?.created_at ? Date.parse(a.created_at) : 0;
        const db = b?.created_at ? Date.parse(b.created_at) : 0;
        return db - da;
      });

      const scores = results
        .map((r) => r?.performance_score ?? r?.analysis?.overall ?? 0)
        .filter((s) => s > 0);
      const avgScore = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      const sessions: SessionResult[] = results.map((r) => ({
        session_id: r?.session_id || "",
        date: fmtDate(r?.created_at),
        roadType: roadTypeFrom(r),
        score: r?.performance_score ?? r?.analysis?.overall ?? 0,
        passed: (r?.performance_score ?? r?.analysis?.overall ?? 0) >= 60,
        behavior: r?.analysis?.behavior || "—",
      }));

      return {
        learnerId: traineeId,
        name: nameById[traineeId] || "Unknown",
        sessionCount: results.length,
        avgScore,
        sessions,
      };
    });
  }, [resultsRaw, nameById]);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = groups.filter((g) => !q || g.name.toLowerCase().includes(q));

    if (sortBy === "name") {
      list.sort((a, b) => sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else {
      list.sort((a, b) => sortDir === "asc" ? a.avgScore - b.avgScore : b.avgScore - a.avgScore);
    }
    return list;
  }, [groups, search, sortBy, sortDir]);

  if (loading) {
    return (
      <View style={page.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.h1}>Student Reports</Text>
      <Text style={s.h2}>{groups.length} student{groups.length !== 1 ? "s" : ""} with session history</Text>

      {/* Search + Sort */}
      <FadeInView delay={0}>
        <View style={s.filterRow}>
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={16} color={colors.muted} style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by student name..."
              placeholderTextColor={colors.muted}
              style={s.searchInput}
            />
          </View>
          <Pressable
            onPress={() => {
              if (sortBy === "name") { setSortDir((d) => d === "asc" ? "desc" : "asc"); }
              else { setSortBy("name"); setSortDir("asc"); }
            }}
            style={[s.sortBtn, sortBy === "name" && s.sortBtnActive]}
          >
            <Ionicons name={sortDir === "asc" && sortBy === "name" ? "arrow-up" : "arrow-down"} size={14} color={sortBy === "name" ? colors.purpleDark : colors.subtext} />
            <Text style={[s.sortBtnText, sortBy === "name" && { color: colors.purpleDark }]}>A-Z</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (sortBy === "score") { setSortDir((d) => d === "asc" ? "desc" : "asc"); }
              else { setSortBy("score"); setSortDir("desc"); }
            }}
            style={[s.sortBtn, sortBy === "score" && s.sortBtnActive]}
          >
            <Ionicons name={sortDir === "desc" && sortBy === "score" ? "arrow-down" : "arrow-up"} size={14} color={sortBy === "score" ? colors.purpleDark : colors.subtext} />
            <Text style={[s.sortBtnText, sortBy === "score" && { color: colors.purpleDark }]}>Score</Text>
          </Pressable>
        </View>
      </FadeInView>

      {/* Learner List */}
      {filtered.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>
            {search ? "No students match your search." : "No student reports yet."}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((group, idx) => {
            const isExpanded = expandedIds.has(group.learnerId);
            return (
              <FadeInView key={group.learnerId} delay={idx * 40}>
                <Pressable
                  onPress={() => setExpandedIds((prev) => {
                    const next = new Set(prev);
                    if (isExpanded) next.delete(group.learnerId);
                    else next.add(group.learnerId);
                    return next;
                  })}
                  style={({ pressed }) => [s.learnerCard, pressed && { opacity: 0.95 }]}
                >
                  {/* Collapsed header */}
                  <View style={s.learnerHeader}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{initials(group.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.learnerName}>{group.name}</Text>
                      <Text style={s.learnerMeta}>
                        {group.sessionCount} session{group.sessionCount !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <View style={[s.scoreBadge, { backgroundColor: tint[scoreTintKey(group.avgScore)].bg }]}>
                      <Text style={[s.scoreText, { color: scoreColor(group.avgScore) }]}>
                        {group.avgScore}
                      </Text>
                      <Text style={[s.scoreUnit, { color: scoreColor(group.avgScore) }]}>/100</Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.muted}
                      style={{ marginLeft: 4 }}
                    />
                  </View>

                  {/* Expanded session list */}
                  {isExpanded && (
                    <View style={s.sessionList}>
                      {group.sessions.map((sess) => (
                        <View key={sess.session_id} style={s.sessionRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.sessionDate}>{sess.date}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                              <View style={s.roadPill}>
                                <Text style={s.roadPillText}>{sess.roadType}</Text>
                              </View>
                              <View style={[s.statusPill, { backgroundColor: sess.passed ? colors.green : colors.yellow }]}>
                                <Text style={s.statusPillText}>{sess.passed ? "Good" : "Needs Work"}</Text>
                              </View>
                            </View>
                          </View>
                          <View style={[s.sessionScore, { backgroundColor: tint[scoreTintKey(sess.score)].bg }]}>
                            <Text style={[s.sessionScoreText, { color: scoreColor(sess.score) }]}>
                              {sess.score}
                            </Text>
                          </View>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              router.push({
                                pathname: "/(instructortabs)/session-report" as any,
                                params: { sessionId: sess.session_id },
                              });
                            }}
                            style={({ pressed }) => [s.viewBtn, pressed && { opacity: 0.8 }]}
                          >
                            <Text style={s.viewBtnText}>View</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              </FadeInView>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: space.page, paddingBottom: 32, gap: 14 },

  h1: { fontSize: 22, fontFamily: fonts.extrabold, color: colors.textAlt, letterSpacing: -0.5 },
  h2: { fontSize: 12, fontFamily: fonts.bold, color: colors.subtext, marginTop: 2 },

  // Filter
  filterRow: { flexDirection: "row", gap: 10 },
  searchWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.input, paddingHorizontal: 12, minHeight: 46,
  },
  searchInput: { flex: 1, color: colors.textAlt, fontSize: 13, fontFamily: fonts.bold },
  sortBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, minHeight: 46,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.input,
  },
  sortBtnActive: { borderColor: colors.purpleBorder, backgroundColor: tint.purple.bg },
  sortBtnText: { fontSize: 12, fontFamily: fonts.bold, color: colors.subtext, userSelect: "none" },

  // Learner card
  learnerCard: {
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.cardLg, padding: space.lg, ...shadow.sm,
  },
  learnerHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: tint.purple.bg, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.purpleDark },
  learnerName: { fontSize: 14, fontFamily: fonts.bold, color: colors.textAlt },
  learnerMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.subtext, marginTop: 2 },
  scoreBadge: {
    flexDirection: "row", alignItems: "baseline",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  scoreText: { fontSize: 16, fontFamily: fonts.extrabold },
  scoreUnit: { fontSize: 10, fontFamily: fonts.bold, marginLeft: 1 },

  // Session list (expanded)
  sessionList: {
    marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 8,
  },
  sessionRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.pageBg, borderRadius: radius.input, padding: space.md,
  },
  sessionDate: { fontSize: 13, fontFamily: fonts.bold, color: colors.textAlt },
  roadPill: {
    backgroundColor: tint.blue.bg, borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  roadPillText: { fontSize: 10, fontFamily: fonts.bold, color: colors.blue },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontSize: 10, fontFamily: fonts.extrabold, color: "#fff" },
  sessionScore: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  sessionScoreText: { fontSize: 14, fontFamily: fonts.extrabold },
  viewBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.darkBtn, borderRadius: radius.input,
  },
  viewBtnText: { fontSize: 12, fontFamily: fonts.bold, color: "#fff" },

  // Empty
  emptyCard: {
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.cardLg, padding: 32, alignItems: "center",
  },
  emptyText: { fontSize: 13, fontFamily: fonts.bold, color: colors.muted, textAlign: "center" },
});
