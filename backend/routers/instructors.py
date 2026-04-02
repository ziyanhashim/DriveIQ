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
    """Get open time slots for an instructor. Auto-generates recurring weekly slots."""
    from datetime import datetime

    today = now_utc()
    today_str = today.strftime("%Y-%m-%d")
    future = today + timedelta(days=14)
    future_str = future.strftime("%Y-%m-%d")

    start = date_from or today_str
    end = date_to or future_str

    # Auto-generate weekly recurring slots for dates that don't have any yet.
    # Uses the instructor's existing slots as a weekly template (hours from any past/present week).
    _ensure_recurring_slots(instructor_id, start, end)

    query: dict = {
        "instructor_id": instructor_id,
        "status": {"$in": ["open", "booked"]},
        "date": {"$gte": start, "$lte": end},
    }

    slots = list(
        availability_col.find(query, {"_id": 0})
        .sort([("date", 1), ("start_time", 1)])
    )

    return to_jsonable(slots)


def _ensure_recurring_slots(instructor_id: str, date_from: str, date_to: str):
    """
    Auto-generate weekly recurring slots for an instructor.
    Looks at what hours this instructor typically works (from existing slots),
    then creates 'open' slots for any future dates that don't have slots yet.
    """
    from datetime import datetime

    # Get the instructor's typical weekly pattern from existing slots
    all_slots = list(availability_col.find(
        {"instructor_id": instructor_id},
        {"date": 1, "start_time": 1, "duration_min": 1},
    ))

    if not all_slots:
        return  # No template to work from

    # Build a pattern: for each weekday (0=Mon..6=Sun), what hours are typical?
    weekday_hours: dict[int, set[int]] = {}
    for s in all_slots:
        try:
            dt = datetime.fromisoformat(s["start_time"])
            wd = dt.weekday()
            weekday_hours.setdefault(wd, set()).add(dt.hour)
        except (ValueError, KeyError):
            continue

    if not weekday_hours:
        return

    # Get dates that already have slots in the requested range
    existing_dates = set()
    for s in all_slots:
        d = s.get("date", "")
        if date_from <= d <= date_to:
            existing_dates.add(d)

    # Generate slots for missing dates
    from datetime import timedelta
    current = datetime.strptime(date_from, "%Y-%m-%d")
    end = datetime.strptime(date_to, "%Y-%m-%d")
    today = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)

    new_slots = []
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        wd = current.weekday()

        # Only generate for future dates that don't already have slots
        if current >= today and date_str not in existing_dates and wd in weekday_hours:
            for hour in sorted(weekday_hours[wd]):
                slot_start = current.replace(hour=hour, minute=0, second=0, microsecond=0)
                duration = 60
                new_slots.append({
                    "slot_id": uuid.uuid4().hex,
                    "instructor_id": instructor_id,
                    "date": date_str,
                    "start_time": slot_start.isoformat(),
                    "end_time": (slot_start + timedelta(minutes=duration)).isoformat(),
                    "duration_min": duration,
                    "status": "open",
                    "booked_by": None,
                    "created_at": now_utc(),
                })
        current += timedelta(days=1)

    if new_slots:
        availability_col.insert_many(new_slots)


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
