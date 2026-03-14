"""
routers/reviews.py
Trainee reviews of instructors.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.database import instructor_profiles_col, reviews_col, sessions_col
from app.models import ReviewCreateRequest
from app.permissions import get_current_user, require_role
from app.utils import now_utc, to_jsonable

router = APIRouter(tags=["Reviews"])


@router.post("/reviews")
def create_review(body: ReviewCreateRequest, current_user=Depends(require_role("trainee"))):
    """Trainee leaves a review after a completed session."""
    session = sessions_col.find_one({"session_id": body.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("trainee_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Session not completed yet")

    existing = reviews_col.find_one({
        "session_id": body.session_id, "trainee_id": current_user["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed this session")

    instructor_id = session["instructor_id"]
    review_id = uuid.uuid4().hex

    reviews_col.insert_one({
        "review_id": review_id,
        "instructor_id": instructor_id,
        "session_id": body.session_id,
        "trainee_id": current_user["user_id"],
        "reviewer_name": current_user.get("name", "Anonymous"),
        "rating": body.rating,
        "text": body.text,
        "created_at": now_utc(),
    })

    all_reviews = list(reviews_col.find({"instructor_id": instructor_id}))
    avg_rating = round(sum(r["rating"] for r in all_reviews) / len(all_reviews), 1)
    instructor_profiles_col.update_one(
        {"instructor_id": instructor_id},
        {"$set": {"rating": avg_rating, "total_reviews": len(all_reviews)}},
    )

    return {"status": "ok", "review_id": review_id}


@router.get("/reviews/{instructor_id}")
def get_reviews(instructor_id: str, current_user=Depends(get_current_user)):
    """Get all reviews for an instructor."""
    revs = list(
        reviews_col.find({"instructor_id": instructor_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(50)
    )
    return to_jsonable(revs)
