"""
Watchlist Router - a persistent, account-backed list of saved components.

Replaces the old ephemeral "add to compare" selection. Guests keep a local list
in the browser; once signed in, the list is mirrored here and survives across
devices. Built to work against both Supabase and the in-memory fake DB.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client
from ..database import get_db
from ..utils.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Watchlist"])


class MergeRequest(BaseModel):
    ids: List[int]


def _watch_ids(db: Client, user_id: int) -> List[int]:
    rows = db.table("watchlist").select("component_id").eq("user_id", user_id).execute().data or []
    return [r["component_id"] for r in rows]


def _components_by_ids(db: Client, ids: List[int]) -> List[dict]:
    if not ids:
        return []
    res = (
        db.table("components")
        .select("*, category:categories(*), prices:component_prices(*, vendor:vendors(*))")
        .in_("id", ids)
        .execute()
    )
    return res.data or []


@router.get("/watchlist")
def get_watchlist(user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """The signed-in user's saved components, fully enriched with prices."""
    ids = _watch_ids(db, user["id"])
    return _components_by_ids(db, ids)


# Declared before /watchlist/{component_id} so "merge" isn't parsed as an id.
@router.post("/watchlist/merge")
def merge_watchlist(body: MergeRequest, user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Merge a guest's local watchlist into the account on sign-in, then return
    the full enriched list. Existing entries are left untouched (idempotent)."""
    have = set(_watch_ids(db, user["id"]))
    for cid in body.ids:
        if cid in have:
            continue
        comp = db.table("components").select("id").eq("id", cid).maybe_single().execute()
        if comp and comp.data:
            db.table("watchlist").insert({"user_id": user["id"], "component_id": cid}).execute()
            have.add(cid)
    return _components_by_ids(db, list(have))


@router.post("/watchlist/{component_id}", status_code=201)
def add_to_watchlist(component_id: int, user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Add a component to the watchlist (idempotent)."""
    comp = db.table("components").select("id").eq("id", component_id).maybe_single().execute()
    if not (comp and comp.data):
        raise HTTPException(status_code=404, detail="Component not found")
    existing = (
        db.table("watchlist").select("id")
        .eq("user_id", user["id"]).eq("component_id", component_id).execute()
    )
    if not existing.data:
        db.table("watchlist").insert({"user_id": user["id"], "component_id": component_id}).execute()
    return {"saved": True, "component_id": component_id}


@router.delete("/watchlist/{component_id}")
def remove_from_watchlist(component_id: int, user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Remove a component from the watchlist."""
    db.table("watchlist").delete().eq("user_id", user["id"]).eq("component_id", component_id).execute()
    return {"saved": False, "component_id": component_id}
