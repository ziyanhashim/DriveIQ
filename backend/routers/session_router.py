"""
DriveIQ - Session Processing Router (Sync PyMongo)
====================================================
Integrates Lorna's ML pipeline with the existing backend.

Uses existing collections from database.py:
  - sessions_col  → session metadata + ML summary
  - results_col   → full ML output (all windows)

Add to your main FastAPI app:
    from routers.session_router import router as session_router
    app.include_router(session_router, prefix="/api/sessions", tags=["Sessions"])
"""

import os
import sys
import io
import json
import uuid
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

# ── Database (sync PyMongo) ─────────────────────────────────────
from app.database import sessions_col, results_col

# ── ML Pipeline ─────────────────────────────────────────────────
# Add ml-model/src to sys.path so we can import Lorna's code.
# Adjust the number of ".." based on your folder structure:
#   backend/routers/session_router.py  →  ../../ml-model/src
ML_SRC_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "ml-model", "src")
)
if ML_SRC_PATH not in sys.path:
    sys.path.insert(0, ML_SRC_PATH)

from knn_alerts_inference import run_full_knn_pipeline

logger = logging.getLogger("driveiq.sessions")

router = APIRouter()


# ══════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════

def _generate_session_id() -> str:
    """Generate a unique session ID."""
    return str(uuid.uuid4())


def _build_window_summary(windows: list) -> dict:
    """
    Count how many windows fall into each predicted_label category.
    Used for the session-level overview on the dashboard.
    """
    counts = {"total": len(windows), "normal": 0, "aggressive": 0, "drowsy": 0}
    for w in windows:
        label = w.get("predicted_label", "").lower()
        if label in counts:
            counts[label] += 1
    return counts


# ══════════════════════════════════════════════════════════════════
# ENDPOINT 1: Upload sensor JSON + immediately process
# ══════════════════════════════════════════════════════════════════

@router.post("/upload-and-process")
def upload_and_process(
    file: UploadFile = File(...),
    trainee_id: Optional[str] = Form(None),
    instructor_id: Optional[str] = Form(None),
    booking_id: Optional[str] = Form(None),
):
    """
    Upload a sensor JSON file (output of create_test_session_json.py),
    run the full ML pipeline, and store everything in MongoDB.

    This is the main endpoint for processing a driving session.
    """

    # ── 1. Parse the uploaded JSON ──────────────────────────────
    try:
        content = file.file.read()
        sensor_json = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Validate required keys
    required_keys = ["road_type", "gps", "accelerometer", "lane", "vehicle", "osm"]
    missing = [k for k in required_keys if k not in sensor_json]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required keys: {missing}")

    road_type = sensor_json["road_type"]
    session_id = _generate_session_id()

    # Overwrite session_id in the JSON so the pipeline uses our generated one
    sensor_json["session_id"] = session_id

    # ── 2. Create session record (status = processing) ──────────
    session_doc = {
        "session_id": session_id,
        "trainee_id": trainee_id,
        "instructor_id": instructor_id,
        "booking_id": booking_id,
        "road_type": road_type,
        "status": "processing",
        "created_at": datetime.utcnow(),
    }
    sessions_col.insert_one(session_doc)

    # ── 3. Run the ML pipeline ──────────────────────────────────
    try:
        logger.info(f"Processing session {session_id} ({road_type})...")
        ml_result = run_full_knn_pipeline(sensor_json)
        logger.info(
            f"Session {session_id} done: "
            f"{ml_result['session_summary']['total_windows']} windows, "
            f"{ml_result['session_summary']['total_alerts']} alerts"
        )
    except Exception as e:
        # Mark session as failed
        sessions_col.update_one(
            {"session_id": session_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )
        logger.error(f"Pipeline failed for {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"ML pipeline failed: {str(e)}")

    summary = ml_result["session_summary"]
    windows = ml_result["windows"]

    # ── 4. Store full ML results in results_col ─────────────────
    result_doc = {
        "session_id": session_id,
        "trainee_id": trainee_id,
        "instructor_id": instructor_id,
        "booking_id": booking_id,
        "road_type": road_type,
        "session_summary": summary,
        "windows": windows,
        "created_at": datetime.utcnow(),
    }
    results_col.insert_one(result_doc)

    # ── 5. Update session record with summary ───────────────────
    window_summary = _build_window_summary(windows)

    sessions_col.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": "processed",
            "processed_at": datetime.utcnow(),
            "performance_score": round(100 - summary["session_risk_score"], 2),
            "session_risk_score": summary["session_risk_score"],
            "dominant_alert": summary["dominant_alert"],
            "average_severity": summary["average_severity"],
            "max_severity": summary["max_severity"],
            "total_windows": summary["total_windows"],
            "total_alerts": summary["total_alerts"],
            "window_summary": window_summary,
        }}
    )

    # ── 6. Return response ──────────────────────────────────────
    return {
        "session_id": session_id,
        "status": "processed",
        "road_type": road_type,
        "session_summary": summary,
        "window_summary": window_summary,
        "total_windows": summary["total_windows"],
    }


# ══════════════════════════════════════════════════════════════════
# ENDPOINT 2: Upload raw .txt sensor files + process
# ══════════════════════════════════════════════════════════════════

