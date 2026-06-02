"""
Social Router - public/private builds, community feed, profiles, likes,
favourites, and following. Built to work against both Supabase and the
in-memory fake DB (no PostgREST joins; enrichment is done in Python).
"""
from typing import Optional, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from supabase import Client
from ..database import get_db
from ..utils.auth import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api", tags=["Social"])


class BuildPatch(BaseModel):
    name: Optional[str] = None
    is_public: Optional[bool] = None


# ----------------------------- helpers -----------------------------
def _public_user(u: dict) -> dict:
    """Public-safe view of a user. Never exposes email or password."""
    return {
        "id": u["id"],
        "username": u["username"],
        "bio": u.get("bio"),
        "avatar_url": u.get("avatar_url"),
        "favorites_public": bool(u.get("favorites_public")),
        "created_at": u.get("created_at"),
    }


def _get_build(db: Client, build_id: int) -> dict:
    res = db.table("builds").select("*").eq("id", build_id).maybe_single().execute()
    build = res.data if res else None
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    return build


def _get_user(db: Client, username: str) -> dict:
    res = db.table("users").select("*").eq("username", username).maybe_single().execute()
    user = res.data if res else None
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _enrich_builds(db: Client, builds: List[dict]) -> List[dict]:
    """Attach owner {username, avatar_url} and a parts summary to each build."""
    if not builds:
        return builds
    comp_ids, user_ids = set(), set()
    for b in builds:
        for cid in (b.get("components") or {}).values():
            comp_ids.add(cid)
        user_ids.add(b.get("user_id"))

    comp_map, price_map, user_map = {}, {}, {}
    if comp_ids:
        cres = db.table("components").select("id, name, category_id, brand").in_("id", list(comp_ids)).execute()
        comp_map = {c["id"]: c for c in (cres.data or [])}
        pres = db.table("component_prices").select("component_id, price").in_("component_id", list(comp_ids)).execute()
        for p in pres.data or []:
            cid, pr = p["component_id"], float(p["price"])
            if cid not in price_map or pr < price_map[cid]:
                price_map[cid] = pr
    if user_ids:
        ures = db.table("users").select("id, username, avatar_url").in_("id", list(user_ids)).execute()
        user_map = {u["id"]: {"username": u["username"], "avatar_url": u.get("avatar_url")} for u in (ures.data or [])}

    for b in builds:
        parts = []
        for slot, cid in (b.get("components") or {}).items():
            c = comp_map.get(cid)
            if c:
                parts.append({"slot": slot, "id": cid, "name": c["name"], "price": price_map.get(cid)})
        b["parts"] = parts
        b["part_count"] = len(parts)
        b["owner"] = user_map.get(b.get("user_id"))
        b.setdefault("likes_count", 0)
    return builds


def _attach_my_flags(db: Client, builds: List[dict], user: Optional[dict]) -> None:
    if not builds:
        return
    liked, faved = set(), set()
    if user:
        ids = [b["id"] for b in builds]
        lres = db.table("build_likes").select("build_id").eq("user_id", user["id"]).in_("build_id", ids).execute()
        fres = db.table("build_favorites").select("build_id").eq("user_id", user["id"]).in_("build_id", ids).execute()
        liked = {r["build_id"] for r in (lres.data or [])}
        faved = {r["build_id"] for r in (fres.data or [])}
    for b in builds:
        b["liked_by_me"] = b["id"] in liked
        b["favorited_by_me"] = b["id"] in faved


def _like_count(db: Client, build_id: int) -> int:
    res = db.table("build_likes").select("id", count="exact").eq("build_id", build_id).execute()
    return res.count or 0


