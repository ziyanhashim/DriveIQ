"""
routers/instructors.py
Instructor browsing (public) and availability slot management.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.database import availability_col, instructor_profiles_col, reviews_col
from app.models import AddSlotsRequest
from app.permissions import get_current_user, require_role
from app.utils import now_utc, to_jsonable

router = APIRouter(tags=["Instructors"])


# ── Browse ────────────────────────────────────────────────────────────────────

@router.get("/instructors")
def list_instructors(
    specialty: Optional[str] = None,
    location: Optional[str] = None,
    min_rating: Optional[float] = None,
    sort_by: str = "rating",
    current_user=Depends(get_current_user),
):
    """Browse all active instructors with optional filters."""
    query: dict = {"active": True}

    if specialty:
        query["specialties"] = {"$regex": specialty, "$options": "i"}
    if location:
        query["location_area"] = {"$regex": location, "$options": "i"}
    if min_rating:
        query["rating"] = {"$gte": min_rating}

    sort_field = "rating" if sort_by == "rating" else "price_per_session"
    sort_dir = -1 if sort_by == "rating" else 1

    profiles = list(
        instructor_profiles_col.find(query, {"_id": 0})
        .sort(sort_field, sort_dir)
        .limit(50)
    )

    return to_jsonable(profiles)


@router.get("/instructors/{instructor_id}")
def get_instructor_profile(instructor_id: str, current_user=Depends(get_current_user)):
    """Get full instructor profile with recent reviews."""
    profile = instructor_profiles_col.find_one(
        {"instructor_id": instructor_id}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Instructor not found")

    recent_reviews = list(
        reviews_col.find({"instructor_id": instructor_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(10)
    )

    return {
        "profile": to_jsonable(profile),
        "reviews": to_jsonable(recent_reviews),
    }


# ── Availability ──────────────────────────────────────────────────────────────

@router.get("/instructors/{instructor_id}/availability")
def get_instructor_availability(
    instructor_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """Get open time slots for an instructor."""
    query: dict = {"instructor_id": instructor_id, "status": {"$in": ["open", "booked"]}}

    if date_from:
        query["date"] = query.get("date", {})
        query["date"]["$gte"] = date_from
    if date_to:
        query.setdefault("date", {})["$lte"] = date_to

    if not date_from and not date_to:
        today = now_utc().strftime("%Y-%m-%d")
        future = (now_utc() + timedelta(days=14)).strftime("%Y-%m-%d")
        query["date"] = {"$gte": today, "$lte": future}

    slots = list(
        availability_col.find(query, {"_id": 0})
        .sort([("date", 1), ("start_time", 1)])
    )

    return to_jsonable(slots)


@router.post("/availability")
def add_availability_slots(body: AddSlotsRequest, current_user=Depends(require_role("instructor"))):
    """Instructor publishes time slots."""
    instructor_id = current_user["instructor_id"]
    created = []

    for slot in body.slots:
        date_str = slot.get("date")
        start_hour = slot.get("start_hour", 10)
        duration = slot.get("duration_min", 60)

        if not date_str:
            continue

        try:
            from datetime import datetime
            dt = datetime.fromisoformat(f"{date_str}T{start_hour:02d}:00:00")
        except (ValueError, TypeError):
            continue

        slot_id = uuid.uuid4().hex
        doc = {
            "slot_id": slot_id,
            "instructor_id": instructor_id,
            "date": date_str,
            "start_time": dt.isoformat(),
            "end_time": (dt + timedelta(minutes=duration)).isoformat(),
            "duration_min": duration,
            "status": "open",
            "booked_by": None,
            "created_at": now_utc(),
        }
        availability_col.insert_one(doc)
        created.append(slot_id)

    return {"status": "ok", "slots_created": len(created), "slot_ids": created}


@router.get("/availability/me")
def my_availability(current_user=Depends(require_role("instructor"))):
    """Instructor views their own slots."""
    instructor_id = current_user["instructor_id"]
    today = now_utc().strftime("%Y-%m-%d")

    slots = list(
        availability_col.find(
            {"instructor_id": instructor_id, "date": {"$gte": today}},
            {"_id": 0},
        ).sort([("date", 1), ("start_time", 1)])
    )

    return to_jsonable(slots)


@router.delete("/availability/{slot_id}")
def delete_availability_slot(slot_id: str, current_user=Depends(require_role("instructor"))):
    """Instructor removes an open slot."""
    slot = availability_col.find_one({"slot_id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if slot.get("status") != "open":
        raise HTTPException(status_code=400, detail="Cannot delete a booked slot")

    availability_col.delete_one({"slot_id": slot_id})
    return {"status": "ok"}
