import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiGet, apiPost, apiPatch } from "../../lib/api";
import { colors, fonts, radius, space, shadow, tint } from "../../lib/theme";

type SessionStatus = "scheduled" | "active" | "completed" | "cancelled" | "confirmed";

type SessionDoc = {
  session_id: string | null;
  booking_id?: string;
  trainee_id: string;
  trainee_name?: string;
  instructor_id: string;
  vehicle_id: string | null;
  scheduled_at: string;
  duration_min: number;
  status: SessionStatus;
  notes?: string;
  created_at?: string;
  started_at?: string | null;
  ended_at?: string | null;
};

type Learner = {
  user_id: string;
  role: "trainee";
  name?: string;
  email?: string;
};

type ReportResponse = {
  session: SessionDoc;
  analysis: {
    behavior: string;
    confidence: number;
    overall: number;
    badge: string;
    probs?: Record<string, number>;
  };
  ai_feedback: Array<{ priority?: string; title: string; message: string; icon?: string }>;
  instructor_feedback?: string;
  instructor_notes?: string;
};

function safeParseMs(s?: string | null) {
  if (!s) return 0;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : 0;
}

function formatDate(ms: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(ms: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtSessionLine(s: any, isConfirmed: boolean, schedMs: number) {
  const road = (s as any).road_type || "";
  const date = formatDate(schedMs);
  const time = formatTime(schedMs);

  // Try to build a readable line from available data
  const created = s.created_at ? formatDate(safeParseMs(s.created_at)) : "";
  const displayDate = date || created || "";
  const displayTime = time || "";

  if (isConfirmed) {
    const parts = ["Booked"];
    if (displayDate) parts.push(displayDate);
    if (displayTime) parts.push(`at ${displayTime}`);
    return parts.join(" · ");
  }

  const parts: string[] = [];
  if (road) parts.push(`${road} road`);
  if (displayDate) parts.push(displayDate);
  if (displayTime) parts.push(displayTime);
  return parts.join(" · ") || "Session";
}

function initials(name?: string, id?: string) {
  const base = (name || id || "").trim();
  if (!base) return "—";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function labelLearner(l: Learner) {
  return l.name?.trim() || l.email?.trim() || l.user_id;
}

function pillFor(status: SessionStatus) {
  switch (status) {
    case "confirmed":
      return { bg: "#2563EB", text: "#fff", label: "Booked" };
    case "active":
      return { bg: colors.green, text: "#fff", label: "Active" };
    case "completed":
      return { bg: colors.blue, text: "#fff", label: "Completed" };
    case "cancelled":
      return { bg: colors.redDeep, text: "#fff", label: "Cancelled" };
    default:
      return { bg: colors.borderLight, text: colors.textAlt, label: "Scheduled" };
  }
}

function msToClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function friendlyError(e: any): string {
  const maybeDetail =
    e?.response?.data?.detail ||
    e?.data?.detail ||
    e?.response?.data?.message ||
    e?.message;

  const status = e?.response?.status || e?.status;
  if (status && maybeDetail) return `${status}: ${String(maybeDetail)}`;
  if (maybeDetail) return String(maybeDetail);
  return "Request failed.";
}

// Module-level state that persists across tab navigation
let _simStartTime = 0;
let _simWindowsCache: any[] = [];
let _simSessionId: string | null = null;

export default function SessionsScreen() {
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      loadSessionsInFlight.current = false;
      loadLearnersInFlight.current = false;
      openReportInFlight.current = false;
    };
  }, []);

  const [loading, setLoading] = useState(true);

  const [learners, setLearners] = useState<Learner[]>([]);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = useState("");

  // analysis panel
  const [selectedReport, setSelectedReport] = useState<ReportResponse | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // ending / generating state
  const [endingId, setEndingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // road type picker modal
  const [roadTypePickerId, setRoadTypePickerId] = useState<string | null>(null);

  // post-end modal (notes + generate report)
  const [postEndModal, setPostEndModal] = useState<{ sessionId: string; traineeName: string } | null>(null);
  const [instructorNotes, setInstructorNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  // live simulation state
  const [simWindows, setSimWindows] = useState<any[]>([]);
  const [simRevealed, setSimRevealed] = useState(0);
  const [simRunning, setSimRunning] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simSummaryFeedback, setSimSummaryFeedback] = useState<string | null>(null);
  const [simInstructorFeedback, setSimInstructorFeedback] = useState<string | null>(null);
  const [simPerformanceScore, setSimPerformanceScore] = useState<number>(0);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // detail modal
  const [detailSession, setDetailSession] = useState<SessionDoc | null>(null);

  // edit notes in analysis panel
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotesDraft, setEditNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // debug / UX
  const [lastAction, setLastAction] = useState<string>("");

  // prevent overlapping fetches
  const loadSessionsInFlight = useRef(false);
  const loadLearnersInFlight = useRef(false);
  const openReportInFlight = useRef(false);

  const learnerMap = useMemo(() => {
    const m = new Map<string, Learner>();
    learners.forEach((l) => m.set(l.user_id, l));
    return m;
  }, [learners]);

  const activeSession = useMemo(() => sessions.find((s) => s.status === "active") || null, [sessions]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!activeSession) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [activeSession]);

  // Track when simulation started locally (avoids UTC offset issues)
  const simStartTimeRef = useRef<number>(0);

  const activeElapsed = useMemo(() => {
    if (!activeSession) return 0;
    if (simStartTimeRef.current) return Date.now() - simStartTimeRef.current;
    return 0;
  }, [activeSession, tick]);

  const loadLearners = async () => {
    if (loadLearnersInFlight.current) return;
    loadLearnersInFlight.current = true;

    try {
      if (!isMountedRef.current) return;

      setLastAction("Loading trainees…");

      const data = await apiGet("/instructor/learners");
      if (!isMountedRef.current) return;

      const arr: Learner[] = Array.isArray(data) ? data : [];
      setLearners(arr);

      setLastAction("Trainees loaded ✅");
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setLearners([]);
      const msg = friendlyError(e);
      setLastAction(`Trainees failed ❌ ${msg}`);
      Alert.alert("Learners", msg);
    } finally {
      if (!isMountedRef.current) return;

      loadLearnersInFlight.current = false;
    }
  };

  const loadSessions = async () => {
    if (loadSessionsInFlight.current) return;
    loadSessionsInFlight.current = true;

    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      setLastAction("Loading sessions…");

      const data = await apiGet("/sessions");
      if (!isMountedRef.current) return;

      setSessions(Array.isArray(data) ? data : []);
      setLastAction("Sessions loaded ✅");
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setSessions([]);
      const msg = friendlyError(e);
      setLastAction(`Sessions failed ❌ ${msg}`);
      Alert.alert("Sessions", msg);
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
      loadSessionsInFlight.current = false;
    }
  };

  // Restore simulation state when returning to this screen
  const restoreSimulation = () => {
    if (_simWindowsCache.length > 0 && _simStartTime > 0) {
      const elapsedSec = (Date.now() - _simStartTime) / 1000;
      const shouldBeRevealed = Math.min(Math.floor(elapsedSec / 12), _simWindowsCache.length);

      setSimWindows(_simWindowsCache);
      setSimRevealed(shouldBeRevealed);
      setSimLoading(false);
      simStartTimeRef.current = _simStartTime;

      // Resume timer if not all revealed yet
      if (shouldBeRevealed < _simWindowsCache.length) {
        setSimRunning(true);
        startRevealTimer(_simWindowsCache, shouldBeRevealed);
      } else {
        setSimRunning(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLearners();
      loadSessions();
      restoreSimulation();
      return () => {};
    }, [])
  );

  // Show a road type picker before starting
  const promptRoadType = (id: string) => {
    setRoadTypePickerId(id);
  };

  // Track pending simulation so it starts after sessions refresh
  const pendingSimRef = useRef<string | null>(null);

  const startSession = async (id: string, roadType: string) => {
    try {
      console.log("[START] Starting session", id, roadType);
      setLastAction(`Starting ${id}…`);
      setSimLoading(true);
      simStartTimeRef.current = Date.now();
      const result = await apiPost(`/sessions/${id}/start`, { road_type: roadType });
      console.log("[START] Result:", JSON.stringify(result));
      if (!isMountedRef.current) return;
      setLastAction("Session started ✅");

      // Get the session_id from the start response or by fetching sessions
      const sessionId = result?.session_id;
      if (sessionId) {
        pendingSimRef.current = sessionId;
      }

      await loadSessions();

      // If we got a session_id from start, use it. Otherwise find active session.
      if (sessionId) {
        startSimulation(sessionId);
      } else {
        const refreshed = await apiGet("/sessions");
        if (!isMountedRef.current) return;
        const active = (Array.isArray(refreshed) ? refreshed : []).find((s: any) => s.status === "active");
        if (active?.session_id) {
          startSimulation(active.session_id);
        } else {
          setSimLoading(false);
        }
      }
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setSimLoading(false);
      const msg = friendlyError(e);
      console.log("[START] Error:", msg, e);
      setLastAction(`Start failed ❌ ${msg}`);
      Alert.alert("Start", msg);
    }
  };

  // ── Live simulation ───────────────────────────────────────────────────
  const startSimulation = async (sessionId: string) => {
    setSimLoading(true);
    setSimWindows([]);
    setSimRevealed(0);
    setSimRunning(false);
    setSimSummaryFeedback(null);
    setSimInstructorFeedback(null);
    setSimPerformanceScore(0);
    setLastAction("Analyzing driving data...");

    try {
      const result = await apiPost(`/sessions/${sessionId}/simulate`, {});
      if (!isMountedRef.current) return;

      const windows = result.windows || [];

      // Persist to module-level
      _simWindowsCache = windows;
      _simStartTime = Date.now();
      _simSessionId = sessionId;

      setSimWindows(windows);
      setSimPerformanceScore(result.performance_score || 0);
      setSimSummaryFeedback(result.summary_feedback || null);
      setSimInstructorFeedback(result.instructor_feedback || null);
      setSimLoading(false);
      setSimRunning(true);
      setSimRevealed(0);
      simStartTimeRef.current = _simStartTime;

      startRevealTimer(windows);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setSimLoading(false);
      const msg = friendlyError(e);
      setLastAction(`Simulation failed: ${msg}`);
    }
  };

  const startRevealTimer = (windows: any[], startFrom = 0) => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    let count = startFrom;
    simTimerRef.current = setInterval(() => {
      count++;
      if (count >= windows.length) {
        if (simTimerRef.current) clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      setSimRevealed(count);
    }, 12000);
  };

  const stopSimulation = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setSimRunning(false);
    setSimRevealed(simWindows.length || _simWindowsCache.length);
  };

  const clearSimulationState = () => {
    stopSimulation();
    setSimWindows([]);
    setSimRevealed(0);
    setSimLoading(false);
    simStartTimeRef.current = 0;
    _simStartTime = 0;
    _simWindowsCache = [];
    _simSessionId = null;
  };

  // Cleanup simulation timer on unmount
  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  const openReport = async (sessionId: string) => {
    if (openReportInFlight.current) return;
    openReportInFlight.current = true;

    try {
      if (!isMountedRef.current) return;

      setLastAction(`Opening analysis for ${sessionId}…`);
      setReportLoading(true);
      setSelectedReport(null);
      setSelectedSessionId(sessionId);
      setEditingNotes(false);

      const rep = await apiGet(`/sessions/${sessionId}/report`);
      if (!isMountedRef.current) return;

      if (!rep || typeof rep !== "object") {
        setLastAction("Analysis returned invalid data ❌");
        Alert.alert("Analysis", "Report returned empty/invalid data.");
        return;
      }

      setSelectedReport(rep as ReportResponse);
      setLastAction("Analysis loaded ✅");
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setSelectedReport(null);
      const msg = friendlyError(e);
      setLastAction(`Analysis failed ❌ ${msg}`);
      Alert.alert("Analysis", msg);
    } finally {
      if (!isMountedRef.current) return;
      setReportLoading(false);
      openReportInFlight.current = false;
    }
  };

  const endSession = async (sessionId: string) => {
    if (endingId) return;

    // Capture trainee name before async ops
    const s = sessions.find((x) => x.session_id === sessionId);
    const learner = learnerMap.get(s?.trainee_id || "");
    const traineeName = learner ? labelLearner(learner) : (s?.trainee_name || "Unknown");

    const doEnd = window?.confirm?.("End session? This will finalize the session.") ?? true;
    if (!doEnd) return;

    try {
      if (!isMountedRef.current) return;

      setEndingId(sessionId);
      setLastAction(`Ending ${sessionId}…`);

      await apiPost(`/sessions/${sessionId}/end`, {});
      if (!isMountedRef.current) return;

      setLastAction("Session ended ✅");
      setTab("past");

      // Reset simulation state
      clearSimulationState();

      await loadSessions();

      // Show post-end modal for notes + report generation
      setInstructorNotes("");
      setPostEndModal({ sessionId, traineeName });
    } catch (e2: any) {
      if (!isMountedRef.current) return;
      const msg = friendlyError(e2);
      setLastAction(`End failed ❌ ${msg}`);
    } finally {
      if (!isMountedRef.current) return;
      setEndingId(null);
    }
  };

  // Open generate modal from the sessions list (for already-completed sessions)
  const openGenerateModal = (sessionId: string) => {
    const s = sessions.find((x) => x.session_id === sessionId);
    const learner = learnerMap.get(s?.trainee_id || "");
    const traineeName = learner ? labelLearner(learner) : (s?.trainee_name || "Unknown");
    // Pre-fill with existing notes if report is already open for this session
    const existing = selectedSessionId === sessionId ? (selectedReport?.instructor_notes || "") : "";
    setInstructorNotes(existing);
    setPostEndModal({ sessionId, traineeName });
  };

  // Called from the modal's Generate button
  const generateReport = async () => {
    if (!postEndModal) return;
    const { sessionId } = postEndModal;

    try {
      setGenerating(true);
      setGeneratingId(sessionId);
      setLastAction(`Generating report for ${sessionId}…`);

      await apiPost(`/sessions/${sessionId}/generate-feedback`, { instructor_notes: instructorNotes });
      if (!isMountedRef.current) return;

      setLastAction("Report generated ✅");
      setPostEndModal(null);
      setInstructorNotes("");

      await loadSessions();
      await openReport(sessionId);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      const msg = friendlyError(e);
      setLastAction(`Generate failed ❌ ${msg}`);
      Alert.alert("Generate Report", msg);
    } finally {
      if (!isMountedRef.current) return;
      setGenerating(false);
      setGeneratingId(null);
    }
  };

  // Save notes without re-running ML
  const saveNotes = async () => {
    if (!selectedSessionId) return;
    try {
      setSavingNotes(true);
      await apiPatch(`/sessions/${selectedSessionId}/notes`, { instructor_notes: editNotesDraft });
      if (!isMountedRef.current) return;
      setSelectedReport((prev) => prev ? { ...prev, instructor_notes: editNotesDraft } : prev);
      setEditingNotes(false);
    } catch (e: any) {
      Alert.alert("Save Notes", friendlyError(e));
    } finally {
      if (!isMountedRef.current) return;
      setSavingNotes(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = sessions.filter((s) => {
      const keep = tab === "upcoming" ? s.status !== "completed" : s.status === "completed";
      if (!keep) return false;

      const learner = learnerMap.get(s.trainee_id);
      const name = learner ? labelLearner(learner) : s.trainee_id;

      const match =
        !q ||
        name.toLowerCase().includes(q) ||
        (s.status || "").toLowerCase().includes(q);

      return match;
    });

    list.sort((a, b) => {
      if (tab === "upcoming") return safeParseMs(a.scheduled_at) - safeParseMs(b.scheduled_at);
      return safeParseMs(b.ended_at || b.scheduled_at) - safeParseMs(a.ended_at || a.scheduled_at);
    });

    return list;
  }, [sessions, tab, query, learnerMap]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Sessions</Text>
      <Text style={styles.h2}>Manage your driving sessions and view analysis results.</Text>

      {/* Live session */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Live Session</Text>
        {!activeSession && !simLoading ? (
          <Text style={styles.muted}>No active session</Text>
        ) : !activeSession && simLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={{ marginTop: 12, color: colors.blue, fontFamily: fonts.extrabold, fontSize: 13 }}>
              Starting session...
            </Text>
          </View>
        ) : (() => {
          const activeLearner = learnerMap.get(activeSession.trainee_id);
          const activeName = activeLearner ? labelLearner(activeLearner) : (activeSession.trainee_name || "Student");
          const roadType = (activeSession as any).road_type || "Secondary";

          // Simulation stats
          const revealedWindows = simWindows.slice(0, simRevealed);
          const normalCount = revealedWindows.filter((w: any) => w.predicted_label === "Normal").length;
          const aggressiveCount = revealedWindows.filter((w: any) => w.predicted_label === "Aggressive").length;
          const drowsyCount = revealedWindows.filter((w: any) => w.predicted_label === "Drowsy").length;

          return (
            <View style={{ marginTop: 10 }}>
              {/* Header */}
              <View style={styles.liveRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(activeName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{activeName}</Text>
                  <Text style={styles.mutedSmall}>{roadType} road</Text>
                </View>
                <Text style={styles.timer}>{msToClock(activeElapsed)}</Text>
              </View>

              {/* Simulation loading state */}
              {simLoading && (
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <ActivityIndicator size="large" color={colors.blue} />
                  <Text style={{ marginTop: 12, color: colors.blue, fontFamily: fonts.extrabold, fontSize: 13 }}>
                    Analyzing driving data...
                  </Text>
                  <Text style={{ marginTop: 4, color: colors.muted, fontFamily: fonts.bold, fontSize: 11 }}>
                    Running ML pipeline and generating AI feedback
                  </Text>
                </View>
              )}

              {/* Progressive window reveal */}
              {simWindows.length > 0 && !simLoading && (
                <View style={{ marginTop: 12 }}>
                  {/* Progress bar */}
                  <View style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 12 }}>
                        {simRevealed < simWindows.length
                          ? `Window ${simRevealed + 1} — Analyzing...`
                          : `Session analysis complete`}
                      </Text>
                      <Text style={{ color: colors.subtextAlt, fontFamily: fonts.bold, fontSize: 11 }}>
                        {simRevealed} windows processed
                      </Text>
                    </View>
                  </View>

                  {/* Running stats */}
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                    <View style={{ flex: 1, backgroundColor: colors.greenLighter, borderRadius: radius.md, padding: 8, alignItems: "center" }}>
                      <Text style={{ fontSize: 18, fontFamily: fonts.extrabold, color: colors.green }}>{normalCount}</Text>
                      <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: colors.green }}>Normal</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.redLight, borderRadius: radius.md, padding: 8, alignItems: "center" }}>
                      <Text style={{ fontSize: 18, fontFamily: fonts.extrabold, color: colors.redDark }}>{aggressiveCount}</Text>
                      <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: colors.redDark }}>Aggressive</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.yellowLight, borderRadius: radius.md, padding: 8, alignItems: "center" }}>
                      <Text style={{ fontSize: 18, fontFamily: fonts.extrabold, color: colors.amber }}>{drowsyCount}</Text>
                      <Text style={{ fontSize: 10, fontFamily: fonts.bold, color: colors.amber }}>Drowsy</Text>
                    </View>
                  </View>

                  {/* Window feed — show last 4 revealed windows */}
                  {revealedWindows.slice(-4).reverse().map((w: any, idx: number) => {
                    const isNewest = idx === 0;
                    const labelColor = w.predicted_label === "Normal" ? colors.green
                      : w.predicted_label === "Aggressive" ? colors.redDark : colors.amber;
                    const labelBg = w.predicted_label === "Normal" ? colors.greenLighter
                      : w.predicted_label === "Aggressive" ? colors.redLight : colors.yellowLight;
                    return (
                      <View key={w.window_id} style={{
                        marginBottom: 8,
                        backgroundColor: colors.cardBg,
                        borderWidth: 1,
                        borderColor: isNewest ? labelColor : colors.border,
                        borderRadius: radius.icon,
                        padding: 10,
                        opacity: isNewest ? 1 : 0.7,
                      }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 12 }}>
                            Window {w.window_id + 1}
                          </Text>
                          <View style={{ backgroundColor: labelBg, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ color: labelColor, fontFamily: fonts.extrabold, fontSize: 10 }}>
                              {w.predicted_label}
                            </Text>
                          </View>
                          {w.alert_cause && w.alert_cause !== "No alert" && w.alert_cause !== "None" && (
                            <Text style={{ color: colors.muted, fontFamily: fonts.bold, fontSize: 10 }}>
                              {w.alert_cause}
                            </Text>
                          )}
                          {w.severity > 0 && (
                            <Text style={{ color: colors.muted, fontFamily: fonts.bold, fontSize: 10, marginLeft: "auto" }}>
                              Severity: {Math.round(w.severity)}
                            </Text>
                          )}
                        </View>
                        {w.feedback && isNewest && (
                          <Text style={{ marginTop: 6, color: colors.subtextAlt, fontFamily: fonts.bold, fontSize: 11, lineHeight: 16 }}>
                            {w.feedback}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* End session button */}
              <Pressable
                disabled={!!endingId || !activeSession.session_id || simLoading}
                onPress={() => {
                  stopSimulation();
                  activeSession.session_id && endSession(activeSession.session_id);
                }}
                style={({ pressed }) => [
                  styles.endBtn,
                  (!!endingId || simLoading) ? { opacity: 0.6 } : null,
                  pressed ? { opacity: 0.9 } : null,
                ]}
              >
                <Text style={styles.endBtnText}>{endingId ? "Ending..." : "End Session"}</Text>
              </Pressable>
            </View>
          );
        })()}
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <Pressable onPress={() => setTab("upcoming")} style={[styles.tabBtn, tab === "upcoming" ? styles.tabBtnOn : null]}>
          <Text style={[styles.tabText, tab === "upcoming" ? styles.tabTextOn : null]}>📅 Upcoming</Text>
        </Pressable>
        <Pressable onPress={() => setTab("past")} style={[styles.tabBtn, tab === "past" ? styles.tabBtnOn : null]}>
          <Text style={[styles.tabText, tab === "past" ? styles.tabTextOn : null]}>🕘 Past</Text>
        </Pressable>
      </View>

      {/* Search + Refresh */}
      <View style={styles.filterCard}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by trainee name…"
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          onPress={async () => {
            setSelectedReport(null);
            setLastAction("Refreshing…");
            await loadSessions();
          }}
          style={({ pressed }) => [styles.refreshBtn, pressed ? { opacity: 0.9 } : null]}
        >
          <Text style={styles.refreshBtnText}>↻ Refresh</Text>
        </Pressable>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.centerText}>Loading sessions…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No {tab === "upcoming" ? "upcoming" : "past"} sessions</Text>
          <Text style={styles.emptySub}>
            {tab === "upcoming"
              ? "Bookings from students will appear here. Switch to Past to see completed sessions."
              : "Completed sessions will appear here once students finish their sessions."}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((s) => {
            const learner = learnerMap.get(s.trainee_id);
            const name = learner ? labelLearner(learner) : (s.trainee_name || s.trainee_id);
            const p = pillFor(s.status);
            const schedMs = safeParseMs(s.scheduled_at);
            const rowKey = s.session_id || s.booking_id || s.trainee_id;

            const isConfirmed = s.status === "confirmed";

            return (
              <Pressable
                key={rowKey}
                onPress={() => setDetailSession(s)}
                style={({ pressed }) => [styles.sessionRow, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.sessionTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(learner?.name || s.trainee_name, s.trainee_id)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.studentName} numberOfLines={1}>
                        {name}
                      </Text>
                      <View style={[styles.pill, { backgroundColor: p.bg }]}>
                        <Text style={[styles.pillText, { color: p.text }]}>{p.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.subLine} numberOfLines={1}>
                      {fmtSessionLine(s, isConfirmed, schedMs)}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Session Detail Modal */}
      <Modal
        visible={!!detailSession}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailSession(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDetailSession(null)}
        >
          <Pressable style={styles.detailModalCard} onPress={(e) => e.stopPropagation()}>
            {detailSession && (() => {
              const ds = detailSession;
              const learner = learnerMap.get(ds.trainee_id);
              const name = learner ? labelLearner(learner) : (ds.trainee_name || ds.trainee_id);
              const p = pillFor(ds.status);
              const schedMs = safeParseMs(ds.scheduled_at);
              const isConfirmed = ds.status === "confirmed";
              const canStart = (ds.status === "scheduled" || ds.status === "confirmed") && !endingId && !generatingId;
              const isEndingThis = endingId === ds.session_id;
              const isGeneratingThis = generatingId === ds.session_id;

              return (
                <>
                  {/* Header */}
                  <View style={styles.detailHeader}>
                    <View style={styles.detailAvatarLg}>
                      <Text style={styles.detailAvatarText}>{initials(learner?.name || ds.trainee_name, ds.trainee_id)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName}>{name}</Text>
                      <View style={[styles.pill, { backgroundColor: p.bg, alignSelf: "flex-start", marginTop: 4 }]}>
                        <Text style={[styles.pillText, { color: p.text }]}>{p.label}</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => setDetailSession(null)} style={styles.detailCloseBtn}>
                      <Text style={styles.detailCloseText}>✕</Text>
                    </Pressable>
                  </View>

                  {/* Details */}
                  <View style={styles.detailGrid}>
                    <Meta icon="📅" label="Date" value={formatDate(schedMs)} />
                    <Meta icon="🕒" label="Time" value={formatTime(schedMs)} />
                    <Meta icon="🛣️" label="Road" value={isConfirmed ? "Pending" : ((ds as any).road_type || "Secondary")} />
                    {!isConfirmed && ds.duration_min ? (
                      <Meta icon="⏱️" label="Duration" value={`${ds.duration_min} min`} />
                    ) : null}
                    {ds.notes ? <Meta icon="📝" label="Notes" value={ds.notes} /> : null}
                  </View>

                  {/* Actions */}
                  <View style={styles.detailActions}>
                    {canStart && (
                      <Pressable
                        onPress={() => {
                          setDetailSession(null);
                          if (isConfirmed && ds.booking_id) promptRoadType(ds.booking_id);
                          else if (ds.session_id) promptRoadType(ds.session_id);
                        }}
                        style={({ pressed }) => [styles.detailActionBtn, pressed && { opacity: 0.9 }]}
                      >
                        <Text style={styles.actionBtnText}>Start Session</Text>
                      </Pressable>
                    )}

                    {ds.status === "active" && ds.session_id && (
                      <Pressable
                        disabled={!!endingId}
                        onPress={() => {
                          setDetailSession(null);
                          endSession(ds.session_id!);
                        }}
                        style={({ pressed }) => [
                          styles.detailActionBtnEnd,
                          !!endingId && styles.actionBtnDisabled,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text style={styles.actionBtnText}>{isEndingThis ? "Ending…" : "End Session"}</Text>
                      </Pressable>
                    )}

                    {!isConfirmed && ds.session_id && (
                      <Pressable
                        onPress={() => {
                          setDetailSession(null);
                          openReport(ds.session_id!);
                        }}
                        disabled={!!endingId || !!generatingId}
                        style={({ pressed }) => [
                          styles.detailActionBtnOutline,
                          (!!endingId || !!generatingId) && styles.actionBtnDisabled,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text style={styles.actionBtnOutlineText}>View Analysis</Text>
                      </Pressable>
                    )}

                    {ds.status === "completed" && ds.session_id && (
                      <Pressable
                        disabled={!!generatingId || !!endingId}
                        onPress={() => {
                          setDetailSession(null);
                          openGenerateModal(ds.session_id!);
                        }}
                        style={({ pressed }) => [
                          styles.detailActionBtnGenerate,
                          (!!generatingId || !!endingId) && styles.actionBtnDisabled,
                          isGeneratingThis && { opacity: 0.6 },
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <Text style={styles.actionBtnText}>
                          {isGeneratingThis ? "Generating…" : "Generate Report"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Post-end / Generate Report Modal */}
      <Modal
        visible={!!postEndModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!generating) setPostEndModal(null); }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { if (!generating) setPostEndModal(null); }}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Session Ended</Text>
            <Text style={styles.modalSub}>with {postEndModal?.traineeName}</Text>

            <Text style={styles.modalLabel}>Instructor Notes</Text>
            <Text style={styles.modalHint}>Optional — your feedback will appear on the student's report.</Text>
            <TextInput
              value={instructorNotes}
              onChangeText={setInstructorNotes}
              multiline
              numberOfLines={5}
              placeholder="Add your feedback and suggestions for the student…"
              placeholderTextColor={colors.placeholder}
              style={styles.modalTextInput}
            />

            <View style={styles.modalActions}>
              <Pressable
                disabled={generating}
                onPress={generateReport}
                style={[styles.modalGenerateBtn, generating && { opacity: 0.6 }]}
              >
                {generating ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.modalGenerateBtnText}>Generating…</Text>
                  </View>
                ) : (
                  <Text style={styles.modalGenerateBtnText}>Generate Report →</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Road Type Picker Modal */}
      <Modal
        visible={!!roadTypePickerId}
        transparent
        animationType="fade"
        onRequestClose={() => setRoadTypePickerId(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setRoadTypePickerId(null)}
        >
          <Pressable style={[styles.modalCard, { gap: 12 }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select Road Type</Text>
            <Text style={{ color: colors.subtextAlt, fontFamily: fonts.bold, fontSize: 13 }}>
              What type of road is this session on?
            </Text>
            <Pressable
              onPress={() => {
                const id = roadTypePickerId!;
                setRoadTypePickerId(null);
                startSession(id, "Motorway");
              }}
              style={({ pressed }) => [styles.detailActionBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.actionBtnText}>Motorway</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const id = roadTypePickerId!;
                setRoadTypePickerId(null);
                startSession(id, "Secondary");
              }}
              style={({ pressed }) => [styles.detailActionBtn, { backgroundColor: colors.blueDark }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.actionBtnText}>Secondary</Text>
            </Pressable>
            <Pressable
              onPress={() => setRoadTypePickerId(null)}
              style={({ pressed }) => [styles.modalSkipBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.modalSkipText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Meta({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaIcon}>{icon}</Text>
      <View>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: space.page, paddingBottom: 26, gap: 14 },

  h1: { fontSize: 22, fontFamily: fonts.extrabold, color: colors.textAlt, letterSpacing: -0.5 },
  h2: { marginTop: 4, fontSize: 12, fontFamily: fonts.bold, color: colors.subtext, marginBottom: 6 },

  card: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.cardLg,
    padding: space.lg,
    ...shadow.sm,
  },
  sectionTitle: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 14 },
  muted: { marginTop: 8, color: colors.subtext, fontFamily: fonts.bold, fontSize: 12 },
  mutedSmall: { marginTop: 6, color: colors.subtext, fontFamily: fonts.bold, fontSize: 11 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  liveLabel: { color: colors.subtext, fontFamily: fonts.extrabold },
  liveId: { flex: 1, color: colors.textAlt, fontFamily: fonts.extrabold },
  timer: { fontSize: 22, fontFamily: fonts.extrabold, color: colors.textAlt, fontVariant: ["tabular-nums"] },

  endBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: radius.card,
    backgroundColor: colors.redDark,
    alignItems: "center",
    justifyContent: "center",
  },
  endBtnText: { color: "#fff", fontFamily: fonts.extrabold, fontSize: 14 },

  tabsWrap: { flexDirection: "row", backgroundColor: colors.pageBg, borderRadius: radius.card, padding: 4, borderWidth: 1, borderColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.input, alignItems: "center" },
  tabBtnOn: { backgroundColor: colors.cardBg, ...shadow.sm },
  tabText: { color: colors.subtext, fontFamily: fonts.bold, fontSize: 12 },
  tabTextOn: { color: colors.textAlt },

  filterCard: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.cardLg,
    padding: space.md,
    gap: 10,
  },
  searchWrap: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.pageBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8, fontSize: 14 },
  searchInput: { flex: 1, color: colors.textAlt, fontSize: 13, fontFamily: fonts.bold },
  refreshBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtnText: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 12 },

  sessionRow: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.cardLg,
    padding: space.lg,
    gap: 10,
  },
  sessionTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: tint.blue.bg, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.blue, fontFamily: fonts.extrabold, fontSize: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  studentName: { color: colors.textAlt, fontFamily: fonts.bold, fontSize: 14 },
  subLine: { marginTop: 4, color: colors.subtext, fontFamily: fonts.medium, fontSize: 12 },

  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: fonts.extrabold, fontSize: 11 },

  metaRow: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaIcon: { fontSize: 14 },
  metaLabel: { color: colors.subtext, fontFamily: fonts.bold, fontSize: 11 },
  metaValue: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 12 },

  actionsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: radius.input,
    backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
  },
  actionBtnEnd: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: radius.input,
    backgroundColor: colors.redDark, alignItems: "center", justifyContent: "center",
  },
  actionBtnOutline: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: radius.input,
    borderWidth: 1, borderColor: colors.borderMid, backgroundColor: colors.cardBg,
    alignItems: "center", justifyContent: "center",
  },
  actionBtnGenerate: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: radius.input,
    backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontFamily: fonts.extrabold, fontSize: 13 },
  actionBtnOutlineText: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 13 },
  actionBtnDisabled: { opacity: 0.35 },

  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scoreBig: { fontSize: 44, fontFamily: fonts.extrabold, color: colors.textAlt },
  badge: { backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  badgeText: { color: "#fff", fontFamily: fonts.extrabold, fontSize: 12 },

  feedbackBox: { marginTop: 10, backgroundColor: colors.pageBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space.md },
  feedbackTitle: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 13 },
  feedbackText: { marginTop: 6, color: colors.subtext, fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },

  feedbackItem: { marginTop: 10, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space.md },
  feedbackItemTitle: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 13 },
  feedbackItemText: { marginTop: 6, color: colors.subtext, fontFamily: fonts.bold, fontSize: 12, lineHeight: 18 },

  // Instructor notes
  notesSection: { marginTop: 14, backgroundColor: colors.pageBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space.md },
  notesSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  notesSectionTitle: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 13 },
  editLink: { color: colors.blue, fontFamily: fonts.extrabold, fontSize: 12 },
  notesText: { color: colors.subtext, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 },
  notesInput: {
    minHeight: 80, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardBg, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.medium, color: colors.textAlt, fontSize: 13, textAlignVertical: "top",
  },
  cancelNoteBtn: {
    flex: 1, minHeight: 40, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.cardBg,
  },
  cancelNoteBtnText: { color: colors.subtext, fontFamily: fonts.extrabold, fontSize: 12 },
  saveNoteBtn: {
    flex: 1, minHeight: 40, borderRadius: radius.input,
    backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
  },
  saveNoteBtnText: { color: "#fff", fontFamily: fonts.extrabold, fontSize: 12 },

  center: { alignItems: "center", justifyContent: "center", padding: space.lg },
  centerText: { marginTop: 10, fontFamily: fonts.bold, color: colors.subtext },

  empty: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: space.lg, alignItems: "center" },
  emptyTitle: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 13 },
  emptySub: { marginTop: 6, color: colors.subtext, fontFamily: fonts.bold, fontSize: 12, textAlign: "center" },

  chevron: { fontSize: 18, color: colors.muted, marginLeft: 4 },

  // Detail modal
  detailModalCard: {
    width: "100%", maxWidth: 500, backgroundColor: colors.cardBg,
    borderRadius: radius.cardXl, padding: 24, gap: 16, ...shadow.cardRaised,
  },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  detailAvatarLg: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: tint.blue.bg, alignItems: "center", justifyContent: "center",
  },
  detailAvatarText: { color: colors.blue, fontFamily: fonts.extrabold, fontSize: 16 },
  detailName: { color: colors.textAlt, fontFamily: fonts.extrabold, fontSize: 16 },
  detailCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.pageBg, alignItems: "center", justifyContent: "center",
  },
  detailCloseText: { color: colors.subtext, fontFamily: fonts.extrabold, fontSize: 14 },
  detailGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 16,
    backgroundColor: colors.pageBg, borderRadius: radius.card, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  detailActions: { flexDirection: "column", gap: 10 },
  detailActionBtn: {
    minHeight: 48, borderRadius: radius.card,
    backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
  },
  detailActionBtnEnd: {
    minHeight: 48, borderRadius: radius.card,
    backgroundColor: colors.redDark, alignItems: "center", justifyContent: "center",
  },
  detailActionBtnOutline: {
    minHeight: 48, borderRadius: radius.card, borderWidth: 1,
    borderColor: colors.borderMid, backgroundColor: colors.cardBg,
    alignItems: "center", justifyContent: "center",
  },
  detailActionBtnGenerate: {
    minHeight: 48, borderRadius: radius.card,
    backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
  },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  modalCard: {
    width: "100%", maxWidth: 480, backgroundColor: colors.cardBg,
    borderRadius: radius.cardXl, padding: 24, gap: 6, ...shadow.cardRaised,
  },
  modalTitle: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.textAlt },
  modalSub: { fontSize: 13, fontFamily: fonts.bold, color: colors.subtext, marginBottom: 10 },
  modalLabel: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.textAlt, marginTop: 8 },
  modalHint: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, marginBottom: 6 },
  modalTextInput: {
    minHeight: 110, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.pageBg, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fonts.medium, color: colors.textAlt, fontSize: 13, textAlignVertical: "top", marginTop: 4,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalSkipBtn: {
    flex: 1, minHeight: 50, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.cardBg,
  },
  modalSkipText: { color: colors.subtext, fontFamily: fonts.extrabold, fontSize: 13 },
  modalGenerateBtn: {
    flex: 2, minHeight: 50, borderRadius: radius.card,
    backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
  },
  modalGenerateBtnText: { color: "#fff", fontFamily: fonts.extrabold, fontSize: 13 },
});
