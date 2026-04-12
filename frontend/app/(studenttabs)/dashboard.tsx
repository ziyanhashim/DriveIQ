import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert,
  useWindowDimensions, ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, apiDelete } from "../../lib/api";
import { colors, fonts, type_, radius, space, shadow, card, btn, pill, page, divider, tint, TintKey } from "../../lib/theme";
import FadeInView from "../../components/FadeInView";
import AnimatedPressable from "../../components/AnimatedPressable";
import { LineChart, PieChart } from "react-native-chart-kit";
import { Text as SvgText } from "react-native-svg";

// Shared components
import SectionHeader from "../../components/SectionHeader";
import MetricCard from "../../components/MetricCard";
import SessionCard from "../../components/SessionCard";
import EmptyState from "../../components/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommentItem = { id: string; instructor_name: string; date: string; text: string; rating: number };

function formatCommentDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st"
    : day % 10 === 2 && day !== 12 ? "nd"
    : day % 10 === 3 && day !== 13 ? "rd"
    : "th";
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${month} ${day}${suffix}, ${time}`;
}
type Achievement = { id: string; title: string; subtitle: string; icon: string; earned: boolean };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [loading, setLoading]             = useState(true);
  const [dash, setDash]                   = useState<any>(null);
  const [storedName, setStoredName]       = useState("");
  const [manageBooking, setManageBooking] = useState<any>(null);
  const [cancelledIds, setCancelledIds]   = useState<Set<string>>(new Set());
  const [toast, setToast]                 = useState<string | null>(null);
  const [showAllComments, setShowAllComments] = useState(false);

  async function loadDashboard() {
    try {
      setLoading(true);
      const name = await AsyncStorage.getItem("driveiq_user_name");
      if (name) setStoredName(name);
      const data = await apiGet("/dashboard/trainee");
      setDash(data);
    } catch {
      setDash(null);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function requestCancel() {
    if (!manageBooking) return;
    const bookingId = manageBooking.booking_id;
    if (!bookingId) { showToast("Missing booking ID"); return; }
    setManageBooking(null);
    setCancelledIds((prev) => new Set([...prev, bookingId]));
    showToast("Booking cancelled");
    try {
      await apiDelete(`/bookings/${bookingId}`);
    } catch (e: any) {
      setCancelledIds((prev) => { const n = new Set(prev); n.delete(bookingId); return n; });
      showToast(e?.message || "Failed to cancel — please try again");
    }
  }

  useEffect(() => { loadDashboard(); }, []);
  useFocusEffect(useCallback(() => { loadDashboard(); }, []));

  // ── Data derivations ─────────────────────────────────────────────────────
  const studentName        = dash?.welcome?.name || storedName || "";
  const sessionsCompleted  = dash?.progress?.sessions_completed ?? 0;
  const sessionsTotal      = dash?.progress?.target_sessions ?? 0;
  const currentDrivingScore= dash?.progress?.current_score ?? 0;
  const scoreLabel         = dash?.welcome?.badge ?? "—";
  const goalText           = dash?.progress?.goal_text ?? "Complete sessions to unlock your next badge";

  const upcomingList = useMemo(() => {
    const list: any[] = Array.isArray(dash?.upcoming_sessions)
      ? dash.upcoming_sessions
      : dash?.upcoming_session ? [dash.upcoming_session] : [];
    return list
      .filter((u: any) => !cancelledIds.has(u?.booking_id))
      .map((u: any) => {
        const dateISO    = u?.dateISO || u?.date_iso || u?.date || "";
        const dateLabel  = u?.dateLabel || u?.date_label || (dateISO ? new Date(dateISO).toLocaleDateString() : "—");
        const timeLabel  = u?.timeLabel || u?.time_label || u?.time || "—";
        const instructor = u?.instructor || u?.instructor_name || "—";
        return { booking_id: u?.booking_id, dateISO, dateLabel, timeLabel, instructor };
      });
  }, [dash, cancelledIds]);

  function countdownFor(dateISO: string) {
    if (!dateISO || dateISO === "—") return "—";
    const now  = new Date();
    const d    = new Date(dateISO + "T00:00:00");
    const ms   = d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = Math.round(ms / (1000 * 60 * 60 * 24));
    if (Number.isNaN(days)) return "—";
    if (days > 1) return `${days} days away`;
    if (days === 1) return "Tomorrow";
    if (days === 0) return "Today";
    return "Session passed";
  }

  // Recent reports for SessionCard
  const recentReports = useMemo(() => {
    const list = Array.isArray(dash?.recent_reports) ? dash.recent_reports : [];
    return list.map((r: any, idx: number) => {
      const rawScore = r?.score?.overall ?? r?.score ?? 0;
      const score = Math.round(rawScore);
      const date  = r?.date_label || r?.date || (r?.created_at ? new Date(r.created_at).toLocaleDateString() : "—");
      const instructor = r?.instructor_name || r?.instructor || "—";
      return {
        id: r?.id || r?._id || `rep-${idx}`,
        session_id: r?.session_id || "",
        date,
        instructor,
        score,
        passed: score >= 60,
      };
    });
  }, [dash]);

  // Behavior distribution for pie chart
  const behaviorData = useMemo(() => {
    let normal = 0, aggressive = 0, drowsy = 0;
    const reports = Array.isArray(dash?.recent_reports) ? dash.recent_reports : [];
    for (const r of reports) {
      const ws = r?.window_summary;
      if (ws) { normal += ws.normal || 0; aggressive += ws.aggressive || 0; drowsy += ws.drowsy || 0; }
    }
    const total = normal + aggressive + drowsy;
    if (total === 0) return null;
    return [
      { name: "Normal", count: normal, color: colors.green, legendFontColor: colors.label, legendFontSize: 12, legendFontFamily: fonts.semibold },
      { name: "Aggressive", count: aggressive, color: colors.redDeep, legendFontColor: colors.label, legendFontSize: 12, legendFontFamily: fonts.semibold },
      { name: "Drowsy", count: drowsy, color: colors.amber, legendFontColor: colors.label, legendFontSize: 12, legendFontFamily: fonts.semibold },
    ].filter(d => d.count > 0);
  }, [dash]);

  // Score trend data for line chart
  const scoreTrendData = useMemo(() => {
    const reports = Array.isArray(dash?.recent_reports) ? dash.recent_reports : [];
    const sorted = [...reports]
      .filter((r: any) => typeof (r?.score?.overall ?? r?.score) === "number" && (r?.score?.overall ?? r?.score) > 0)
      .slice(-10)
      .reverse();
    if (sorted.length < 2) return null;
    return {
      labels: sorted.map((_: any, i: number) => `S${i + 1}`),
      datasets: [{ data: sorted.map((r: any) => r?.score?.overall ?? r?.score ?? 0), strokeWidth: 2 }],
    };
  }, [dash]);

  // Comments
  const comments: CommentItem[] = useMemo(() => {
    const list = Array.isArray(dash?.instructor_comments) ? dash.instructor_comments : [];
    return list.map((c: any, idx: number) => ({
      id: c?.id || `c-${idx}`,
      instructor_name: c?.instructor_name || "",
      date: c?.date ?? (c?.created_at || ""),
      text: c?.text || c?.comment || "",
      rating: c?.rating ?? 0,
    }));
  }, [dash]);

  // Achievements
  const achievements: Achievement[] = useMemo(() => {
    const list = Array.isArray(dash?.achievements) ? dash.achievements : [];
    return list.map((a: any, idx: number) => ({
      id: a?.id || `a-${idx}`,
      title: a?.title || "Achievement",
      subtitle: a?.subtitle || a?.desc || "",
      icon: a?.icon || "🏅",
      earned: !!a?.earned,
    }));
  }, [dash]);

  const scoreTint: TintKey = currentDrivingScore >= 80 ? "green" : currentDrivingScore >= 60 ? "yellow" : "red";

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={page.centerText}>Loading dashboard…</Text>
      </View>
    );
  }

  const visibleComments = showAllComments ? comments : comments.slice(0, 3);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.page} contentContainerStyle={s.content}>

      {/* ── 1. Greeting ─────────────────────────────────────────────────── */}
      <FadeInView delay={0}>
        <Text style={s.greeting}>
          {studentName ? `Hello, ${studentName} 👋` : "Welcome back 👋"}
        </Text>
        <Text style={s.greetingSub}>Here's your driving progress at a glance.</Text>
      </FadeInView>

      {/* ── 2. Chart + Stats (side by side on wide, stacked on mobile) ── */}
      <FadeInView delay={80}>
      <View style={[s.heroRow, isWide && s.heroRowWide]}>
        {/* Left: Score Trend Chart */}
        <View style={[s.chartCard, isWide && { flex: 1 }]}>
          <Text style={s.chartTitle}>Score Trend</Text>
          {scoreTrendData ? (
            <LineChart
              data={{
                labels: scoreTrendData.labels,
                datasets: [
                  scoreTrendData.datasets[0],
                  { data: [110], withDots: false } as any, // invisible ceiling so top labels aren't clipped
                ],
              }}
              width={isWide ? Math.floor((width - 60) / 2) : width - 48}
              height={220}
              withVerticalLabels
              withHorizontalLabels={false}
              withDots
              yAxisSuffix=""
              yAxisInterval={1}
              fromZero
              segments={4}
              renderDotContent={({ x, y, index, indexData }: any) => {
                const realData = scoreTrendData!.datasets[0].data;
                if (index >= realData.length) return null; // skip the ceiling dataset
                return (
                  <SvgText
                    key={`dot-${index}`}
                    x={x}
                    y={y - 10}
                    fontSize={11}
                    fontFamily={fonts.semibold}
                    fill={colors.text}
                    textAnchor="middle"
                  >
                    {Math.round(realData[index])}
                  </SvgText>
                );
              }}
              chartConfig={{
                backgroundColor: colors.cardBg,
                backgroundGradientFrom: colors.cardBg,
                backgroundGradientTo: colors.cardBg,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(10, 138, 122, ${opacity})`,
                labelColor: () => colors.subtext,
                propsForLabels: { fontFamily: fonts.semibold, fontSize: 11 },
                propsForDots: { r: "5", strokeWidth: "2", stroke: colors.blue },
                propsForBackgroundLines: { strokeDasharray: "", stroke: colors.borderFaint },
                fillShadowGradientFrom: colors.blue,
                fillShadowGradientTo: colors.cardBg,
                fillShadowGradientFromOpacity: 0.2,
                fillShadowGradientToOpacity: 0,
              }}
              bezier
              style={{ borderRadius: radius.md, alignSelf: "center", marginTop: 8 }}
            />
          ) : (
            <View style={s.chartEmpty}>
              <Text style={s.chartEmptyText}>Complete more sessions to see your score trend</Text>
            </View>
          )}
        </View>

        {/* Right: Key Stats — 2 columns, each column is a vertical stack */}
        <View style={[s.statsOuter, isWide && { flex: 1 }]}>
          <View style={s.statsRow}>
            <View style={s.statsCol}>
              <View style={[s.statCard, { borderLeftColor: scoreTint === "green" ? colors.green : scoreTint === "yellow" ? colors.amber : colors.redDeep }]}>
                <Text style={s.statLabel}>Driving Score</Text>
                <Text style={s.statValue}>{currentDrivingScore > 0 ? `${currentDrivingScore}%` : "—"}</Text>
                <Text style={s.statSub}>{scoreLabel}</Text>
              </View>
              <View style={[s.statCard, { borderLeftColor: colors.amber }]}>
                <Text style={s.statLabel}>Next Goal</Text>
                <Text style={[s.statSub, { marginTop: 4 }]}>{goalText}</Text>
              </View>
            </View>
            <View style={s.statsCol}>
              <View style={[s.statCard, { borderLeftColor: colors.blue }]}>
                <Text style={s.statLabel}>Sessions</Text>
                <Text style={s.statValue}>{sessionsTotal > 0 ? `${sessionsCompleted}/${sessionsTotal}` : `${sessionsCompleted}`}</Text>
                <Text style={s.statSub}>{sessionsTotal > 0 ? `${Math.max(0, sessionsTotal - sessionsCompleted)} remaining` : "Keep going"}</Text>
              </View>
              <View style={[s.statCard, { borderLeftColor: colors.indigo || "#6366F1" }]}>
                <Text style={s.statLabel}>Last Session</Text>
                <Text style={s.statValue}>{recentReports.length > 0 ? recentReports[0].date : "—"}</Text>
                <Text style={s.statSub}>{recentReports.length > 0 ? recentReports[0].instructor : ""}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      </FadeInView>

      {/* ── Row 1: Upcoming Sessions + Behavior Distribution ──────────── */}
      <FadeInView delay={160}>
      <View style={[s.cardRow, isWide && s.cardRowWide]}>
        <View style={[card.base, isWide && { flex: 1.3 }]}>
          <SectionHeader icon="🗓️" iconBg={colors.greenBorderAlt} label="Upcoming Sessions" count={upcomingList.length > 0 ? upcomingList.length : undefined} />
          {upcomingList.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No upcoming sessions scheduled.</Text>
              <AnimatedPressable onPress={() => router.navigate("/(studenttabs)/sessions" as any)} style={[s.outlineBtn, { marginTop: 0 }]}>
                <Text style={s.outlineBtnText}>Book a Session</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 10 }}>
              {upcomingList.map((u, idx) => (
                <View key={u.booking_id || idx} style={s.upcomingCard}>
                  <View style={[s.upcomingRow, isWide && { flexDirection: "row" }]}>
                    <InfoPill label="Date"       value={u.dateLabel}  icon="🗓️" bg={tint.indigo.bg} border={tint.indigo.border} />
                    <InfoPill label="Time"       value={u.timeLabel}  icon="🕑" bg={tint.purple.bg} border={tint.purple.border} />
                    <InfoPill label="Instructor" value={u.instructor} icon="👤" bg={tint.green.bg}  border={tint.green.border}  />
                  </View>
                  <View style={s.countdownRow}>
                    <Text style={s.countdownText}>🕒 {countdownFor(u.dateISO)}</Text>
                    <AnimatedPressable
                      onPress={() => setManageBooking(u)}
                      style={[s.outlineBtn, { marginTop: 0 }]}
                    >
                      <Text style={s.outlineBtnText}>Manage →</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {behaviorData && behaviorData.length > 0 && (
          <View style={[card.base, isWide && { flex: 1 }]}>
            <SectionHeader icon="🧠" iconBg={tint.purple.bg} label="Behavior Distribution" />
            <View style={{ marginTop: 12, alignItems: "center", flex: 1, justifyContent: "center" }}>
              <PieChart
                data={behaviorData}
                width={isWide ? Math.min((width - 60) * 0.42, 360) : Math.min(width - 60, 500)}
                height={200}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="count"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute={false}
              />
            </View>
          </View>
        )}
      </View>
      </FadeInView>

      {/* ── Row 2: Recent Reports + Instructor Comments ───────────────── */}
      <FadeInView delay={240}>
      <View style={[s.cardRow, isWide && s.cardRowWide]}>
        <View style={[card.base, isWide && { flex: 1.3 }]}>
          <SectionHeader icon="📄" iconBg={colors.blueLighter} label="Recent Reports" />
          {recentReports.length === 0 ? (
            <View style={s.inlineEmpty}>
              <Text style={s.inlineEmptyText}>No reports yet. Complete a session to see your results.</Text>
            </View>
          ) : (
            <View style={s.recentGrid}>
              {recentReports.slice(0, 4).map((r: any) => (
                <SessionCard
                  key={r.id}
                  sessionId={r.session_id}
                  date={r.date}
                  performanceScore={r.score}
                  passed={r.passed}
                  instructorName={r.instructor}
                  variant="compact"
                  onPress={() => router.push({
                    pathname: "/(studenttabs)/session-report",
                    params: { sessionId: r.session_id, from: "dashboard" },
                  })}
                />
              ))}
            </View>
          )}
        </View>

        {comments.length > 0 && (
          <View style={[card.base, isWide && { flex: 1 }]}>
            <SectionHeader icon="💬" iconBg={colors.purpleBorder} label="Instructor Comments" count={comments.length} />
            <View style={s.commentsGrid}>
              {comments.map((c) => (
                <View key={c.id} style={s.commentCard}>
                  <View style={s.commentTop}>
                    <View>
                      {c.instructor_name !== "" && (
                        <Text style={s.commentName}>{c.instructor_name}</Text>
                      )}
                      <Text style={s.commentDate}>{formatCommentDate(c.date)}</Text>
                    </View>
                    {c.rating > 0 && (
                      <View style={s.ratingRow}>
                        <Text style={{ fontSize: 13 }}>⭐</Text>
                        <Text style={s.ratingText}>{c.rating}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.commentText}>{c.text}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
      </FadeInView>

      {/* ── 7. Achievements ────────────────────────────────────────────── */}
      {achievements.length > 0 && (
        <View style={[card.base, { backgroundColor: colors.darkBg, borderColor: colors.darkCard }]}>
          <SectionHeader icon="🏅" iconBg="rgba(250,204,21,0.15)" label="Achievements & Milestones" labelStyle={{ color: "#FFFFFF" }} />
          <View style={[s.achGrid, isWide && { flexDirection: "row" }]}>
            {achievements.map((a) => (
              <View key={a.id} style={[s.achCard, isWide && { flex: 1 }, a.earned ? s.achEarned : s.achLocked]}>
                <Text style={s.achIcon}>{a.icon}</Text>
                <Text style={s.achTitle}>{a.title}</Text>
                <Text style={s.achSub}>{a.subtitle}</Text>
                <View style={[s.earnedPill, a.earned ? s.earnedOn : s.earnedOff]}>
                  <Text style={[s.earnedText, a.earned ? s.earnedTextOn : s.earnedTextOff]}>
                    {a.earned ? "✓ Earned" : "Locked"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <AnimatedPressable onPress={loadDashboard} style={s.outlineBtn}>
        <Text style={s.outlineBtnText}>↻ Refresh</Text>
      </AnimatedPressable>

      <Text style={s.footer}>© 2025 DriveIQ · Student Portal</Text>
    </ScrollView>

    {/* ── Toast ────────────────────────────────────────────────────── */}
    {toast && (
      <View style={s.toast} pointerEvents="none">
        <Text style={s.toastText}>{toast}</Text>
      </View>
    )}

    {/* ── Manage Booking Modal ─────────────────────────────────────── */}
    <Modal visible={!!manageBooking} animationType="fade" transparent onRequestClose={() => setManageBooking(null)}>
      <View style={s.manageOverlay}>
        <View style={s.manageCard}>
          <View style={s.manageHeader}>
            <Text style={s.manageTitle}>Session Details</Text>
            <Pressable onPress={() => setManageBooking(null)}>
              <Text style={s.manageClose}>✕</Text>
            </Pressable>
          </View>
          {manageBooking && (
            <>
              <InfoPill label="Date"       value={manageBooking.dateLabel}  icon="🗓️" bg={tint.indigo.bg}  border={tint.indigo.border}  />
              <View style={{ height: 10 }} />
              <InfoPill label="Time"       value={manageBooking.timeLabel}  icon="🕑" bg={tint.purple.bg}  border={tint.purple.border}  />
              <View style={{ height: 10 }} />
              <InfoPill label="Instructor" value={manageBooking.instructor} icon="👤" bg={tint.green.bg}   border={tint.green.border}   />
              <Text style={s.manageCountdown}>🕒 {countdownFor(manageBooking.dateISO)}</Text>
              <View style={s.manageDivider} />
              <Pressable onPress={requestCancel} style={s.cancelReqBtn}>
                <Text style={s.cancelReqText}>Request Cancellation</Text>
              </Pressable>
              <Pressable onPress={() => setManageBooking(null)} style={s.manageCloseBtn}>
                <Text style={s.manageCloseBtnText}>Close</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoPill({ label, value, icon, bg, border }: { label: string; value: string; icon: string; bg: string; border: string }) {
  return (
    <View style={ip.wrap}>
      <View style={[ip.iconWrap, { backgroundColor: bg, borderColor: border }]}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ip.label}>{label}</Text>
        <Text style={ip.value}>{value}</Text>
      </View>
    </View>
  );
}

const ip = StyleSheet.create({
  wrap:    { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 160 },
  iconWrap:{ width: 38, height: 38, borderRadius: radius.input, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  label:   { ...type_.labelSm },
  value:   { ...type_.metaValue },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:    { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: space.page, paddingBottom: 32, gap: 14 },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },

  // Greeting
  greeting: { fontSize: 20, fontFamily: fonts.extrabold, color: colors.text, letterSpacing: -0.3 },
  greetingSub: { fontSize: 13, fontFamily: fonts.medium, color: colors.subtext, marginTop: 4 },

  // Hero row (chart + stats)
  heroRow: { flexDirection: "column", gap: 12 },
  heroRowWide: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  chartCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: space.md,
    paddingBottom: 0,
    paddingLeft: space.sm,
    paddingRight: space.sm,
    ...shadow.card,
  },
  chartTitle: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.textAlt, letterSpacing: -0.2, paddingLeft: space.xs },
  chartEmpty: { height: 220, alignItems: "center", justifyContent: "center" },
  chartEmptyText: { fontSize: 12, fontFamily: fonts.medium, color: colors.subtext, textAlign: "center" },
  statsOuter: {},
  statsRow: { flexDirection: "row", gap: 8, flex: 1 },
  statsCol: { flex: 1, gap: 8 },
  statCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: space.md,
    justifyContent: "center",
    flex: 1,
    ...shadow.card,
  },
  statLabel: { fontSize: 10, fontFamily: fonts.semibold, color: colors.subtext, letterSpacing: 0.3, textTransform: "uppercase" },
  statValue: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text, marginTop: 3, letterSpacing: -0.5 },
  statSub: { fontSize: 11, fontFamily: fonts.medium, color: colors.subtextAlt, marginTop: 2 },

  // Card rows (side-by-side on wide)
  cardRow: { flexDirection: "column", gap: 12 },
  cardRowWide: { flexDirection: "row", gap: 12, alignItems: "stretch" },

  // Upcoming
  upcomingCard:  { borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, padding: space.md, backgroundColor: colors.cardBg, gap: 10 },
  upcomingRow:   { flexDirection: "column", gap: 10 },
  countdownRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  countdownText: { fontSize: 12, color: colors.blue, fontFamily: fonts.extrabold },
  emptyBox:      { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md, backgroundColor: colors.pageBg, borderRadius: radius.input },
  emptyText:     { fontSize: 12, color: colors.subtext, flex: 1, fontFamily: fonts.bold },

  // Recent sessions grid
  recentGrid: {
    marginTop: 12,
    gap: 10,
  },
  inlineEmpty: {
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.pageBg,
    borderRadius: radius.input,
    alignItems: "center",
  },
  inlineEmptyText: {
    fontSize: 12,
    color: colors.subtext,
    textAlign: "center",
    fontFamily: fonts.bold,
  },

  // Comments
  commentsGrid: { flexDirection: "column", gap: 12, marginTop: 12 },
  commentCard:  { borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.pageBg, padding: space.md },
  commentTop:   { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  commentName:  { fontSize: 13, color: colors.textAlt, fontFamily: fonts.bold, marginBottom: 2 },
  commentDate:  { fontSize: 12, color: colors.subtext, fontFamily: fonts.semibold },
  ratingRow:    { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText:   { ...type_.body, color: colors.textAlt, fontFamily: fonts.extrabold },
  commentText:  { ...type_.body, color: colors.label, marginTop: 10 },
  showMoreBtn:  { alignItems: "center", paddingVertical: 10, marginTop: 4 },
  showMoreText: { fontSize: 12, color: colors.blue, fontFamily: fonts.bold },

  // Achievements
  achGrid:     { flexDirection: "column", gap: 10, marginTop: 12 },
  achCard:     { borderRadius: radius.card, borderWidth: 1, padding: 14, alignItems: "center" },
  achEarned:   { backgroundColor: "rgba(10,138,122,0.15)", borderColor: colors.blue },
  achLocked:   { backgroundColor: colors.darkCard, borderColor: "rgba(255,255,255,0.1)" },
  achIcon:     { fontSize: 32 },
  achTitle:    { ...type_.body, color: "#FFFFFF", marginTop: 10, fontFamily: fonts.bold },
  achSub:      { ...type_.bodySm, textAlign: "center", marginTop: 6, color: "rgba(255,255,255,0.6)" },
  earnedPill:  { marginTop: 10, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  earnedOn:    { backgroundColor: colors.blue },
  earnedOff:   { backgroundColor: colors.borderMid },
  earnedText:  { fontSize: 11, fontFamily: fonts.extrabold },
  earnedTextOn:{ color: "#FFFFFF" },
  earnedTextOff:{ color: colors.subtextAlt },

  // Buttons
  outlineBtn:     { marginTop: 10, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg, paddingVertical: 10, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center" },
  outlineBtnText: { ...type_.btnOutline },

  footer: { ...type_.footer, marginTop: 8 },

  // Manage booking modal
  manageOverlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  manageCard:         { backgroundColor: colors.cardBg, borderRadius: radius.cardXl, padding: 24 },
  manageHeader:       { flexDirection: "row" as any, alignItems: "center" as any, justifyContent: "space-between" as any, marginBottom: 20 },
  manageTitle:        { fontSize: 18, color: colors.textAlt, fontFamily: fonts.extrabold },
  manageClose:        { fontSize: 22, color: colors.subtext, padding: 4 },
  manageCountdown:    { fontSize: 13, color: colors.blue, marginTop: 14, fontFamily: fonts.extrabold },
  manageDivider:      { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  cancelReqBtn:       { backgroundColor: colors.redDark, borderRadius: radius.input, paddingVertical: 14, alignItems: "center" as any, marginBottom: 10 },
  cancelReqText:      { color: "#FFF", fontSize: 14, fontFamily: fonts.extrabold },
  manageCloseBtn:     { borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingVertical: 12, alignItems: "center" as any },
  manageCloseBtnText: { fontSize: 13, color: colors.textAlt, fontFamily: fonts.extrabold },

  // Toast
  toast:     { position: "absolute" as any, bottom: 40, alignSelf: "center" as any, backgroundColor: colors.toast, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, zIndex: 9999 },
  toastText: { color: "#FFF", fontSize: 13, fontFamily: fonts.bold },
});
