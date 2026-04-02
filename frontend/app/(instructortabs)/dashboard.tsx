import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "../../lib/api";
import {
  colors, fonts, type_, radius, space, shadow, card, page, tint,
} from "../../lib/theme";
import { LinearGradient } from "expo-linear-gradient";
import FadeInView from "../../components/FadeInView";
import AnimatedPressable from "../../components/AnimatedPressable";
import SectionHeader from "../../components/SectionHeader";
import MetricCard from "../../components/MetricCard";
import EmptyState from "../../components/EmptyState";

// ─── Types ──────────────────────────────────────────────────────────────────

type Summary = {
  total_learners: number;
  avg_score: number;
  total_sessions: number;
  rating: number;
  total_reviews: number;
};

type Booking = {
  booking_id: string;
  trainee_name: string;
  slot_date: string;
  start_time: string;
};

type RecentSession = {
  session_id: string;
  trainee_name?: string;
  trainee_id?: string;
  road_type?: string;
  status: string;
  performance_score?: number;
  created_at?: string;
  ended_at?: string;
};

type ActiveSession = {
  session_id: string;
  trainee_name?: string;
  road_type?: string;
  started_at?: string;
};

type DashData = {
  summary: Summary;
  learners: any[];
  recent_sessions: RecentSession[];
  upcoming_bookings: Booking[];
  active_session: ActiveSession | null;
  profile: any;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function fmtTime(time: string) {
  if (!time || time === "—") return "—";
  // Handle "09:00" or full ISO
  const t = time.includes("T") ? time.split("T")[1]?.slice(0, 5) : time.slice(0, 5);
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function dayLabel(slot_date: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (slot_date === today) return "Today";
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  if (slot_date === tom.toISOString().slice(0, 10)) return "Tomorrow";
  return fmtDate(slot_date);
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

// ─── Live Timer Hook ────────────────────────────────────────────────────────

function useLiveTimer(startedAt?: string) {
  const startMs = useMemo(() => {
    if (!startedAt) return 0;
    const withZ = startedAt.endsWith("Z") || startedAt.includes("+") ? startedAt : startedAt + "Z";
    const ms = Date.parse(withZ);
    return isFinite(ms) ? ms : 0;
  }, [startedAt]);

  const [elapsed, setElapsed] = useState(() =>
    startMs ? Math.max(0, Math.floor((Date.now() - startMs) / 1000)) : 0
  );

  useEffect(() => {
    if (!startMs) return;
    const t = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000))), 1000);
    return () => clearInterval(t);
  }, [startMs]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function InstructorDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashData | null>(null);

  async function load() {
    try {
      const d = await apiGet("/dashboard/instructor");
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.purpleDark} />
        <Text style={page.centerText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.red} />
        <Text style={[page.centerText, { color: colors.red, marginTop: 8 }]}>Failed to load</Text>
        <AnimatedPressable onPress={load} style={s.retryBtn}>
          <Text style={s.retryBtnText}>Retry</Text>
        </AnimatedPressable>
      </View>
    );
  }

  const { summary, recent_sessions, upcoming_bookings, active_session, profile } = data;
  const instructorName = profile?.name || "Instructor";

  const recents = recent_sessions
    .filter((ss) => ss.status === "completed")
    .slice(0, 4);

  const upcomingSorted = [...upcoming_bookings]
    .sort((a, b) => `${a.slot_date}T${a.start_time}` < `${b.slot_date}T${b.start_time}` ? -1 : 1)
    .slice(0, 4);

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── 1. Hero ───────────────────────────────────────────────────── */}
      <FadeInView delay={0}>
        <LinearGradient
          colors={[colors.purpleDark, "#4C1D95"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.heroHello}>Hello, {instructorName} 👋</Text>
            <Text style={s.heroSub}>Here's an overview of your teaching activity.</Text>
          </View>
        </LinearGradient>
      </FadeInView>

      {/* ── 2. Active Session Banner ──────────────────────────────────── */}
      {active_session && (
        <FadeInView delay={60}>
          <ActiveBanner session={active_session} />
        </FadeInView>
      )}

      {/* ── 3. KPI Strip ──────────────────────────────────────────────── */}
      <FadeInView delay={80}>
        <View style={s.kpiStrip}>
          <MetricCard
            label="Total Sessions"
            value={String(summary.total_sessions)}
            icon="📊"
            tintKey="blue"
            subtitle="completed"
          />
          <MetricCard
            label="Avg Student Score"
            value={summary.avg_score ? `${summary.avg_score}%` : "—"}
            icon="🎯"
            tintKey={scoreTintKey(summary.avg_score)}
            subtitle={summary.avg_score >= 80 ? "Excellent" : summary.avg_score >= 60 ? "Good" : "Needs Focus"}
          />
          <MetricCard
            label="My Rating"
            value={summary.rating ? summary.rating.toFixed(1) : "—"}
            icon="⭐"
            tintKey="yellow"
            subtitle={summary.total_reviews ? `${summary.total_reviews} reviews` : "No reviews yet"}
          />
          <MetricCard
            label="Upcoming"
            value={String(upcoming_bookings.length)}
            icon="🗓️"
            tintKey="purple"
            subtitle="sessions booked"
          />
        </View>
      </FadeInView>

      {/* ── 4. Upcoming Sessions ──────────────────────────────────────── */}
      <FadeInView delay={160}>
        <View style={card.base}>
          <SectionHeader
            icon="🗓️"
            iconBg={colors.greenBorderAlt}
            label="Upcoming Sessions"
            count={upcomingSorted.length > 0 ? upcomingSorted.length : undefined}
          />
          {upcomingSorted.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No upcoming sessions. Students will book through the app.</Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>
              {upcomingSorted.map((b) => (
                <UpcomingCard key={b.booking_id} booking={b} />
              ))}
            </View>
          )}
        </View>
      </FadeInView>

      {/* ── 5. Recent Sessions ────────────────────────────────────────── */}
      <FadeInView delay={240}>
        <View style={card.base}>
          <SectionHeader
            icon="📄"
            iconBg={colors.blueLighter}
            label="Recent Sessions"
          />
          {recents.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No completed sessions yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>
              {recents.map((rs) => (
                <RecentCard key={rs.session_id} session={rs} />
              ))}
            </View>
          )}
          {recents.length > 0 && (
            <AnimatedPressable
              onPress={() => router.push("/(instructortabs)/records" as any)}
              style={s.viewAllBtn}
            >
              <Text style={s.viewAllText}>View All Reports</Text>
            </AnimatedPressable>
          )}
        </View>
      </FadeInView>

      <AnimatedPressable onPress={load} style={s.outlineBtn}>
        <Text style={s.outlineBtnText}>↻ Refresh</Text>
      </AnimatedPressable>

      <Text style={s.footer}>© 2025 DriveIQ · Instructor Portal</Text>
    </ScrollView>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ActiveBanner({ session }: { session: ActiveSession }) {
  const timer = useLiveTimer(session.started_at);
  return (
    <AnimatedPressable
      onPress={() => router.push("/(instructortabs)/sessions" as any)}
      style={s.activeBanner}
    >
      <View style={s.activePulse}>
        <View style={s.activeDot} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.activeLive}>LIVE SESSION</Text>
        <Text style={s.activeStudent}>
          {session.trainee_name ?? "Student"}
          {session.road_type ? `  ·  ${session.road_type}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={s.activeTimer}>{timer}</Text>
        <View style={s.activeGo}>
          <Text style={s.activeGoText}>Manage →</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function UpcomingCard({ booking }: { booking: Booking }) {
  const label = dayLabel(booking.slot_date);
  const isToday = label === "Today";

  return (
    <Pressable
      onPress={() => router.push("/(instructortabs)/sessions" as any)}
      style={({ pressed }) => [
        s.upcomingCard,
        isToday && { borderColor: colors.purpleBorder, backgroundColor: colors.purpleLight },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={s.upcomingName}>{booking.trainee_name || "Student"}</Text>
          <Text style={s.upcomingMeta}>
            {label} at {fmtTime(booking.start_time)}
          </Text>
        </View>
        <View style={[s.countdownPill, isToday && { backgroundColor: tint.purple.bg }]}>
          <Text style={[s.countdownText, isToday && { color: colors.purpleDark }]}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function RecentCard({ session }: { session: RecentSession }) {
  const score = session.performance_score ?? 0;
  const name = session.trainee_name || "Student";
  const dateStr = fmtDate(session.ended_at || session.created_at);

  return (
    <Pressable
      onPress={() => router.push({
        pathname: "/(instructortabs)/session-report" as any,
        params: { sessionId: session.session_id },
      })}
      style={({ pressed }) => [s.recentCard, pressed && { opacity: 0.85 }]}
    >
      <View style={s.recentAvatar}>
        <Text style={s.recentAvatarText}>{initials(name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.recentName}>{name}</Text>
        <Text style={s.recentMeta}>
          {dateStr}{session.road_type ? ` · ${session.road_type}` : ""}
        </Text>
      </View>
      <View style={[s.scoreBadge, { backgroundColor: tint[scoreTintKey(score)].bg }]}>
        <Text style={[s.scoreText, { color: scoreColor(score) }]}>{score}</Text>
        <Text style={[s.scoreUnit, { color: scoreColor(score) }]}>/100</Text>
      </View>
    </Pressable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: space.page, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },

  // Hero
  hero: {
    borderRadius: radius.cardXl,
    padding: space.xl,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: colors.purpleDeep,
    borderBottomWidth: 2,
    ...shadow.cardRaised,
  },
  heroHello: { color: "#FFFFFF", fontSize: 16, fontFamily: fonts.bold },
  heroSub: { color: "rgba(255,255,255,0.82)", fontSize: 12, marginTop: 6, maxWidth: 320, fontFamily: fonts.medium },

  // Active session banner
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: radius.cardLg,
    padding: space.lg,
    gap: 12,
    ...shadow.card,
  },
  activePulse: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  activeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#22C55E" },
  activeLive: { fontSize: 10, fontFamily: fonts.extrabold, color: "#22C55E", letterSpacing: 1.2, marginBottom: 2 },
  activeStudent: { fontSize: 14, fontFamily: fonts.bold, color: "#FFFFFF" },
  activeTimer: { fontSize: 20, fontFamily: fonts.extrabold, color: "#FFFFFF", fontVariant: ["tabular-nums"], letterSpacing: -0.5 },
  activeGo: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  activeGoText: { fontSize: 12, fontFamily: fonts.bold, color: "#FFFFFF" },

  // KPI strip
  kpiStrip: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  // Upcoming
  upcomingCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    padding: space.md, backgroundColor: colors.cardBg,
  },
  upcomingName: { fontSize: 14, fontFamily: fonts.bold, color: colors.textAlt },
  upcomingMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.subtext, marginTop: 2 },
  countdownPill: { backgroundColor: colors.pageBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  countdownText: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.subtext },

  // Recent sessions
  recentCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    padding: space.md, backgroundColor: colors.cardBg,
  },
  recentAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: tint.purple.bg, alignItems: "center", justifyContent: "center",
  },
  recentAvatarText: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.purpleDark },
  recentName: { fontSize: 13, fontFamily: fonts.bold, color: colors.textAlt },
  recentMeta: { fontSize: 11, fontFamily: fonts.medium, color: colors.subtext, marginTop: 1 },
  scoreBadge: {
    flexDirection: "row", alignItems: "baseline",
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
  },
  scoreText: { fontSize: 15, fontFamily: fonts.extrabold },
  scoreUnit: { fontSize: 10, fontFamily: fonts.bold, marginLeft: 1 },

  // Empty
  emptyBox: {
    marginTop: 12, padding: space.md,
    backgroundColor: colors.pageBg, borderRadius: radius.input, alignItems: "center",
  },
  emptyText: { fontSize: 12, color: colors.subtext, fontFamily: fonts.bold, textAlign: "center" },

  // Buttons
  viewAllBtn: {
    marginTop: 12, borderRadius: radius.input,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 10, alignItems: "center",
  },
  viewAllText: { fontSize: 12, fontFamily: fonts.bold, color: colors.purpleDark },
  outlineBtn: {
    borderRadius: radius.input, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardBg, paddingVertical: 10, alignItems: "center",
  },
  outlineBtnText: { ...type_.btnOutline },
  retryBtn: {
    marginTop: 16, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 10, backgroundColor: colors.purpleDark,
  },
  retryBtnText: { fontSize: 14, fontFamily: fonts.bold, color: "#FFFFFF" },

  footer: { ...type_.footer, marginTop: 8 },
});