# ----------------------------- community feed -----------------------------
@router.get("/builds/public")
def public_builds(
    sort: str = Query("recent", pattern="^(recent|popular)$"),
    scope: str = Query("all", pattern="^(all|following)$"),
    skip: int = 0,
    limit: int = Query(24, le=60),
    me: Optional[dict] = Depends(get_current_user_optional),
    db: Client = Depends(get_db),
):
    """Public community build feed. scope=following needs auth."""
    rows = db.table("builds").select("*").execute().data or []
    builds = [b for b in rows if b.get("is_public")]

    if scope == "following":
        if not me:
            return {"items": [], "total": 0}
        fres = db.table("user_follows").select("following_id").eq("follower_id", me["id"]).execute()
        follow_ids = {r["following_id"] for r in (fres.data or [])}
        builds = [b for b in builds if b.get("user_id") in follow_ids]

    if sort == "popular":
        builds.sort(key=lambda b: (b.get("likes_count") or 0, b.get("created_at") or ""), reverse=True)
    else:
        builds.sort(key=lambda b: b.get("created_at") or "", reverse=True)

    total = len(builds)
    page = builds[skip:skip + limit]
    _enrich_builds(db, page)
    _attach_my_flags(db, page, me)
    return {"items": page, "total": total}


@router.get("/builds/slug/{slug}")
def build_by_slug(
    slug: str,
    me: Optional[dict] = Depends(get_current_user_optional),
    db: Client = Depends(get_db),
):
    """A single build by its public slug (public, or owner only if private)."""
    res = db.table("builds").select("*").eq("slug", slug).maybe_single().execute()
    build = res.data if res else None
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    if not build.get("is_public") and not (me and me["id"] == build["user_id"]):
        raise HTTPException(status_code=403, detail="This build is private")
    _enrich_builds(db, [build])
    _attach_my_flags(db, [build], me)
    build["likes_count"] = _like_count(db, build["id"])
    return build


