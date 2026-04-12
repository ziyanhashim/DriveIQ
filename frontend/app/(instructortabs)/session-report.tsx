import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  ActivityIndicator,
  useWindowDimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { apiGet } from "../../lib/api";
import {
  colors,
  type_,
  radius,
  space,
  card,
  page,
  shadow,
  divider,
  tint,
  fonts,
} from "../../lib/theme";

// Shared components
import SectionHeader from "../../components/SectionHeader";
import ScoreRing from "../../components/ScoreRing";
import BehaviorBar from "../../components/BehaviorBar";
import FilterChips, { ChipOption } from "../../components/FilterChips";
import MetricCard from "../../components/MetricCard";
import RouteMapModal from "../../components/RouteMapModal";

// ─── Enable LayoutAnimation on Android ──────────────────────────────────────

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ──────────────────────────────────────────────────────────────────

type TriggerFeature = {
  feature: string;
  value: number;
  unit: string;
};

type WindowData = {
  window_id: number;
  predicted_label: "Normal" | "Aggressive" | "Drowsy";
  alert_cause: string;
  severity: number;
  knn_distance: number;
  trigger_features: TriggerFeature[];
  feedback?: string;
  start_time?: string;
  end_time?: string;
  is_flagged?: boolean;
};

type SessionReport = {
  session_id: string;
  road_type: string;
  performance_score: number;
  total_windows: number;
  window_summary: {
    total: number;
    normal: number;
    drowsy: number;
    aggressive: number;
  };
  windows: WindowData[];
  summary_feedback?: string;
  date?: string;
  instructor?: string;
  instructor_notes?: string;
  instructor_feedback?: string;
  report_ready?: boolean;
  has_route?: boolean;
  ai_feedback?: { priority: string; title: string; message: string; icon: string }[];
};

type FilterMode = "All" | "Abnormal" | "Aggressive" | "Drowsy" | "Normal";

const WINDOWS_PER_PAGE = 20;

// ─── Color Helpers ──────────────────────────────────────────────────────────

const LABEL_COLORS = {
  Normal: {
    bg: colors.greenLight,
    border: colors.greenBorder,
    text: colors.greenDark,
    dot: colors.green,
    icon: "checkmark-circle" as const,
  },
  Aggressive: {
    bg: colors.redLight,
    border: colors.redBorder,
    text: colors.redDark,
    dot: colors.red,
    icon: "warning" as const,
  },
  Drowsy: {
    bg: colors.amberBg,
    border: colors.amberBorder,
    text: colors.amberDark,
    dot: colors.amber,
    icon: "moon" as const,
  },
};

function getLabelStyle(label: string) {
  return LABEL_COLORS[label as keyof typeof LABEL_COLORS] ?? LABEL_COLORS.Normal;
}

function getScoreColor(score: number) {
  if (score >= 80) return colors.green;
  if (score >= 60) return colors.yellow;
  return colors.red;
}

function severityLabel(s: number): string {
  if (s <= 2) return "Low";
  if (s <= 5) return "Medium";
  if (s <= 7) return "High";
  return "Critical";
}

function severityColor(s: number): string {
  if (s <= 2) return colors.green;
  if (s <= 5) return colors.yellow;
  if (s <= 7) return colors.orange;
  return colors.red;
}

// ─── Window Block (in the timeline grid) ────────────────────────────────────

function WindowBlock({
  window: w,
  isSelected,
  onPress,
}: {
  window: WindowData;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}) {
  const labelStyle = getLabelStyle(w.predicted_label);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          s.windowBlock,
          { backgroundColor: labelStyle.bg, borderColor: labelStyle.border },
          isSelected && {
            borderColor: labelStyle.dot,
            borderWidth: 2.5,
            ...(Platform.OS === "ios"
              ? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 }
              : { elevation: 2 }),
          },
        ]}
      >
        <View style={[s.windowDot, { backgroundColor: labelStyle.dot }]} />
        <Text style={[s.windowBlockNum, { color: labelStyle.text }]}>
          {w.window_id + 1}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Feedback Panel (expanded window detail) ────────────────────────────────

