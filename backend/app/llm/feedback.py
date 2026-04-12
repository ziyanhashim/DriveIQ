"""
LLM feedback generation for driving sessions.

Ported from ml-model/notebooks/05_LLM_Models.ipynb.
Uses OpenAI gpt-4o-mini via dspydantic for structured output.

Two levels:
  - LLM #1: Per-window feedback (abnormal windows only)
  - LLM #2: Session-level feedback (student + instructor)
"""

import json
import logging
import os
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.config import OPENAI_API_KEY

logger = logging.getLogger("driveiq.llm")

# ── Pydantic models for structured LLM output ────────────────────────────────

class WindowFeedback(BaseModel):
    model_config = ConfigDict(extra="forbid")
    window_key: str
    feedback: str = Field(
        ...,
        description="2-4 sentences, single paragraph, evidence-based, no headings.",
    )


class SessionFeedback(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_key: str
    student_feedback: str = Field(
        ...,
        description=(
            "6-8 sentences in a single paragraph addressed to the driver ('you'). "
            "Be specific: reference exact alert types observed, their frequency, "
            "severity patterns, and provide concrete actionable improvement steps."
        ),
    )
    instructor_feedback: str = Field(
        ...,
        description=(
            "6-8 sentences in a single paragraph addressed to the instructor ('the student'). "
            "Reference specific driving patterns observed, risk areas, severity trends, "
            "and provide targeted teaching recommendations."
        ),
    )


# ── Prompter setup (lazy init) ───────────────────────────────────────────────

_window_prompter = None
_session_prompter = None


def _get_window_prompter():
    global _window_prompter
    if _window_prompter is None:
        os.environ.setdefault("OPENAI_API_KEY", OPENAI_API_KEY)
        from dspydantic import Prompter
        _window_prompter = Prompter(model=WindowFeedback, model_id="openai/gpt-4o-mini")
    return _window_prompter


def _get_session_prompter():
    global _session_prompter
    if _session_prompter is None:
        os.environ.setdefault("OPENAI_API_KEY", OPENAI_API_KEY)
        from dspydantic import Prompter
        _session_prompter = Prompter(model=SessionFeedback, model_id="openai/gpt-4o-mini")
    return _session_prompter


# ── LLM #1: Window-level feedback ────────────────────────────────────────────

def _build_window_prompt(window: Dict[str, Any], window_key: str) -> str:
    feats = json.dumps(window.get("trigger_features", []), ensure_ascii=False)
    return (
        "You are a professional driving mentor.\n"
        "Write concise, evidence-based feedback for the driver about ONE 4-minute window.\n"
        "Rules:\n"
        "  - Use ONLY the alert_cause and trigger_features listed below as evidence.\n"
        "  - Do NOT invent numbers, speeds, or behaviours not present in the features.\n"
        "  - 2-4 sentences, single paragraph, no headings, no lists.\n\n"
        f"window_key:       {window_key}\n"
        f"predicted_label:  {window.get('predicted_label', 'Unknown')}\n"
        f"alert_cause:      {window.get('alert_cause', 'None')}\n"
        f"severity:         {window.get('severity', 0):.3f}\n"
        f"trigger_features: {feats}\n"
    )


def generate_window_feedback(
    windows: List[Dict[str, Any]],
    road_type: str,
    session_id: str = "",
) -> List[Dict[str, Any]]:
    """
    Generate LLM feedback for each abnormal window.
    Normal windows get no feedback (None).
    Returns the same windows list with 'feedback' field added.
    """
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — skipping window feedback generation")
        return windows

    prompter = _get_window_prompter()
    road_tag = "Motorway" if road_type.lower() in ("motor", "motorway", "highway") else "Secondary"

    for w in windows:
        label = w.get("predicted_label", "Normal")

        if label in ("Aggressive", "Drowsy"):
            window_key = f"{road_tag}_s{session_id}_w{w.get('window_id', 0)}"
            try:
                result = prompter.run(_build_window_prompt(w, window_key))
                w["feedback"] = result.feedback
            except Exception as e:
                logger.error(f"LLM window feedback failed for {window_key}: {e}")
                w["feedback"] = None
        else:
            w["feedback"] = None

    return windows


# ── LLM #2: Session-level feedback ───────────────────────────────────────────

def _tone_for_score(score: float) -> str:
    if score >= 80:
        return "positive and encouraging - highlight strengths, minor notes only"
    elif score >= 60:
        return "balanced - acknowledge positives, clearly state areas for improvement"
    elif score >= 40:
        return "constructive but urgent - emphasise specific safety issues"
    else:
        return "serious and direct - significant safety concerns, clear corrective actions required"


def _build_session_prompt(
    session_key: str,
    road_type: str,
    performance_score: float,
    total_windows: int,
    abnormal_count: int,
    cause_distribution: str,
    severity_stats: str,
    window_summaries: str,
    temporal_pattern: str,
) -> str:
    pct_abnormal = (
        round(100 * abnormal_count / total_windows, 1) if total_windows > 0 else 0
    )

    return (
        "You are DriveIQ, an AI driving mentor.\n"
        "Generate TWO detailed feedback paragraphs for a completed driving session.\n"
        f"Tone: {_tone_for_score(performance_score)}.\n\n"
        f"session_key:       {session_key}\n"
        f"road_type:         {road_type}\n"
        f"performance_score: {performance_score:.1f}/100\n"
        f"total_windows:     {total_windows}\n"
        f"abnormal_windows:  {abnormal_count} ({pct_abnormal}%)\n\n"
        f"Alert cause distribution:\n{cause_distribution}\n\n"
        f"Severity statistics: {severity_stats}\n\n"
        f"Temporal pattern: {temporal_pattern}\n\n"
        f"Abnormal window details:\n{window_summaries}\n\n"
        "Rules:\n"
        "  - student_feedback: 6-8 sentences, speak directly to the driver ('you').\n"
        "    Reference specific alert types, their frequency, severity patterns,\n"
        "    and provide concrete actionable improvement recommendations.\n"
        "  - instructor_feedback: 6-8 sentences, speak to the instructor ('the student').\n"
        "    Reference specific driving patterns, risk areas, and teaching recommendations.\n"
        "  - Use the window details above as evidence. Do not invent data.\n"
        "  - No bullet points or headings inside the paragraphs.\n"
    )


def generate_session_feedback(
    windows: List[Dict[str, Any]],
    road_type: str,
    performance_score: float,
    session_id: str = "",
) -> Dict[str, Optional[str]]:
    """
    Generate session-level student and instructor feedback.
    Returns {"summary_feedback": str, "instructor_feedback": str}.
    """
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — skipping session feedback generation")
        return {"summary_feedback": None, "instructor_feedback": None}

    road_tag = "Motorway" if road_type.lower() in ("motor", "motorway", "highway") else "Secondary"

    # Aggregate stats
    total_windows = len(windows)
    abnormal_windows = [
        w for w in windows if w.get("predicted_label") in ("Aggressive", "Drowsy")
    ]
    abnormal_count = len(abnormal_windows)

    # Full cause distribution (not just top 3)
    causes = Counter(
        w.get("alert_cause")
        for w in windows
        if w.get("alert_cause") and w.get("alert_cause") not in ("None", "No alert")
    )
    cause_distribution = "\n".join(
        f"  - {cause}: {count} window(s)" for cause, count in causes.most_common()
    ) or "  No alerts recorded"

    # Severity statistics for abnormal windows
    severities = [w.get("severity", 0) for w in abnormal_windows if w.get("severity")]
    if severities:
        severity_stats = (
            f"min={min(severities):.2f}, max={max(severities):.2f}, "
            f"avg={sum(severities)/len(severities):.2f} (scale 0-10)"
        )
    else:
        severity_stats = "No severity data"

    # Condensed summaries of each abnormal window (include window-level LLM feedback)
    summaries = []
    for w in abnormal_windows[:10]:  # Cap at 10 to avoid token overflow
        wid = w.get("window_id", "?")
        label = w.get("predicted_label", "Unknown")
        cause = w.get("alert_cause", "None")
        sev = w.get("severity", 0)
        fb = w.get("feedback") or ""
        fb_short = fb[:200] + "..." if len(fb) > 200 else fb
        summaries.append(
            f"  Window {wid}: {label}, cause={cause}, severity={sev:.2f}"
            + (f" — \"{fb_short}\"" if fb_short else "")
        )
    window_summaries = "\n".join(summaries) or "  No abnormal windows"

    # Temporal pattern: were issues early, middle, or late?
    if abnormal_windows and total_windows > 1:
        positions = [w.get("window_id", 0) / max(total_windows - 1, 1) for w in abnormal_windows]
        avg_pos = sum(positions) / len(positions)
        if avg_pos < 0.35:
            temporal_pattern = "Issues concentrated in the first third of the session"
        elif avg_pos > 0.65:
            temporal_pattern = "Issues concentrated in the final third of the session"
        else:
            temporal_pattern = "Issues distributed throughout the session"
    else:
        temporal_pattern = "Insufficient data for temporal analysis"

    session_key = f"{road_tag}_s{session_id}"

    try:
        prompter = _get_session_prompter()
        result = prompter.run(
            _build_session_prompt(
                session_key=session_key,
                road_type=road_tag,
                performance_score=performance_score,
                total_windows=total_windows,
                abnormal_count=abnormal_count,
                cause_distribution=cause_distribution,
                severity_stats=severity_stats,
                window_summaries=window_summaries,
                temporal_pattern=temporal_pattern,
            )
        )
        return {
            "summary_feedback": result.student_feedback,
            "instructor_feedback": result.instructor_feedback,
        }
    except Exception as e:
        logger.error(f"LLM session feedback failed for {session_key}: {e}")
        return {"summary_feedback": None, "instructor_feedback": None}
