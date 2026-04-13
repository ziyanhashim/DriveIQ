import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { apiGet } from "../../lib/api";
import { colors, fonts, radius, page, space } from "../../lib/theme";
import FadeInView from "../../components/FadeInView";
import AnimatedPressable from "../../components/AnimatedPressable";
import MetricCard from "../../components/MetricCard";
import SessionCard from "../../components/SessionCard";
import EmptyState from "../../components/EmptyState";
import FilterChips from "../../components/FilterChips";

// ─── Types ──────────────────────────────────────────────────────────────────

type SessionSummary = {
  session_id: string;
  date: string;
  road_type: string;
  performance_score: number;
  passed: boolean;
  duration_minutes: number;
  window_summary: {
    total: number;
    normal: number;
    drowsy: number;
    aggressive: number;
  };
  instructor_name?: string;
  report_ready?: boolean;
};

const PAGE_SIZE = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReportsListScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [roadFilter, setRoadFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"date" | "score">("date");

  async function loadSessions() {
    try {
      setError(null);
      const data = await apiGet("/sessions/my-reports");
      setSessions(data?.sessions ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load sessions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadSessions(); }, []);
  useFocusEffect(useCallback(() => { loadSessions(); }, []));

  function onRefresh() {
    setRefreshing(true);
    loadSessions();
  }

  // ── Computed stats ──────────────────────────────────────────────────────
  const avgScore = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.round(sessions.reduce((sum, s) => sum + s.performance_score, 0) / sessions.length);
  }, [sessions]);

  const passRate = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.round((sessions.filter((s) => s.passed).length / sessions.length) * 100);
  }, [sessions]);

  // ── Filter + sort options ──────────────────────────────────────────────
  const normalizeRoadType = (rt: string) => {
    const low = rt.trim().toLowerCase();
    if (low.startsWith("motor")) return "Motorway";
    if (low.startsWith("second")) return "Secondary";
    return rt.trim();
  };

  const roadTypes = useMemo(() => {
    const types = new Set(sessions.map((s) => s.road_type).filter(Boolean).map(normalizeRoadType));
    return ["All", ...Array.from(types)];
  }, [sessions]);

  const filtered = useMemo(() => {
    let list = sessions;
    if (roadFilter !== "All") {
      list = list.filter((s) => normalizeRoadType(s.road_type) === roadFilter);
    }
    if (sortBy === "score") {
      list = [...list].sort((a, b) => b.performance_score - a.performance_score);
    }
    return list;
  }, [sessions, roadFilter, sortBy]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={page.center}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={page.centerText}>Loading reports…</Text>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={page.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.red} />
        <Text style={[page.centerText, { color: colors.red }]}>{error}</Text>
        <Pressable onPress={loadSessions} style={ls.retryBtn}>
          <Text style={ls.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={page.base}>
      <ScrollView
        contentContainerStyle={[page.content, { paddingTop: 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
        }
      >
        {/* Header */}
        <FadeInView delay={0}>
        <View style={ls.header}>
          <Text style={ls.headerTitle}>My Reports</Text>
          <Text style={ls.headerSub}>
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} completed
          </Text>
        </View>
        </FadeInView>

        {/* Summary Stats */}
        {sessions.length > 0 && (
          <FadeInView delay={80}>
          <View style={ls.statsRow}>
            <MetricCard label="Total Sessions" value={sessions.length} icon="📊" tintKey="blue" />
            <MetricCard label="Avg Score" value={`${avgScore}%`} icon="🎯" tintKey={avgScore >= 80 ? "green" : avgScore >= 60 ? "yellow" : "red"} />
            <MetricCard label="Good Sessions" value={`${passRate}%`} icon="✅" tintKey="green" subtitle={`${sessions.filter((s) => s.passed).length} above target`} />
          </View>
          </FadeInView>
        )}

        {/* Filter / Sort Bar */}
        {sessions.length > 0 && (
          <FadeInView delay={120}>
          <View style={ls.filterRow}>
            <FilterChips options={roadTypes} value={roadFilter} onChange={setRoadFilter} />
            <AnimatedPressable
              onPress={() => setSortBy(sortBy === "date" ? "score" : "date")}
              style={ls.sortBtn}
            >
              <Ionicons name={sortBy === "date" ? "calendar-outline" : "trending-up-outline"} size={14} color={colors.subtext} />
              <Text style={ls.sortBtnText}>
                {sortBy === "date" ? "By Date" : "By Score"}
              </Text>
            </AnimatedPressable>
          </View>
          </FadeInView>
        )}

        {/* Session Cards */}
        {filtered.length === 0 ? (
          <EmptyState
            title="No reports yet"
            text="Your driving session reports will appear here after your instructor processes them."
          />
        ) : (
          <View style={{ gap: 14 }}>
            {visible.map((session) => (
              <SessionCard
                key={session.session_id}
                sessionId={session.session_id}
                date={session.date}
                roadType={session.road_type}
                performanceScore={session.performance_score}
                passed={session.passed}
                durationMinutes={session.duration_minutes}
                windowSummary={session.window_summary}
                reportReady={session.report_ready}
                variant="full"
                onPress={() =>
                  router.push({
                    pathname: "/(studenttabs)/session-report",
                    params: { sessionId: session.session_id, from: "reports" },
                  })
                }
              />
            ))}

            {/* Load More */}
            {hasMore && (
              <AnimatedPressable
                onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                style={ls.loadMoreBtn}
              >
                <Text style={ls.loadMoreText}>
                  Load More ({filtered.length - visibleCount} remaining)
                </Text>
              </AnimatedPressable>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const ls = StyleSheet.create({
  header: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.5,
    fontFamily: fonts.extrabold,
  },
  headerSub: {
    fontSize: 14,
    color: colors.subtext,
    marginTop: 4,
    fontFamily: fonts.regular,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  sortBtnText: {
    fontSize: 12,
    color: colors.subtext,
    fontFamily: fonts.semibold,
  },
  loadMoreBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  loadMoreText: {
    fontSize: 13,
    color: colors.blue,
    fontFamily: fonts.semibold,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
  },
  retryBtnText: {
    fontSize: 14,
    color: colors.cardBg,
    fontFamily: fonts.bold,
  },
});