@router.patch("/builds/{build_id}")
def update_build(
    build_id: int,
    patch: BuildPatch,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """Rename a build or change its visibility. Owner only."""
    build = _get_build(db, build_id)
    if build["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your build")
    changes: Dict = {}
    if patch.name is not None:
        changes["name"] = patch.name.strip()[:80] or "My Build"
    if patch.is_public is not None:
        changes["is_public"] = patch.is_public
    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")
    res = db.table("builds").update(changes).eq("id", build_id).execute()
    return res.data[0] if res.data else build


# ----------------------------- likes -----------------------------
@router.post("/builds/{build_id}/like")
def like_build(build_id: int, user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    build = _get_build(db, build_id)
    if not build.get("is_public") and build["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Build not found")
    existing = db.table("build_likes").select("id").eq("user_id", user["id"]).eq("build_id", build_id).execute()
    if not existing.data:
        db.table("build_likes").insert({"user_id": user["id"], "build_id": build_id}).execute()
    count = _like_count(db, build_id)
    db.table("builds").update({"likes_count": count}).eq("id", build_id).execute()
    return {"liked": True, "likes_count": count}


@router.delete("/builds/{build_id}/like")
def unlike_build(build_id: int, user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    db.table("build_likes").delete().eq("user_id", user["id"]).eq("build_id", build_id).execute()
    count = _like_count(db, build_id)
    db.table("builds").update({"likes_count": count}).eq("id", build_id).execute()
    return {"liked": False, "likes_count": count}


# ----------------------------- favourites -----------------------------
@router.post("/builds/{build_id}/favorite")
def favorite_build(build_id: int, user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    build = _get_build(db, build_id)
    if not build.get("is_public") and build["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Build not found")
    existing = db.table("build_favorites").select("id").eq("user_id", user["id"]).eq("build_id", build_id).execute()
    if not existing.data:
        db.table("build_favorites").insert({"user_id": user["id"], "build_id": build_id}).execute()
    return {"favorited": True}


@router.delete("/builds/{build_id}/favorite")
def unfavorite_build(build_id: int, user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    db.table("build_favorites").delete().eq("user_id", user["id"]).eq("build_id", build_id).execute()
    return {"favorited": False}


@router.get("/me/favorites")
def my_favorites(user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    rows = db.table("build_favorites").select("build_id").eq("user_id", user["id"]).execute().data or []
    fav_ids = [r["build_id"] for r in rows]
    if not fav_ids:
        return []
    builds = db.table("builds").select("*").in_("id", fav_ids).execute().data or []
    # Only show favourites you can still see (public, or your own)
    builds = [b for b in builds if b.get("is_public") or b.get("user_id") == user["id"]]
    builds.sort(key=lambda b: b.get("created_at") or "", reverse=True)
    _enrich_builds(db, builds)
    _attach_my_flags(db, builds, user)
    return builds


# ----------------------------- builders directory -----------------------------
@router.get("/users")
def list_users(
    q: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = Query(24, le=60),
    db: Client = Depends(get_db),
):
    """Public directory of builders. Searchable by username, paginated. Each
    entry is public-safe and carries a count of that user's public builds."""
    rows = db.table("users").select("*").execute().data or []
    users = [u for u in rows if u.get("is_active", True)]
    if q:
        needle = q.strip().lower()
        users = [u for u in users if needle in (u.get("username") or "").lower()]

    # Public-build counts, computed once over all builds.
    builds = db.table("builds").select("user_id, is_public").execute().data or []
    counts: Dict[int, int] = {}
    for b in builds:
        if b.get("is_public"):
            counts[b.get("user_id")] = counts.get(b.get("user_id"), 0) + 1

    # Show the most active builders first, then newest accounts.
    users.sort(key=lambda u: (counts.get(u["id"], 0), u.get("created_at") or ""), reverse=True)
    total = len(users)
    page = users[skip:skip + limit]
    items = []
    for u in page:
        pu = _public_user(u)
        pu["public_builds"] = counts.get(u["id"], 0)
        items.append(pu)
    return {"items": items, "total": total}


# ----------------------------- profiles + following -----------------------------
@router.get("/users/{username}")
def get_profile(
    username: str,
    me: Optional[dict] = Depends(get_current_user_optional),
    db: Client = Depends(get_db),
):
    """Public profile: user info, their public builds, counts, and (if allowed) favourites."""
    u = _get_user(db, username)
    is_self = bool(me and me["id"] == u["id"])

    all_builds = db.table("builds").select("*").eq("user_id", u["id"]).execute().data or []
    public_builds = [b for b in all_builds if b.get("is_public")]
    visible = [b for b in all_builds if b.get("is_public") or is_self]
    visible.sort(key=lambda b: b.get("created_at") or "", reverse=True)
    _enrich_builds(db, visible)
    _attach_my_flags(db, visible, me)

    followers = db.table("user_follows").select("id", count="exact").eq("following_id", u["id"]).execute().count or 0
    following = db.table("user_follows").select("id", count="exact").eq("follower_id", u["id"]).execute().count or 0

    is_following = False
    if me and not is_self:
        f = db.table("user_follows").select("id").eq("follower_id", me["id"]).eq("following_id", u["id"]).execute()
        is_following = bool(f.data)

    favorites: List[dict] = []
    favorites_visible = bool(u.get("favorites_public")) or is_self
    if favorites_visible:
        fav_rows = db.table("build_favorites").select("build_id").eq("user_id", u["id"]).execute().data or []
        fav_ids = [r["build_id"] for r in fav_rows]
        if fav_ids:
            fb = db.table("builds").select("*").in_("id", fav_ids).execute().data or []
            fb = [b for b in fb if b.get("is_public") or (me and b.get("user_id") == me["id"])]
            fb.sort(key=lambda b: b.get("created_at") or "", reverse=True)
            _enrich_builds(db, fb)
            _attach_my_flags(db, fb, me)
            favorites = fb

    return {
        "user": _public_user(u),
        "is_self": is_self,
        "is_following": is_following,
        "counts": {
            "public_builds": len(public_builds),
            "followers": followers,
            "following": following,
        },
        "builds": visible,
        "favorites": favorites,
        "favorites_visible": favorites_visible,
    }


@router.post("/users/{username}/follow")
def follow_user(username: str, user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    target = _get_user(db, username)
    if target["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You can't follow yourself")
    existing = (
        db.table("user_follows").select("id")
        .eq("follower_id", user["id"]).eq("following_id", target["id"]).execute()
    )
    if not existing.data:
        db.table("user_follows").insert({"follower_id": user["id"], "following_id": target["id"]}).execute()
    return {"following": True}


@router.delete("/users/{username}/follow")
def unfollow_user(username: str, user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    target = _get_user(db, username)
    db.table("user_follows").delete().eq("follower_id", user["id"]).eq("following_id", target["id"]).execute()
    return {"following": False}
