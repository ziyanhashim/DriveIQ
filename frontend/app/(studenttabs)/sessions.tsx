import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal,
  useWindowDimensions, ActivityIndicator, Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiGet, apiPost, apiDelete } from "../../lib/api";
import { colors, type_, radius, space, card, page, tint, fonts } from "../../lib/theme";
import FadeInView from "../../components/FadeInView";
import AnimatedPressable from "../../components/AnimatedPressable";

// Shared components
import SectionHeader from "../../components/SectionHeader";
import MetricCard from "../../components/MetricCard";
import FilterChips from "../../components/FilterChips";
import SessionCard from "../../components/SessionCard";
import EmptyState from "../../components/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

type InstructorProfile = {
  instructor_id: string; name: string; bio: string; specialties: string[];
  experience_years: number; price_per_session: number; currency: string;
  vehicle: string; languages: string[]; location_area: string;
  rating: number; total_reviews: number; total_sessions: number;
};

type Slot = {
  slot_id: string; instructor_id: string; date: string;
  start_time: string; end_time: string; duration_min: number; status: string;
};

type Booking = {
  booking_id: string; instructor_id: string; instructor_name?: string;
  slot_date: string; start_time: string; end_time: string; status: string;
  session_id?: string;
};

type SessionDoc = {
  session_id: string; instructor_id: string; instructor_name?: string;
  status: string; road_type?: string; created_at?: string;
  started_at?: string; ended_at?: string;
};

type ResultDoc = {
  session_id: string; instructor_name?: string;
  analysis?: { behavior: string; overall: number; badge: string; confidence: number };
  ai_feedback?: any[]; instructor_comment?: { text: string; rating: number; date: string };
  created_at?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }); }
  catch { return "—"; }
}

function starsString(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
}

