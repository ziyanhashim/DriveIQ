from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException


def now_utc() -> datetime:
    return datetime.utcnow()


def oid(x: str) -> ObjectId:
    try:
        return ObjectId(x)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


def to_jsonable(obj):
    """
    Converts MongoDB docs (ObjectId, datetime) into JSON-safe values.
    Works for dicts, lists, and nested structures.
    """
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()

    if isinstance(obj, list):
        return [to_jsonable(x) for x in obj]

    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}

    return obj
