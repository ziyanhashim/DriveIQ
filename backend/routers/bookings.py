"""
routers/bookings.py
Trainee booking management: book a slot, view bookings, cancel.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.database import availability_col, bookings_col, users_col
from app.models import BookSlotRequest
from app.permissions import get_current_user, require_role
from app.utils import now_utc, to_jsonable

router = APIRouter(tags=["Bookings"])


@router.post("/bookings")
def book_slot(body: BookSlotRequest, current_user=Depends(require_role("trainee"))):
    """Trainee picks an open slot → instant booking."""
    slot = availability_col.find_one({"slot_id": body.slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.get("status") != "open":
        raise HTTPException(status_code=400, detail="Slot is no longer available")

    from datetime import timedelta
    tomorrow_str = (now_utc() + timedelta(days=1)).strftime("%Y-%m-%d")
    if (slot.get("date") or "") < tomorrow_str:
        raise HTTPException(status_code=400, detail="Slots must be booked at least one day in advance")

    trainee_id = current_user["user_id"]
    instructor_id = slot["instructor_id"]
    booking_id = uuid.uuid4().hex

    instructor = users_col.find_one({"instructor_id": instructor_id}, {"name": 1})
    instructor_name = instructor.get("name", "Unknown") if instructor else "Unknown"

    availability_col.update_one(
        {"slot_id": body.slot_id, "status": "open"},
        {"$set": {"status": "booked", "booked_by": trainee_id}},
    )

    bookings_col.insert_one({
        "booking_id": booking_id,
        "trainee_id": trainee_id,
        "instructor_id": instructor_id,
        "slot_id": body.slot_id,
        "slot_date": slot.get("date"),
        "start_time": slot.get("start_time"),
        "end_time": slot.get("end_time"),
        "status": "confirmed",
        "session_id": None,
        "created_at": now_utc(),
    })

    return {
        "status": "ok",
        "booking_id": booking_id,
        "instructor_name": instructor_name,
        "date": slot.get("date"),
        "start_time": slot.get("start_time"),
    }


@router.get("/bookings/me")
def my_bookings(current_user=Depends(get_current_user)):
    """Get user's bookings (works for both roles)."""
    if current_user["role"] == "instructor":
        query = {"instructor_id": current_user["instructor_id"]}
    else:
        query = {"trainee_id": current_user["user_id"]}

    bookings = list(
        bookings_col.find(query, {"_id": 0}).sort("created_at", -1).limit(50)
    )

    for b in bookings:
        if current_user["role"] == "trainee":
            inst = users_col.find_one({"instructor_id": b.get("instructor_id")}, {"name": 1})
            b["instructor_name"] = inst.get("name", "Unknown") if inst else "Unknown"
        else:
            trainee = users_col.find_one({"user_id": b.get("trainee_id")}, {"name": 1})
            b["trainee_name"] = trainee.get("name", "Unknown") if trainee else "Unknown"

    return to_jsonable(bookings)


@router.delete("/bookings/{booking_id}")
def cancel_booking(booking_id: str, current_user=Depends(get_current_user)):
    """Cancel a confirmed booking (frees the slot)."""
    booking = bookings_col.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user["role"] == "trainee" and booking.get("trainee_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user["role"] == "instructor" and booking.get("instructor_id") != current_user.get("instructor_id"):
        raise HTTPException(status_code=403, detail="Forbidden")

    if booking.get("status") not in ("confirmed",):
        raise HTTPException(status_code=400, detail="Cannot cancel this booking")

    if booking.get("slot_id"):
        availability_col.update_one(
            {"slot_id": booking["slot_id"]},
            {"$set": {"status": "open", "booked_by": None}},
        )

    bookings_col.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "cancelled"}},
    )

    return {"status": "ok"}
