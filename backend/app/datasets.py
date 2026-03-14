"""
app/datasets.py
Helpers for resolving and picking simulation CSV datasets.
"""
from __future__ import annotations

import random
from pathlib import Path
from typing import List

from fastapi import HTTPException

from app.config import DATASETS_ROOT


def resolve_datasets_root() -> Path:
    base = Path(DATASETS_ROOT) if DATASETS_ROOT else (Path.cwd() / "datasets")
    return base.resolve()


def list_all_csvs() -> List[Path]:
    root = resolve_datasets_root()
    if not root.exists():
        return []
    return [p for p in root.rglob("*.csv") if p.is_file()]


def pick_csv_for_simulation(road_type: str) -> Path:
    csvs = list_all_csvs()
    if not csvs:
        raise HTTPException(
            status_code=500,
            detail=f"No CSV datasets found under {str(resolve_datasets_root())}",
        )
    road = (road_type or "").strip().lower()
    wants_motor = road in ["motor", "motorway", "highway"]
    motor_like = [p for p in csvs if "motor" in p.name.lower() or "highway" in p.name.lower()]
    non_motor_like = [p for p in csvs if p not in motor_like]
    pool = motor_like if (wants_motor and motor_like) else (non_motor_like if non_motor_like else csvs)
    return random.choice(pool)