function FeedbackPanel({ window: w }: { window: WindowData }) {
  const labelStyle = getLabelStyle(w.predicted_label);
  const startMin = w.window_id * 4;
  const endMin = startMin + 4;
  const timeStr = w.start_time ?? `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`;
  const endStr = w.end_time ?? `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

  return (
    <View style={[s.feedbackPanel, { borderLeftColor: labelStyle.dot }]}>
      {/* Header */}
      <View style={s.feedbackHeader}>
        <View style={s.feedbackHeaderLeft}>
          <Ionicons name={labelStyle.icon} size={20} color={labelStyle.dot} />
          <View>
            <Text style={s.feedbackTitle}>Window {w.window_id + 1} — {w.predicted_label}</Text>
            <Text style={s.feedbackTime}>{timeStr} → {endStr}</Text>
          </View>
        </View>
        <View style={[s.severityBadge, { backgroundColor: severityColor(w.severity) + "18" }]}>
          <Text style={[s.severityText, { color: severityColor(w.severity) }]}>
            {severityLabel(w.severity)} ({w.severity.toFixed(1)})
          </Text>
        </View>
      </View>

      {/* Alert Cause */}
      {w.alert_cause && w.alert_cause !== "No alert" && (
        <View style={s.alertCauseRow}>
          <Ionicons name="alert-circle" size={16} color={colors.yellow} />
          <Text style={s.alertCauseText}>
            Alert: <Text style={{ fontFamily: fonts.bold }}>{w.alert_cause}</Text>
          </Text>
        </View>
      )}

      {/* Trigger Features */}
      {w.trigger_features && w.trigger_features.length > 0 && (
        <View style={s.triggerSection}>
          <Text style={s.triggerLabel}>Key Metrics</Text>
          <View style={s.triggerGrid}>
            {w.trigger_features.map((tf, idx) => (
              <View key={idx} style={s.triggerCard}>
                <Text style={s.triggerFeatureName}>{tf.feature}</Text>
                <Text style={s.triggerFeatureValue}>
                  {typeof tf.value === "number" ? tf.value.toFixed(2) : tf.value}{" "}
                  <Text style={s.triggerFeatureUnit}>{tf.unit}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* LLM Feedback */}
      {w.feedback ? (
        <View style={s.llmFeedback}>
          <View style={s.llmFeedbackHeader}>
            <Ionicons name="sparkles" size={16} color={colors.blue} />
            <Text style={s.llmFeedbackTitle}>AI Feedback</Text>
          </View>
          <Text style={s.llmFeedbackText}>{w.feedback}</Text>
        </View>
      ) : (
        <View style={[s.llmFeedback, { backgroundColor: colors.borderLight }]}>
          <Text style={[s.llmFeedbackText, { color: colors.subtext, fontStyle: "italic" }]}>
            No issues detected — driving was within normal parameters.
          </Text>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SessionReportScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterMode>("All");
  const [timelinePage, setTimelinePage] = useState(0);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [showRouteMap, setShowRouteMap] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Fetch report data ──────────────────────────────────────────────────

  useEffect(() => { loadReport(); }, [sessionId]);

  async function loadReport(silent = false) {
    try {
      if (!silent) { setLoading(true); setError(null); }

      const [timelineData, reportData] = await Promise.all([
        apiGet(`/sessions/${sessionId}/timeline`),
        apiGet(`/sessions/${sessionId}/report`),
      ]);

      const reportReady = !!(reportData?.overall_score?.score || reportData?.analysis);

      const merged: SessionReport = {
        session_id: sessionId ?? "",
        road_type: timelineData.road_type,
        performance_score: reportData.overall_score?.score ?? 0,
        total_windows: timelineData.total_windows,
        window_summary: reportData.window_summary ?? {
          total: timelineData.total_windows, normal: 0, drowsy: 0, aggressive: 0,
        },
        windows: timelineData.windows ?? [],
        date: reportData.session_summary?.date,
        instructor: reportData.session_summary?.instructor,
        summary_feedback: reportData.summary_feedback ?? "",
        instructor_notes: reportData.instructor_notes ?? "",
        instructor_feedback: reportData.instructor_feedback ?? "",
        report_ready: reportReady,
        has_route: reportData.has_route ?? false,
        ai_feedback: reportData.ai_feedback,
      };

      if (!reportData.window_summary) {
        const ws = { total: merged.windows.length, normal: 0, drowsy: 0, aggressive: 0 };
        merged.windows.forEach((w) => {
          const label = w.predicted_label?.toLowerCase();
          if (label === "normal") ws.normal++;
          else if (label === "drowsy") ws.drowsy++;
          else if (label === "aggressive") ws.aggressive++;
        });
        merged.window_summary = ws;
      }

      setReport(merged);

      if (reportReady) {
        const firstAbnormal = merged.windows.find((w) => w.predicted_label !== "Normal");
        if (firstAbnormal) setSelectedWindow(firstAbnormal.window_id);
      }

      if (!reportReady) {
        if (!pollRef.current) pollRef.current = setInterval(() => loadReport(true), 12000);
      } else {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch (err: any) {
      if (!silent) setError(err?.message ?? "Failed to load report");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────

  const filteredWindows = useMemo(() => {
    if (!report) return [];
    switch (filter) {
      case "Abnormal": return report.windows.filter((w) => w.predicted_label !== "Normal");
      case "Aggressive": return report.windows.filter((w) => w.predicted_label === "Aggressive");
      case "Drowsy": return report.windows.filter((w) => w.predicted_label === "Drowsy");
      case "Normal": return report.windows.filter((w) => w.predicted_label === "Normal");
      default: return report.windows;
    }
  }, [report, filter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredWindows.length / WINDOWS_PER_PAGE));
  const safePage = Math.min(timelinePage, totalPages - 1);
  const paginatedWindows = filteredWindows.slice(safePage * WINDOWS_PER_PAGE, (safePage + 1) * WINDOWS_PER_PAGE);

  const selectedWindowData = useMemo(() => {
    if (selectedWindow === null || !report) return null;
    return report.windows.find((w) => w.window_id === selectedWindow) ?? null;
  }, [report, selectedWindow]);

  const abnormalWindows = useMemo(() => {
    if (!report) return [];
    return report.windows.filter((w) => w.predicted_label !== "Normal").map((w) => w.window_id);
  }, [report]);

  // ── Filter chip options ────────────────────────────────────────────────

  const filterOptions: ChipOption[] = useMemo(() => {
    if (!report) return [];
    const ws = report.window_summary;
    return [
      { label: "All", count: ws.total, color: colors.blue },
      { label: "Abnormal", count: ws.aggressive + ws.drowsy, color: colors.orange },
      { label: "Aggressive", count: ws.aggressive, color: colors.red },
      { label: "Drowsy", count: ws.drowsy, color: colors.amber },
      { label: "Normal", count: ws.normal, color: colors.green },
    ];
  }, [report]);

  // ── Navigation ─────────────────────────────────────────────────────────

  function jumpToNext() {
    if (abnormalWindows.length === 0) return;
    const currentIdx = abnormalWindows.indexOf(selectedWindow ?? -1);
    const nextIdx = (currentIdx + 1) % abnormalWindows.length;
    selectWindow(abnormalWindows[nextIdx]);
  }

  function jumpToPrev() {
    if (abnormalWindows.length === 0) return;
    const currentIdx = abnormalWindows.indexOf(selectedWindow ?? -1);
    const prevIdx = currentIdx <= 0 ? abnormalWindows.length - 1 : currentIdx - 1;
    selectWindow(abnormalWindows[prevIdx]);
  }

  function selectWindow(id: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedWindow(id);
  }

  function handleFilterChange(label: string) {
    setFilter(label as FilterMode);
    setTimelinePage(0);
  }

  // ── Loading / Error states ─────────────────────────────────────────────

  if (loading) {
    return (
      <View style={page.center}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={page.centerText}>Loading report…</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={page.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.red} />
        <Text style={[page.centerText, { color: colors.red, marginTop: 12 }]}>
          {error ?? "Report not found"}
        </Text>
        <Pressable onPress={() => loadReport()} style={s.retryBtn}>
          <Text style={s.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // ── Report Pending state ───────────────────────────────────────────────

  if (!report.report_ready) {
    return (
      <View style={page.base}>
        <ScrollView contentContainerStyle={[page.content, { paddingTop: 16 }]}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={s.backBtnText}>Back</Text>
          </Pressable>
          <View style={s.pendingCard}>
            <Text style={s.pendingIcon}>⏳</Text>
            <Text style={s.pendingTitle}>Report Pending</Text>
            <Text style={s.pendingText}>
              Your instructor is reviewing this session. The full report will appear here automatically once generated.
            </Text>
            <ActivityIndicator size="small" color={colors.blue} style={{ marginTop: 16 }} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const { window_summary: ws } = report;
  const flaggedCount = ws.aggressive + ws.drowsy;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={page.base}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[page.content, { paddingTop: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back Button ──────────────────────────────────────────────── */}
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.backBtnText}>Back</Text>
        </Pressable>

        {/* ── 1. Metrics Strip ─────────────────────────────────────────── */}
        <View style={s.metricsStrip}>
          <View style={s.scoreRingCard}>
            <ScoreRing score={report.performance_score} size={100} />
          </View>
          <View style={s.metricsRight}>
            <MetricCard label="Windows" value={report.total_windows} icon="📊" tintKey="blue" subtitle={`${report.total_windows * 4} min total`} />
            <MetricCard label="Flagged" value={flaggedCount} icon="⚠️" tintKey={flaggedCount > 0 ? "red" : "green"} subtitle={flaggedCount === 0 ? "All clear" : `${ws.aggressive} aggressive, ${ws.drowsy} drowsy`} />
            <MetricCard label="Road Type" value={report.road_type} icon="🛣️" tintKey="indigo" subtitle={report.date ?? ""} />
          </View>
        </View>

        {/* ── Route Map Button ───────────────────────────────────────── */}
        {report.has_route && (
          <Pressable
            onPress={() => setShowRouteMap(true)}
            style={({ pressed }) => [s.routeBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.routeBtnIcon}>📍</Text>
            <Text style={s.routeBtnText}>View Route Map</Text>
          </Pressable>
        )}

        {/* ── 2. Behavior Breakdown ────────────────────────────────────── */}
        <View style={card.base}>
          <SectionHeader icon="📈" iconBg={colors.greenBorderAlt} label="Behavior Breakdown" />
          <BehaviorBar
            normal={ws.normal}
            aggressive={ws.aggressive}
            drowsy={ws.drowsy}
            total={ws.total}
            height={20}
            showPercentages
          />
        </View>

        {/* ── 3. Window Timeline ───────────────────────────────────────── */}
        <View style={card.base}>
          <SectionHeader
            icon="📊"
            iconBg={colors.blueLighter}
            label="Window Timeline"
            right={
              abnormalWindows.length > 0 ? (
                <View style={s.navArrows}>
                  <Pressable onPress={jumpToPrev} hitSlop={8} style={s.arrowBtn}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </Pressable>
                  <Text style={s.navLabel}>
                    {selectedWindow !== null
                      ? `${abnormalWindows.indexOf(selectedWindow) + 1}/${abnormalWindows.length}`
                      : `${abnormalWindows.length} flagged`}
                  </Text>
                  <Pressable onPress={jumpToNext} hitSlop={8} style={s.arrowBtn}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </Pressable>
                </View>
              ) : null
            }
          />

          {/* Filters */}
          <View style={s.filterRow}>
            <FilterChips
              options={filterOptions}
              value={filter}
              onChange={handleFilterChange}
              showCounts
            />
          </View>

          {/* Timeline Grid (paginated) */}
          <View style={s.timelineGrid}>
            {paginatedWindows.map((w, idx) => (
              <WindowBlock
                key={w.window_id}
                window={w}
                index={idx}
                isSelected={selectedWindow === w.window_id}
                onPress={() => selectWindow(w.window_id)}
              />
            ))}
            {paginatedWindows.length === 0 && (
              <Text style={s.emptyTimeline}>No windows match this filter.</Text>
            )}
          </View>

          {/* Page Controls */}
          {totalPages > 1 && (
            <View style={s.pageControls}>
              <Pressable
                onPress={() => setTimelinePage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                style={({ pressed }) => [s.pageBtn, safePage === 0 && { opacity: 0.3 }, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="chevron-back" size={16} color={colors.text} />
              </Pressable>
              <Text style={s.pageLabel}>
                Page {safePage + 1} of {totalPages}
              </Text>
              <Pressable
                onPress={() => setTimelinePage(Math.min(totalPages - 1, safePage + 1))}
                disabled={safePage >= totalPages - 1}
                style={({ pressed }) => [s.pageBtn, safePage >= totalPages - 1 && { opacity: 0.3 }, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="chevron-forward" size={16} color={colors.text} />
              </Pressable>
            </View>
          )}

          {/* Time axis labels */}
          {filter === "All" && report.windows.length > 0 && (
            <View style={s.timeAxis}>
              <Text style={s.timeAxisLabel}>0:00</Text>
              <Text style={s.timeAxisLabel}>
                {(() => {
                  const mid = Math.floor(report.windows.length / 2) * 4;
                  return `${String(Math.floor(mid / 60)).padStart(2, "0")}:${String(mid % 60).padStart(2, "0")}`;
                })()}
              </Text>
              <Text style={s.timeAxisLabel}>
                {(() => {
                  const end = report.windows.length * 4;
                  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
                })()}
              </Text>
            </View>
          )}
        </View>

        {/* ── 4. Selected Window Detail ────────────────────────────────── */}
        {selectedWindowData ? (
          <FeedbackPanel window={selectedWindowData} />
        ) : (
          <View style={[card.base, s.noSelectionCard]}>
            <Ionicons name="hand-left-outline" size={28} color={colors.muted} />
            <Text style={s.noSelectionText}>Tap a window above to see detailed feedback</Text>
          </View>
        )}

        {/* ── 5. Session Summary (LLM) ─────────────────────────────────── */}
        {report.summary_feedback && (
          <View style={card.base}>
            <SectionHeader icon="🧠" iconBg={colors.blueLighter} label="Session Summary" />
            <View style={s.summaryBox}>
              <Ionicons name="sparkles" size={18} color={colors.blue} />
              <Text style={s.summaryText}>{report.summary_feedback}</Text>
            </View>
          </View>
        )}

        {/* ── 7. Instructor Notes ──────────────────────────────────────── */}
        {!!(report.instructor_notes?.trim() || report.instructor_feedback?.trim()) && (
          <View style={[card.base, s.instructorNotesCard]}>
            <SectionHeader icon="📝" iconBg={tint.orange.bg} label="Instructor Notes" />
            <Text
              style={s.instructorNotesText}
              numberOfLines={notesExpanded ? undefined : 3}
            >
              "{(report.instructor_notes?.trim() || report.instructor_feedback?.trim())}"
            </Text>
            {(report.instructor_notes?.trim() || report.instructor_feedback?.trim() || "").length > 150 && (
              <Pressable onPress={() => setNotesExpanded(!notesExpanded)}>
                <Text style={s.readMoreText}>{notesExpanded ? "Show less" : "Read more"}</Text>
              </Pressable>
            )}
            {report.instructor && (
              <Text style={s.instructorName}>— {report.instructor}</Text>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <RouteMapModal
        visible={showRouteMap}
        onClose={() => setShowRouteMap(false)}
        sessionId={sessionId ?? ""}
        windows={report?.windows}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  // ── Route button
  routeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.darkBg,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
  },
  routeBtnIcon: { fontSize: 16 },
  routeBtnText: { fontSize: 13, fontFamily: fonts.extrabold, color: "#FFFFFF" },

  // ── Back button
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.text,
  },

  // ── Metrics strip
  metricsStrip: {
    flexDirection: "row",
    gap: 16,
    alignItems: "stretch",
  },
  scoreRingCard: {
    ...card.base,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  metricsRight: {
    flex: 1,
    gap: 8,
  },

  // ── Navigation arrows
  navArrows: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  arrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.text,
    minWidth: 40,
    textAlign: "center",
  },

  // ── Filter row
  filterRow: {
    marginBottom: 14,
  },

  // ── Timeline Grid
  timelineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  windowBlock: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  windowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  windowBlockNum: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  emptyTimeline: {
    fontSize: 13,
    color: colors.subtext,
    fontStyle: "italic",
    paddingVertical: 12,
  },

  // ── Page controls
  pageControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  pageBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pageLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.subtext,
    minWidth: 90,
    textAlign: "center",
  },

  // ── Time axis
  timeAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 2,
  },
  timeAxisLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },

  // ── Feedback Panel
  feedbackPanel: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: space.card,
    borderLeftWidth: 4,
    ...shadow.card,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  feedbackHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  feedbackTime: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.subtext,
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.icon,
  },
  severityText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },

  // ── Alert cause
  alertCauseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.amberBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginBottom: 12,
  },
  alertCauseText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.amberDark,
  },

  // ── Trigger features
  triggerSection: {
    marginBottom: 12,
  },
  triggerLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.subtext,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  triggerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  triggerCard: {
    flex: 1,
    minWidth: 130,
    maxWidth: 220,
    backgroundColor: colors.pageBg,
    borderRadius: radius.md,
    padding: space.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  triggerFeatureName: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.subtext,
    marginBottom: 4,
  },
  triggerFeatureValue: {
    fontSize: 16,
    fontFamily: fonts.extrabold,
    color: colors.text,
  },
  triggerFeatureUnit: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.muted,
  },

  // ── LLM Feedback
  llmFeedback: {
    backgroundColor: colors.blueLight,
    borderRadius: radius.md,
    padding: 14,
  },
  llmFeedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  llmFeedbackTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.blue,
  },
  llmFeedbackText: {
    fontSize: 13.5,
    fontFamily: fonts.regular,
    color: colors.text,
    lineHeight: 20,
  },

  // ── No selection
  noSelectionCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  noSelectionText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.muted,
    textAlign: "center",
  },

  // ── Summary box
  summaryBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.blueLight,
    borderRadius: radius.md,
    padding: 14,
    alignItems: "flex-start",
  },
  summaryText: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: fonts.regular,
    color: colors.text,
    lineHeight: 20,
  },

  // ── Retry
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
  },
  retryBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },

  // ── Pending state
  pendingCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 32,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.borderFaint ?? colors.border,
    gap: 10,
  },
  pendingIcon: { fontSize: 40 },
  pendingTitle: {
    fontSize: 18,
    fontFamily: fonts.extrabold,
    color: colors.text,
    marginTop: 4,
  },
  pendingText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.subtext,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Instructor notes
  instructorNotesCard: {
    gap: 10,
  },
  instructorNotesText: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 21,
    fontStyle: "italic",
  },
  instructorName: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.subtext,
    marginTop: 4,
  },
  readMoreText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.blue,
  },
});