const PAST_PAGE_SIZE = 3;
const INST_PAGE_SIZE = 3;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SessionsScreen() {
  const { width } = useWindowDimensions();

  // ── State ──────────────────────────────────────────────────────────
  const [loading, setLoading]                 = useState(true);
  const [instructors, setInstructors]         = useState<InstructorProfile[]>([]);
  const [bookings, setBookings]              = useState<Booking[]>([]);
  const [sessions, setSessions]               = useState<SessionDoc[]>([]);
  const [results, setResults]                 = useState<ResultDoc[]>([]);
  const [dashData, setDashData]               = useState<any>(null);

  // Filters (defined in useMemo below)

  // Booking modal
  const [showBooking, setShowBooking]         = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<InstructorProfile | null>(null);
  const [slots, setSlots]                     = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading]       = useState(false);
  const [selectedSlot, setSelectedSlot]       = useState<Slot | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Instructor card expansion
  const [expandedInstructor, setExpandedInstructor] = useState<string | null>(null);

  // Past sessions pagination
  const [pastVisibleCount, setPastVisibleCount] = useState(PAST_PAGE_SIZE);
  const [instVisibleCount, setInstVisibleCount] = useState(INST_PAGE_SIZE);

  // ── Data Loading ───────────────────────────────────────────────────

  const loadAll = async () => {
    try {
      setLoading(true);
      const [instData, bookData, sessData, dashResp] = await Promise.all([
        apiGet("/instructors"),
        apiGet("/bookings/me"),
        apiGet("/sessions"),
        apiGet("/dashboard/trainee"),
      ]);
      setInstructors(Array.isArray(instData) ? instData : []);
      setBookings(Array.isArray(bookData) ? bookData : []);
      setSessions(Array.isArray(sessData) ? sessData : []);
      setDashData(dashResp);

      try {
        const recData = await apiGet("/records/trainee");
        setResults(Array.isArray(recData) ? recData : []);
      } catch { setResults([]); }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);
  useFocusEffect(useCallback(() => { loadAll(); }, []));

  // ── Derived Data ───────────────────────────────────────────────────

  const sessionsCompleted = dashData?.progress?.sessions_completed ?? 0;
  const targetSessions    = dashData?.progress?.target_sessions ?? 10;
  const currentScore      = dashData?.progress?.current_score ?? 0;
  const badge             = dashData?.welcome?.badge ?? "—";

  const upcomingBookings = useMemo(
    () => bookings.filter(b => b.status === "confirmed").sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
    [bookings]
  );

  const completedSessions = useMemo(
    () => sessions.filter(s => s.status === "completed").sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [sessions]
  );

  const resultsBySession = useMemo(() => {
    const map: Record<string, ResultDoc> = {};
    for (const r of results) { if (r.session_id) map[r.session_id] = r; }
    return map;
  }, [results]);

  // Separate language and skill filter options
  const languageOptions = useMemo(() => {
    const set = new Set<string>();
    instructors.forEach(i => i.languages?.forEach(l => set.add(l)));
    return ["All", ...Array.from(set).sort()];
  }, [instructors]);

  const skillOptions = useMemo(() => {
    const set = new Set<string>();
    instructors.forEach(i => i.specialties?.forEach(s => set.add(s)));
    return ["All", ...Array.from(set).sort()];
  }, [instructors]);

  const [langFilter, setLangFilter] = useState("All");
  const [skillFilter, setSkillFilter] = useState("All");

  const filteredInstructors = useMemo(() => {
    return instructors.filter(i => {
      if (langFilter !== "All" && !(i.languages || []).includes(langFilter)) return false;
      if (skillFilter !== "All" && !(i.specialties || []).includes(skillFilter)) return false;
      return true;
    });
  }, [instructors, langFilter, skillFilter]);

  // ── Booking Flow ───────────────────────────────────────────────────

  const openBookingModal = async (instructor: InstructorProfile) => {
    setSelectedInstructor(instructor);
    setSelectedSlot(null);
    setShowBooking(true);
    setSlotsLoading(true);
    try {
      const data = await apiGet(`/instructors/${instructor.instructor_id}/availability`);
      setSlots(Array.isArray(data) ? data : []);
    } catch { setSlots([]); }
    finally { setSlotsLoading(false); }
  };

  const confirmBooking = async () => {
    if (!selectedSlot) { Alert.alert("Select a time slot"); return; }
    try {
      setBookingInProgress(true);
      const res = await apiPost("/bookings", { slot_id: selectedSlot.slot_id });
      Alert.alert("Booked!", `Session with ${res?.instructor_name || selectedInstructor?.name} on ${fmtDate(selectedSlot.start_time)} at ${fmtTime(selectedSlot.start_time)}`);
      setShowBooking(false);
      await loadAll();
    } catch (e: any) {
      Alert.alert("Booking failed", e?.message || "Could not book slot");
    } finally { setBookingInProgress(false); }
  };

  const cancelBooking = async (bookingId: string) => {
    Alert.alert("Cancel Booking", "Are you sure?", [
      { text: "No" },
      { text: "Yes, cancel", style: "destructive", onPress: async () => {
        try {
          await apiDelete(`/bookings/${bookingId}`);
          Alert.alert("Cancelled");
          await loadAll();
        } catch (e: any) { Alert.alert("Error", e?.message || "Failed"); }
      }},
    ]);
  };

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={page.centerText}>Loading sessions…</Text>
      </View>
    );
  }

  const visiblePast = completedSessions.slice(0, pastVisibleCount);
  const hasMorePast = pastVisibleCount < completedSessions.length;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>

      {/* ═══ 1. QUICK STATS ═══════════════════════════════════════════ */}
      <FadeInView delay={0}>
      <View style={s.statsRow}>
        <MetricCard
          label="Sessions"
          value={`${sessionsCompleted}/${targetSessions}`}
          icon="📊"
          tintKey="blue"
          subtitle={`${Math.max(0, targetSessions - sessionsCompleted)} remaining`}
        />
        <MetricCard
          label="Score"
          value={currentScore > 0 ? `${currentScore}%` : "—"}
          icon="🎯"
          tintKey={currentScore >= 80 ? "green" : currentScore >= 60 ? "yellow" : "red"}
        />
        <MetricCard
          label="Badge"
          value={badge}
          icon="🛡️"
          tintKey="purple"
        />
      </View>
      </FadeInView>

      {/* ═══ 2. INSTRUCTOR DIRECTORY ══════════════════════════════════ */}
      <SectionHeader icon="📅" iconBg={colors.blueLighter} label="Book a New Session" />

      {/* Language filter */}
      <Text style={s.filterLabel}>Language</Text>
      <FilterChips options={languageOptions} value={langFilter} onChange={(v) => { setLangFilter(v); setInstVisibleCount(INST_PAGE_SIZE); }} />

      {/* Skills filter */}
      <Text style={s.filterLabel}>Specialties</Text>
      <View style={s.filterWrap}>
        {skillOptions.map(opt => {
          const active = opt === skillFilter;
          return (
            <AnimatedPressable
              key={opt}
              onPress={() => { setSkillFilter(opt); setInstVisibleCount(INST_PAGE_SIZE); }}
              scaleDown={0.95}
              style={[s.filterChip, active && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{opt}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {/* Instructor Cards (simplified) */}
      {filteredInstructors.length === 0 ? (
        <EmptyState text="No instructors match your filters" />
      ) : (
        <View style={s.instructorGrid}>
          {filteredInstructors.slice(0, instVisibleCount).map(inst => {
            const isExpanded = expandedInstructor === inst.instructor_id;
            return (
              <View key={inst.instructor_id} style={s.instCard}>
                <View style={s.instTop}>
                  <View style={s.instAvatar}>
                    <Text style={s.instAvatarText}>{initials(inst.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.instName}>{inst.name}</Text>
                    <View style={s.instRatingRow}>
                      <Text style={s.instStars}>{starsString(inst.rating)}</Text>
                      <Text style={s.instRatingNum}>{inst.rating.toFixed(1)}</Text>
                      <Text style={s.instReviews}>({inst.total_reviews})</Text>
                    </View>
                  </View>
                  <Text style={s.instPrice}>{inst.price_per_session} {inst.currency}</Text>
                </View>

                {/* Primary specialty only */}
                {(inst.specialties || []).length > 0 && (
                  <View style={s.instSpecialties}>
                    {(inst.specialties || []).slice(0, isExpanded ? undefined : 2).map((sp, i) => (
                      <View key={i} style={s.specPill}>
                        <Text style={s.specText}>{sp}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Expandable details */}
                {isExpanded && (
                  <View style={s.instDetails}>
                    <Text style={s.instMetaText}>🌐 {(inst.languages || []).join(", ") || "—"}</Text>
                    <Text style={s.instMetaText}>🚗 {inst.vehicle || "—"}</Text>
                    <Text style={s.instMetaText}>📍 {inst.location_area || "—"}</Text>
                    <Text style={s.instMetaText}>📅 {inst.experience_years} years experience</Text>
                  </View>
                )}

                <View style={s.instActions}>
                  <AnimatedPressable onPress={() => setExpandedInstructor(isExpanded ? null : inst.instructor_id)} style={s.detailsBtn}>
                    <Text style={s.detailsBtnText}>{isExpanded ? "Less" : "Details"}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={s.instBtn} onPress={() => openBookingModal(inst)}>
                    <Text style={s.instBtnText}>Select & Book</Text>
                  </AnimatedPressable>
                </View>
              </View>
            );
          })}
          {instVisibleCount < filteredInstructors.length && (
            <AnimatedPressable
              onPress={() => setInstVisibleCount(c => c + INST_PAGE_SIZE)}
              style={s.loadMoreBtn}
            >
              <Text style={s.loadMoreText}>
                Show More ({filteredInstructors.length - instVisibleCount} more)
              </Text>
            </AnimatedPressable>
          )}
        </View>
      )}

      {/* ═══ 3. UPCOMING SESSIONS ════════════════════════════════════ */}
      <SectionHeader icon="🕒" iconBg={colors.greenBorderAlt} label="Upcoming Sessions" count={upcomingBookings.length > 0 ? upcomingBookings.length : undefined} />

      {upcomingBookings.length === 0 ? (
        <EmptyState text="No upcoming sessions. Browse instructors above to book one!" />
      ) : (
        <View style={s.upcomingGrid}>
          {upcomingBookings.map(b => (
            <View key={b.booking_id} style={s.upcomingCard}>
              <View style={s.upcomingTop}>
                <View style={s.upcomingAvatar}>
                  <Text style={s.upcomingAvatarText}>{initials(b.instructor_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.upcomingName}>{b.instructor_name || "Instructor"}</Text>
                  <Text style={s.upcomingDate}>{fmtDate(b.start_time)} at {fmtTime(b.start_time)}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: b.status === "confirmed" ? colors.green : colors.borderMid }]}>
                  <Text style={s.statusPillText}>{b.status}</Text>
                </View>
              </View>
              <View style={s.upcomingActions}>
                <AnimatedPressable style={s.cancelBtn} onPress={() => cancelBooking(b.booking_id)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </AnimatedPressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ═══ 4. PAST SESSIONS (paginated) ════════════════════════════ */}
      <SectionHeader icon="📋" iconBg={colors.purpleBorder} label="Past Sessions" count={completedSessions.length > 0 ? completedSessions.length : undefined} />

      {completedSessions.length === 0 ? (
        <EmptyState text="No completed sessions yet" />
      ) : (
        <View style={{ gap: 10 }}>
          {visiblePast.map(sess => {
            const result = resultsBySession[sess.session_id];
            const score = result?.performance_score ?? result?.analysis?.overall ?? 0;
            const passed = score >= 60;

            return (
              <SessionCard
                key={sess.session_id}
                sessionId={sess.session_id}
                date={fmtDate(sess.created_at)}
                roadType={sess.road_type}
                performanceScore={score}
                passed={passed}
                instructorName={sess.instructor_name}
                variant="compact"
                onPress={() => router.push({
                  pathname: "/(studenttabs)/session-report",
                  params: { sessionId: sess.session_id, from: "sessions" },
                })}
              />
            );
          })}

          {hasMorePast && (
            <AnimatedPressable
              onPress={() => setPastVisibleCount(c => c + PAST_PAGE_SIZE)}
              style={s.loadMoreBtn}
            >
              <Text style={s.loadMoreText}>
                Load More ({completedSessions.length - pastVisibleCount} remaining)
              </Text>
            </AnimatedPressable>
          )}
        </View>
      )}

      {/* ═══ BOOKING MODAL ═══════════════════════════════════════════ */}
      <Modal visible={showBooking} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Book Your Session</Text>
                <Pressable onPress={() => setShowBooking(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </Pressable>
              </View>

              {selectedInstructor && (
                <>
                  <View style={s.modalInstRow}>
                    <View style={s.modalInstAvatar}>
                      <Text style={s.modalInstAvatarText}>{initials(selectedInstructor.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.modalInstName}>{selectedInstructor.name}</Text>
                      <Text style={s.modalInstMeta}>
                        {starsString(selectedInstructor.rating)} {selectedInstructor.rating.toFixed(1)} · {(selectedInstructor.languages || []).join(", ")}
                      </Text>
                      <Text style={s.modalInstMeta}>
                        {selectedInstructor.price_per_session} {selectedInstructor.currency}/session
                      </Text>
                    </View>
                  </View>

                  <Text style={s.modalSectionTitle}>Available Time Slots</Text>

                  {slotsLoading ? (
                    <ActivityIndicator style={{ marginVertical: 20 }} />
                  ) : slots.length === 0 ? (
                    <Text style={s.modalEmpty}>No available slots in the next 2 weeks</Text>
                  ) : (
                    <View style={s.scheduleGrid}>
                      {(() => {
                        const byDate: Record<string, Slot[]> = {};
                        slots.forEach(slot => {
                          const key = fmtDate(slot.start_time);
                          if (!byDate[key]) byDate[key] = [];
                          byDate[key].push(slot);
                        });
                        const dateKeys = Object.keys(byDate);
                        return (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={s.scheduleColumns}>
                              {dateKeys.map(dateKey => (
                                <View key={dateKey} style={s.scheduleCol}>
                                  <Text style={s.scheduleColHeader}>{dateKey}</Text>
                                  {byDate[dateKey].map(slot => {
                                    const selected = selectedSlot?.slot_id === slot.slot_id;
                                    const isBooked = slot.status !== "open";
                                    return (
                                      <Pressable
                                        key={slot.slot_id}
                                        style={[s.scheduleSlot, selected && s.scheduleSlotSelected, isBooked && s.scheduleSlotBooked]}
                                        onPress={() => !isBooked && setSelectedSlot(slot)}
                                        disabled={isBooked}
                                      >
                                        <Text style={[s.scheduleSlotText, selected && { color: "#FFF" }, isBooked && { color: "#9CA3AF" }]}>
                                          {fmtTime(slot.start_time)}
                                        </Text>
                                        {isBooked && <Text style={s.scheduleSlotBookedLabel}>Unavailable</Text>}
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        );
                      })()}
                    </View>
                  )}

                  {selectedSlot && (
                    <View style={s.bookingSummary}>
                      <Text style={s.bookingSummaryTitle}>Booking Summary</Text>
                      <Text style={s.bookingSummaryText}>
                        Session with {selectedInstructor.name} on {fmtDate(selectedSlot.start_time)} at {fmtTime(selectedSlot.start_time)}
                      </Text>
                    </View>
                  )}

                  <View style={s.modalActions}>
                    <Pressable
                      style={[s.confirmBtn, (!selectedSlot || bookingInProgress) && { opacity: 0.5 }]}
                      onPress={confirmBooking}
                      disabled={!selectedSlot || bookingInProgress}>
                      <Text style={s.confirmBtnText}>
                        {bookingInProgress ? "Booking…" : "Confirm Booking"}
                      </Text>
                    </Pressable>
                    <Pressable style={s.modalCancelBtn} onPress={() => setShowBooking(false)}>
                      <Text style={s.modalCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:    { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: space.page, paddingBottom: 40, gap: 12 },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },

  // Filters
  filterLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.subtext, marginTop: 4, marginBottom: -4 },
  filterWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.borderMid, backgroundColor: colors.cardBg },
  filterChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  filterChipText: { fontSize: 13, fontFamily: fonts.medium, color: colors.subtext },
  filterChipTextActive: { color: "#FFFFFF", fontFamily: fonts.semibold },

  // Stats row
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  // Instructor cards
  instructorGrid: { gap: 12 },
  instCard:       { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 14 },
  instTop:        { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  instAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  instAvatarText: { color: "#FFF", fontFamily: fonts.bold, fontSize: 14 },
  instName:       { fontFamily: fonts.bold, fontSize: 14, color: colors.textAlt },
  instRatingRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  instStars:      { color: colors.amber, fontSize: 12 },
  instRatingNum:  { fontFamily: fonts.bold, fontSize: 12, color: colors.textAlt },
  instReviews:    { fontSize: 11, color: colors.subtext },
  instPrice:      { fontFamily: fonts.bold, fontSize: 13, color: colors.blue },
  instSpecialties:{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  specPill:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.pageBg },
  specText:       { fontSize: 11, fontFamily: fonts.extrabold, color: colors.label },
  instDetails:    { gap: 4, marginBottom: 10, paddingLeft: 60 },
  instMetaText:   { fontSize: 12, fontFamily: fonts.bold, color: colors.label },
  instActions:    { flexDirection: "row", gap: 8 },
  detailsBtn:     { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingVertical: 10, alignItems: "center" },
  detailsBtnText: { fontFamily: fonts.extrabold, fontSize: 12, color: colors.label },
  instBtn:        { flex: 2, backgroundColor: colors.blue, borderRadius: radius.input, paddingVertical: 10, alignItems: "center" },
  instBtnText:    { color: "#FFF", fontFamily: fonts.extrabold, fontSize: 12 },

  // Upcoming cards
  upcomingGrid:      { gap: 10 },
  upcomingCard:      { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 14 },
  upcomingTop:       { flexDirection: "row", alignItems: "center", gap: 12 },
  upcomingAvatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  upcomingAvatarText:{ color: "#FFF", fontFamily: fonts.bold, fontSize: 13 },
  upcomingName:      { fontFamily: fonts.bold, fontSize: 13, color: colors.textAlt },
  upcomingDate:      { fontSize: 12, fontFamily: fonts.medium, color: colors.subtext, marginTop: 2 },
  statusPill:        { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText:    { color: "#FFF", fontFamily: fonts.extrabold, fontSize: 11, textTransform: "capitalize" as any },
  upcomingActions:   { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, gap: 10 },
  cancelBtn:         { borderWidth: 1, borderColor: colors.redDark, borderRadius: radius.input, paddingHorizontal: 16, paddingVertical: 8 },
  cancelBtnText:     { color: colors.redDark, fontFamily: fonts.extrabold, fontSize: 12 },

  // Load more
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
    fontFamily: fonts.bold,
    color: colors.blue,
  },

  // Modal
  modalOverlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalCard:         { backgroundColor: colors.cardBg, borderRadius: radius.cardXl, maxHeight: "85%" as any, padding: 20 },
  modalHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle:        { fontFamily: fonts.bold, fontSize: 18, color: colors.textAlt },
  modalClose:        { fontSize: 22, color: colors.subtext, padding: 4 },
  modalInstRow:      { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.pageBg, borderRadius: radius.card, padding: 14, marginBottom: 16 },
  modalInstAvatar:   { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  modalInstAvatarText:{ color: "#FFF", fontFamily: fonts.extrabold, fontSize: 16 },
  modalInstName:     { fontFamily: fonts.bold, fontSize: 15, color: colors.textAlt },
  modalInstMeta:     { fontSize: 12, fontFamily: fonts.bold, color: colors.subtext, marginTop: 2 },
  modalSectionTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.textAlt, marginBottom: 10 },
  modalEmpty:        { textAlign: "center", color: colors.subtext, fontFamily: fonts.bold, fontSize: 12, marginVertical: 20 },

  // Schedule grid
  scheduleGrid:        { marginBottom: 16 },
  scheduleColumns:     { flexDirection: "row", gap: 10 },
  scheduleCol:         { alignItems: "center", minWidth: 80 },
  scheduleColHeader:   { fontFamily: fonts.extrabold, fontSize: 11, color: colors.textAlt, marginBottom: 8, textAlign: "center" },
  scheduleSlot:        { borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.pageBg, marginBottom: 6, width: "100%" as any, alignItems: "center" },
  scheduleSlotSelected:    { backgroundColor: colors.blue, borderColor: colors.blue },
  scheduleSlotBooked:      { backgroundColor: colors.disabledBg, borderColor: colors.disabledBorder, opacity: 0.7 },
  scheduleSlotText:        { fontFamily: fonts.bold, fontSize: 12, color: colors.label },
  scheduleSlotBookedLabel: { fontSize: 9, fontFamily: fonts.bold, color: colors.disabled, marginTop: 1 },

  // Booking summary
  bookingSummary:     { backgroundColor: tint.blue.bg, borderWidth: 1, borderColor: tint.blue.border, borderRadius: radius.card, padding: 14, marginBottom: 16 },
  bookingSummaryTitle:{ fontFamily: fonts.extrabold, fontSize: 13, color: tint.blue.text, marginBottom: 4 },
  bookingSummaryText: { fontSize: 12, fontFamily: fonts.bold, color: tint.blue.text },

  // Modal actions
  modalActions:   { gap: 10, marginTop: 8 },
  confirmBtn:     { backgroundColor: colors.blue, borderRadius: radius.input, paddingVertical: 14, alignItems: "center" },
  confirmBtnText: { color: "#FFF", fontFamily: fonts.bold, fontSize: 14 },
  modalCancelBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingVertical: 12, alignItems: "center" },
  modalCancelText:{ fontFamily: fonts.bold, fontSize: 13, color: colors.textAlt },
});
