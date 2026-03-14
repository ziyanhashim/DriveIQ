"""
app/main.py
DriveIQ Backend — application entry point.

Registers all routers and configures middleware.
Business logic lives in routers/ and app/.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import ensure_indexes

app = FastAPI(title="DriveIQ Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

from routers.session_router import router as ml_session_router   # ML upload pipeline
from routers.auth        import router as auth_router
from routers.instructors import router as instructors_router
from routers.bookings    import router as bookings_router
from routers.reviews     import router as reviews_router
from routers.dashboard   import router as dashboard_router
from routers.profile     import router as profile_router
from routers.sessions    import router as sessions_router

app.include_router(ml_session_router, prefix="/api/sessions", tags=["Sessions - ML"])
app.include_router(auth_router)
app.include_router(instructors_router)
app.include_router(bookings_router)
app.include_router(reviews_router)
app.include_router(dashboard_router)
app.include_router(profile_router)
app.include_router(sessions_router)


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    ensure_indexes()