@router.post("/upload-files-and-process")
def upload_files_and_process(
    road_type: str = Form(..., description="Motorway or Secondary"),
    gps_file: UploadFile = File(...),
    accelerometer_file: UploadFile = File(...),
    lane_file: UploadFile = File(...),
    vehicle_file: UploadFile = File(...),
    osm_file: UploadFile = File(...),
    trainee_id: Optional[str] = Form(None),
    instructor_id: Optional[str] = Form(None),
    booking_id: Optional[str] = Form(None),
):
    """
    Upload the 5 raw UAH-DriveSet .txt files directly.
    Parses them into the sensor JSON format, then runs the ML pipeline.
    """
    import pandas as pd

    try:
        def _read_sensor(upload_file):
            content = upload_file.file.read().decode("utf-8")
            return pd.read_csv(
                io.StringIO(content), sep=r"\s+", header=None
            ).to_dict(orient="records")

        sensor_json = {
            "session_id": _generate_session_id(),
            "road_type": road_type.strip().title(),
            "gps": _read_sensor(gps_file),
            "accelerometer": _read_sensor(accelerometer_file),
            "lane": _read_sensor(lane_file),
            "vehicle": _read_sensor(vehicle_file),
            "osm": _read_sensor(osm_file),
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse sensor files: {str(e)}")

    # Reuse the JSON upload logic
    json_bytes = json.dumps(sensor_json).encode("utf-8")

    class FakeUpload:
        def __init__(self, data):
            self.file = io.BytesIO(data)

    return upload_and_process(
        file=FakeUpload(json_bytes),
        trainee_id=trainee_id,
        instructor_id=instructor_id,
        booking_id=booking_id,
    )


# ══════════════════════════════════════════════════════════════════
# ENDPOINT 3: Get full session results (for dashboard)
# ══════════════════════════════════════════════════════════════════

@router.get("/results/{session_id}")
def get_session_results(session_id: str):
    """
    Get the full ML results for a session.
    Frontend dashboard calls this to display:
      - session_summary (risk score, dominant alert, severity)
      - windows (per-window alerts, trigger features, severity)
    """

    result = results_col.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )

    if not result:
        # Check if session exists but hasn't been processed
        session = sessions_col.find_one({"session_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        elif session.get("status") == "processing":
            raise HTTPException(status_code=202, detail="Session is still being processed")
        elif session.get("status") == "failed":
            raise HTTPException(
                status_code=500,
                detail=f"Processing failed: {session.get('error', 'Unknown error')}"
            )
        raise HTTPException(status_code=404, detail="Results not found for this session")

    return result


# ══════════════════════════════════════════════════════════════════
# ENDPOINT 4: Get session timeline (for interactive window view)
# ══════════════════════════════════════════════════════════════════

@router.get("/timeline/{session_id}")
def get_session_timeline(session_id: str):
    """
    Get the window timeline for a session with computed time fields.
    Each window gets start_time, end_time, and is_flagged for the
    interactive timeline component.
    """

    result = results_col.find_one(
        {"session_id": session_id},
        {"_id": 0, "windows": 1, "road_type": 1}
    )

    if not result:
        raise HTTPException(status_code=404, detail="Results not found")

    windows = result.get("windows", [])
    road_type = result.get("road_type", "Motorway")

    # Each window = 4 minutes (2400 timesteps at 10Hz = 240 seconds = 4 min)
    window_duration_min = 4

    timeline = []
    for w in windows:
        wid = w["window_id"]
        timeline.append({
            **w,
            "start_time": f"{wid * window_duration_min} min",
            "end_time": f"{(wid + 1) * window_duration_min} min",
            "start_minutes": wid * window_duration_min,
            "end_minutes": (wid + 1) * window_duration_min,
            "is_flagged": w["alert"] == "Abnormal",
        })

    return {
        "session_id": session_id,
        "road_type": road_type,
        "total_windows": len(timeline),
        "window_duration_minutes": window_duration_min,
        "timeline": timeline,
    }


# ══════════════════════════════════════════════════════════════════
# ENDPOINT 5: List sessions for a trainee
# ══════════════════════════════════════════════════════════════════

@router.get("/trainee/{trainee_id}")
def get_trainee_sessions(trainee_id: str):
    """
    Get all sessions for a trainee (learner), sorted newest first.
    Dashboard session history list.
    """

    sessions = list(
        sessions_col.find(
            {"trainee_id": trainee_id},
            {
                "_id": 0,
                "session_id": 1,
                "road_type": 1,
                "status": 1,
                "performance_score": 1,
                "session_risk_score": 1,
                "dominant_alert": 1,
                "total_windows": 1,
                "total_alerts": 1,
                "window_summary": 1,
                "created_at": 1,
                "processed_at": 1,
            }
        ).sort("created_at", -1).limit(50)
    )

    return {"trainee_id": trainee_id, "sessions": sessions}


# ══════════════════════════════════════════════════════════════════
# ENDPOINT 6: List sessions for an instructor
# ══════════════════════════════════════════════════════════════════

@router.get("/instructor/{instructor_id}")
def get_instructor_sessions(instructor_id: str):
    """
    Get all sessions linked to an instructor, sorted newest first.
    Instructor dashboard — view students' session results.
    """

    sessions = list(
        sessions_col.find(
            {"instructor_id": instructor_id},
            {
                "_id": 0,
                "session_id": 1,
                "trainee_id": 1,
                "road_type": 1,
                "status": 1,
                "performance_score": 1,
                "session_risk_score": 1,
                "dominant_alert": 1,
                "total_windows": 1,
                "total_alerts": 1,
                "window_summary": 1,
                "created_at": 1,
                "processed_at": 1,
            }
        ).sort("created_at", -1).limit(50)
    )

    return {"instructor_id": instructor_id, "sessions": sessions}


# ══════════════════════════════════════════════════════════════════
# ENDPOINT 7: Get single session metadata (summary only, no windows)
# ══════════════════════════════════════════════════════════════════

@router.get("/{session_id}")
def get_session(session_id: str):
    """
    Get session metadata and ML summary (without full window data).
    Lighter than /results — good for session cards and list views.
    """

    session = sessions_col.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session
