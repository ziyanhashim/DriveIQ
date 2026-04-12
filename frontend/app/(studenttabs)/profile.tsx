import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "../../lib/api";
import { colors, fonts, type_, radius, space, card, page, divider, tint } from "../../lib/theme";
import FadeInView from "../../components/FadeInView";

// Shared components
import PerformanceMatrix, { MatrixRow } from "../../components/PerformanceMatrix";
import EmptyState from "../../components/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

type Badge = { id: string; title: string; level: "Bronze" | "Silver" | "Gold"; emoji: string };
type InstructorHistory = { id: string; name: string; rating: number; sessionsCompleted: number; notes: string[] };
type Milestone = { id: string; title: string; desc: string; date?: string; status: "Earned" | "Locked"; emoji: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}
function pct(n: number, d: number) {
  return d <= 0 ? 0 : Math.max(0, Math.min(1, n / d));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Profile() {
  const [loading, setLoading]           = useState(true);
  const [dash, setDash]                 = useState<any>(null);
  const [storedName, setStoredName]     = useState("");
  const [storedEmail, setStoredEmail]   = useState("");
  const [storedMobile, setStoredMobile] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  async function loadProfile() {
    try {
      setLoading(true);
      const [name, email, mobile] = await Promise.all([
        AsyncStorage.getItem("driveiq_user_name"),
        AsyncStorage.getItem("driveiq_user_email"),
        AsyncStorage.getItem("driveiq_user_mobile"),
      ]);
      setStoredName(name || "");
      setStoredEmail(email || "");
      setStoredMobile(mobile || "");
      const [data, me] = await Promise.all([
        apiGet("/dashboard/trainee"),
        apiGet("/auth/me").catch(() => null),
      ]);
      // Refresh from API if available
      if (me?.email) setStoredEmail(me.email);
      if (me?.name) setStoredName(me.name);
      if (me?.mobile) setStoredMobile(me.mobile);
      setDash(data);
    } catch {
      setDash(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfile(); }, []);
  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  // ── Derived values ─────────────────────────────────────────────────────
  const fullName            = dash?.welcome?.name || storedName || "—";
  const email               = storedEmail || "—";
  const mobile              = storedMobile || "—";
  const status              = dash?.welcome?.badge || "—";
  const sessionsCompleted   = dash?.progress?.sessions_completed ?? 0;
  const sessionsTotal       = dash?.progress?.target_sessions ?? 0;
  const currentDrivingScore = dash?.progress?.current_score ?? 0;

  // Derive current instructor from upcoming sessions or recent reports
  const instructorName = (() => {
    const upcoming = Array.isArray(dash?.upcoming_sessions) ? dash.upcoming_sessions : [];
    if (upcoming.length > 0) return upcoming[0]?.instructor || upcoming[0]?.instructor_name || "";
    const reports = Array.isArray(dash?.recent_reports) ? dash.recent_reports : [];
    if (reports.length > 0) return reports[0]?.instructor_name || reports[0]?.instructor || "";
    return "";
  })();

  const badges: Badge[] = Array.isArray(dash?.achievements)
    ? dash.achievements.filter((a: any) => a.earned).map((a: any, i: number) => ({
        id: a.id || `b-${i}`, title: a.title || "Badge", level: a.level || "Bronze", emoji: a.icon || "🏅",
      }))
    : [];

  // Derive instructor history from recent reports
  const instructorHistory: InstructorHistory[] = (() => {
    const reports = Array.isArray(dash?.recent_reports) ? dash.recent_reports : [];
    const byInstructor = new Map<string, { name: string; count: number }>();
    for (const r of reports) {
      const name = r?.instructor_name || r?.instructor;
      if (!name || name === "—") continue;
      const existing = byInstructor.get(name);
      if (existing) {
        existing.count++;
      } else {
        byInstructor.set(name, { name, count: 1 });
      }
    }
    return Array.from(byInstructor.values()).map((inst, i) => ({
      id: `ih-${i}`,
      name: inst.name,
      rating: 0,
      sessionsCompleted: inst.count,
      notes: [],
    }));
  })();

  const milestones: Milestone[] = Array.isArray(dash?.milestones)
    ? dash.milestones : [];

  const sessionsProgress = pct(sessionsCompleted, sessionsTotal);
  const earnedCount      = milestones.filter((m) => m.status === "Earned").length;
  const motivationBody   = sessionsTotal > 0
    ? `You're ${Math.round(sessionsProgress * 100)}% through your training program. ${Math.max(0, milestones.length - earnedCount)} more achievements to unlock!`
    : "Complete your first session to start tracking your progress.";

  // Performance matrix rows
  const progressRows: MatrixRow[] = [
    {
      label: "Sessions",
      value: sessionsTotal > 0 ? `${sessionsCompleted}/${sessionsTotal}` : `${sessionsCompleted}`,
      maxValue: sessionsTotal > 0 ? sessionsTotal : undefined,
      ...(sessionsTotal > 0 ? {} : {}),
    },
    {
      label: "Driving Score",
      value: currentDrivingScore > 0 ? `${currentDrivingScore}%` : "—",
      maxValue: 100,
    },
    {
      label: "Badges Earned",
      value: badges.length,
    },
    {
      label: "Status",
      value: status,
    },
  ];

  function toggleNotes(id: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={page.centerText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.headerRow}>
        <Ionicons name="person-outline" size={22} color={colors.blue} />
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>My Profile</Text>
          <Text style={s.pageSubtitle}>View your learning journey and achievements</Text>
        </View>
      </View>

      {/* ── Personal Information ─────────────────────────────────────────── */}
      <FadeInView delay={0}>
      <View style={card.base}>
        <View style={s.sectionTitleRow}>
          <Ionicons name="person-circle-outline" size={18} color={colors.blue} />
          <Text style={s.sectionTitle}>Personal Information</Text>
        </View>

        <View style={s.personalRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{fullName !== "—" ? initials(fullName) : "?"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.personalGrid}>
              <InfoBlock label="Full Name"              icon="person-outline"  value={fullName} />
              <InfoBlock label="Email Address"          icon="mail-outline"    value={email} />
              <InfoBlock label="Mobile Number"          icon="call-outline"    value={mobile} />
            </View>
            {status !== "—" && (
              <View style={s.statusPill}>
                <Text style={s.statusPillText}>{status}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      </FadeInView>

      {/* ── Learning Progress (PerformanceMatrix) ─────────────────────────── */}
      <FadeInView delay={80}>
      <View style={card.base}>
        <View style={s.sectionTitleRow}>
          <Ionicons name="trending-up-outline" size={18} color={colors.green} />
          <Text style={s.sectionTitle}>Learning Progress</Text>
        </View>
        <PerformanceMatrix rows={progressRows} columns={2} />
      </View>
      </FadeInView>

      {/* ── Instructor History ───────────────────────────────────────────── */}
      <FadeInView delay={160}>
      <View style={card.base}>
        <View style={s.sectionTitleRow}>
          <Ionicons name="sparkles-outline" size={18} color={colors.purple} />
          <Text style={s.sectionTitle}>Instructor History</Text>
        </View>

        {instructorHistory.length === 0 ? (
          <EmptyState text="No instructor history yet." />
        ) : (
          <View style={{ gap: 14 }}>
            {instructorHistory.map((inst) => {
              const isExpanded = expandedNotes.has(inst.id);
              const visibleNotes = isExpanded ? inst.notes : inst.notes.slice(0, 2);

              return (
                <View key={inst.id} style={s.historyCard}>
                  <View style={s.historyTopRow}>
                    <View style={s.historyAvatar}>
                      <Text style={s.historyAvatarText}>{initials(inst.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.historyName}>{inst.name}</Text>
                      <Text style={s.historySub}>{inst.sessionsCompleted} sessions completed</Text>
                    </View>
                  </View>
                  {visibleNotes.length > 0 && (
                    <>
                      <Text style={s.notesTitle}>Instructor Notes & Endorsements:</Text>
                      <View style={{ gap: 10 }}>
                        {visibleNotes.map((n, idx) => (
                          <View key={idx} style={s.notePill}>
                            <Ionicons name="checkmark-circle-outline" size={16} color={colors.blue} style={{ marginRight: 10 }} />
                            <Text style={s.noteText}>{n}</Text>
                          </View>
                        ))}
                      </View>
                      {inst.notes.length > 2 && (
                        <Pressable onPress={() => toggleNotes(inst.id)} style={{ marginTop: 6 }}>
                          <Text style={s.showMoreText}>
                            {isExpanded ? "Show less" : `Show ${inst.notes.length - 2} more`}
                          </Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
      </FadeInView>

      {/* ── Milestones & Badges (merged) ──────────────────────────────────── */}
      <FadeInView delay={240}>
      <View style={card.base}>
        <View style={s.sectionTitleRow}>
          <Ionicons name="medal-outline" size={18} color={colors.yellow} />
          <Text style={s.sectionTitle}>Milestones & Badges</Text>
        </View>

        {/* Badges */}
        {badges.length > 0 && (
          <>
            <View style={s.badgeGrid}>
              {badges.map((b) => (
                <View key={b.id} style={s.badgeCard}>
                  <Text style={s.badgeEmoji}>{b.emoji}</Text>
                  <Text style={s.badgeTitle}>{b.title}</Text>
                  <View style={s.levelPill}><Text style={s.levelPillText}>{b.level}</Text></View>
                </View>
              ))}
            </View>
            {milestones.length > 0 && <View style={divider.faint} />}
          </>
        )}

        {/* Milestones */}
        {milestones.length === 0 && badges.length === 0 ? (
          <EmptyState text="Complete sessions to start unlocking milestones and badges." />
        ) : milestones.length > 0 ? (
          <View style={s.milestoneGrid}>
            {milestones.map((m) => {
              const earned = m.status === "Earned";
              return (
                <View key={m.id} style={[
                  s.milestoneCard,
                  earned ? { backgroundColor: colors.blueLight, borderColor: colors.blueBorder }
                          : { backgroundColor: colors.pageBg, borderColor: colors.borderMid },
                ]}>
                  <Text style={s.milestoneEmoji}>{m.emoji}</Text>
                  <Text style={s.milestoneTitle}>{m.title}</Text>
                  <Text style={[s.milestoneDesc, !earned && { color: colors.subtext }]}>{m.desc}</Text>
                  <View style={[s.earnedPill, earned ? null : s.lockedPill]}>
                    <Ionicons
                      name={earned ? "checkmark" : "lock-closed"} size={14} color="#FFFFFF" style={{ marginRight: 8 }}
                    />
                    <Text style={s.earnedPillText}>{earned ? "Earned" : "Locked"}</Text>
                  </View>
                  {earned && m.date && (
                    <Text style={s.milestoneDate}>{m.date}</Text>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={divider.base} />

        <View style={s.motivationBanner}>
          <Text style={s.motivationEmoji}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.motivationTitle}>Keep Up the Great Work!</Text>
            <Text style={s.motivationBody}>{motivationBody}</Text>
          </View>
        </View>
      </View>
      </FadeInView>

      <View style={{ height: 6 }} />
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoBlock({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.infoBlock}>
      <Text style={s.infoLabel}>{label}</Text>
      <View style={s.infoValueRow}>
        <Ionicons name={icon} size={14} color={colors.subtext} style={{ marginRight: 8 }} />
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { flex: 1, backgroundColor: colors.pageBgAlt },
  pageContent: { padding: space.page, paddingBottom: 28, gap: 14 },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },

  headerRow:   { flexDirection: "row", alignItems: "center", gap: space.md },
  pageTitle:   { ...type_.pageTitle },
  pageSubtitle:{ ...type_.pageSubtitle },

  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
  sectionTitle:    { ...type_.sectionTitle },

  personalRow:  { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar:       { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.blueDark, alignItems: "center", justifyContent: "center" },
  avatarText:   { color: "#FFFFFF", fontSize: 30, fontFamily: fonts.extrabold },
  personalGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  infoBlock:    { flexBasis: "48%", flexGrow: 1, minWidth: 150 },
  infoLabel:    { ...type_.labelSm },
  infoValueRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  infoValue:    { ...type_.body, fontFamily: fonts.bold },

  statusPill:     { marginTop: 12, alignSelf: "flex-start", backgroundColor: colors.blueLight, borderWidth: 1, borderColor: colors.blueBorder, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  statusPillText: { color: colors.blue, fontSize: 11, fontFamily: fonts.extrabold },

  // Badges
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  badgeCard: { flexGrow: 1, flexBasis: "23%", minWidth: 160, borderWidth: 1, borderColor: colors.blueBorder, backgroundColor: colors.blueLight, borderRadius: radius.input, padding: 14, alignItems: "center", justifyContent: "center" },
  badgeEmoji:{ fontSize: 24, marginBottom: 8 },
  badgeTitle:{ ...type_.body, textAlign: "center", fontFamily: fonts.bold },
  levelPill: { marginTop: 10, borderWidth: 1, borderColor: colors.borderMid, backgroundColor: colors.cardBg, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  levelPillText: { ...type_.chip },

  // Instructor History
  historyCard:      { borderWidth: 1, borderColor: colors.borderAlt, borderRadius: radius.input, padding: 14, backgroundColor: colors.cardBg },
  historyTopRow:    { flexDirection: "row", alignItems: "center", gap: space.md },
  historyAvatar:    { width: 54, height: 54, borderRadius: radius.pill, backgroundColor: colors.blueDark, alignItems: "center", justifyContent: "center" },
  historyAvatarText:{ color: "#FFFFFF", fontSize: 16, fontFamily: fonts.extrabold },
  historyNameRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  historyName:      { ...type_.sectionTitle },
  historyRating:    { ...type_.body, color: colors.text, fontFamily: fonts.extrabold },
  historySub:       { marginTop: 6, ...type_.labelSm },
  notesTitle:       { marginTop: 14, ...type_.body, marginBottom: 8, fontFamily: fonts.extrabold },
  notePill:         { backgroundColor: colors.blueNote, borderWidth: 1, borderColor: colors.blueNoteBorder, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  noteText:         { color: colors.blue, fontSize: 12, flex: 1, fontFamily: fonts.extrabold },
  showMoreText:     { fontSize: 12, color: colors.blue, fontFamily: fonts.bold },

  // Milestones
  milestoneGrid:  { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  milestoneCard:  { flexGrow: 1, flexBasis: "31%", minWidth: 220, borderWidth: 1, borderRadius: radius.input, padding: 14, alignItems: "center" },
  milestoneEmoji: { fontSize: 26, marginBottom: 10 },
  milestoneTitle: { ...type_.body, textAlign: "center", fontFamily: fonts.bold },
  milestoneDesc:  { marginTop: 8, ...type_.body, textAlign: "center", lineHeight: 18 },
  earnedPill:     { marginTop: 12, backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center" },
  lockedPill:     { backgroundColor: colors.borderMid },
  earnedPillText: { color: "#FFFFFF", fontSize: 11, fontFamily: fonts.bold },
  milestoneDate:  { marginTop: 10, ...type_.labelSm },

  motivationBanner: { backgroundColor: tint.green.bg, borderWidth: 1, borderColor: colors.greenBorder, borderRadius: radius.input, padding: 14, flexDirection: "row", alignItems: "center", gap: space.md },
  motivationEmoji:  { fontSize: 22 },
  motivationTitle:  { ...type_.sectionTitle },
  motivationBody:   { marginTop: 6, ...type_.labelSm, lineHeight: 18 },
});
