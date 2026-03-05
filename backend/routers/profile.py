"""
routers/profile.py
Instructor profile management and user settings.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.database import instructor_profiles_col, settings_col
from app.models import SettingsUpdate
from app.permissions import get_current_user, require_role
from app.utils import to_jsonable

router = APIRouter(tags=["Profile & Settings"])


@router.get("/instructor/profile/me")
def get_my_instructor_profile(current_user=Depends(require_role("instructor"))):
    profile = instructor_profiles_col.find_one(
        {"instructor_id": current_user["instructor_id"]}, {"_id": 0}
    )
    return to_jsonable(profile) if profile else {}


@router.patch("/instructor/profile/me")
def update_my_instructor_profile(body: dict, current_user=Depends(require_role("instructor"))):
    """Update instructor profile fields (bio, specialties, price, etc.)."""
    allowed_fields = {
        "bio", "specialties", "experience_years", "price_per_session",
        "currency", "vehicle", "languages", "location_area",
    }
    update = {k: v for k, v in body.items() if k in allowed_fields}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    instructor_profiles_col.update_one(
        {"instructor_id": current_user["instructor_id"]},
        {"$set": update},
    )
    return {"status": "ok"}


@router.get("/settings/me")
def get_settings(current_user=Depends(get_current_user)):
    s = settings_col.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    return s or {"user_id": current_user["user_id"], "profile": {}, "notifications": {}, "preferences": {}}


@router.patch("/settings/me")
def update_settings(body: SettingsUpdate, current_user=Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    settings_col.update_one({"user_id": current_user["user_id"]}, {"$set": update}, upsert=True)
    return {"status": "ok"}
