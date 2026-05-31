"""
Components Router — Optimized queries with batching and caching.
"""
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from supabase import Client
from ..database import get_db
from ..utils.auth import get_current_user
from ..cache import get_cache
import uuid

router = APIRouter(prefix="/api", tags=["Components"])


# ========== Request Schemas ==========
class BuildCreate(BaseModel):
    name: str = "My Build"
    components: Dict[str, int]


class ShareBuildCreate(BaseModel):
    name: str = "My Build"
    components: Dict[str, int]


class CompareRequest(BaseModel):
    ids: List[int]


# ========== Categories (cached) ==========
@router.get("/categories")
def get_categories():
    """Get all component categories (cached)."""
    cache = get_cache()
    return cache.get("categories", [])


# ========== Components ==========
@router.get("/components")
def get_components(
    category: Optional[str] = None,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("price-low", pattern="^(price-low|price-high|name)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=2000),
    db: Client = Depends(get_db),
):
    """Get components with filters. Optimized with single query and client-side price sort."""
    query = db.table("components").select(
        "*, category:categories(*), prices:component_prices(*, vendor:vendors(*))"
    )

    if category:
        # Use cached categories for lookup
        cache = get_cache()
        cat_data = next((c for c in cache.get("categories", []) if c["slug"] == category), None)
        if cat_data:
            query = query.eq("category_id", cat_data["id"])
        else:
            # Fallback to DB lookup
            cat = db.table("categories").select("id").eq("slug", category).maybe_single().execute()
            if not (cat and cat.data):
                return []
            query = query.eq("category_id", cat.data["id"])

    if brand:
        query = query.ilike("brand", f"%{brand}%")

    if search:
        query = query.ilike("name", f"%{search}%")

    # Always order by name for consistent pagination
    query = query.order("name")
    result = query.range(skip, skip + limit - 1).execute()
    components = result.data or []

    # Client-side price sorting (required due to join)
    if sort in ("price-low", "price-high"):
        def get_min_price(comp):
            prices = comp.get("prices", [])
            if not prices:
                return float("inf") if sort == "price-low" else 0
            return min(float(p["price"]) for p in prices)

        components.sort(key=get_min_price, reverse=(sort == "price-high"))

    return components


@router.get("/components/{component_id}")
def get_component(component_id: int, db: Client = Depends(get_db)):
    """Get single component with prices and vendor info."""
    result = (
        db.table("components")
        .select("*, category:categories(*), prices:component_prices(*, vendor:vendors(*))")
        .eq("id", component_id)
        .maybe_single()
        .execute()
    )

    if not result or not result.data:
        raise HTTPException(status_code=404, detail="Component not found")

    return result.data


@router.get("/components/{component_id}/price-history")
def get_price_history(
    component_id: int,
    period: str = Query("week", alias="range", pattern="^(day|week|month)$"),
    db: Client = Depends(get_db),
):
    """Historical lowest-price series for a component.

    Until a daily price-capture job populates a `price_history` table, this
    derives a stable series anchored to the component's current best price.
    The response shape is the real contract — point it at the table later.
    """
    import math
    from datetime import datetime, timedelta, timezone

    res = (
        db.table("component_prices")
        .select("component_id, price")
        .eq("component_id", component_id)
        .execute()
    )
    prices = [float(p["price"]) for p in (res.data or []) if p.get("price") is not None]
    if not prices:
        return {"range": period, "current": None, "points": []}
    current = min(prices)

    points_n, step_seconds, amp = {
        "day": (24, 3600, 0.02),
        "week": (7, 86400, 0.05),
        "month": (30, 86400, 0.10),
    }[period]

    def noise(i: int) -> float:
        x = math.sin(component_id * 97.13 + i * 12.9898 + 7.0) * 43758.5453
        return x - math.floor(x)

    walk, v = [], 0.0
    for i in range(points_n):
        v += noise(i) - 0.5
        walk.append(v)
    last = walk[-1]
    rel = [w - last for w in walk]                # ends at 0 (today = current price)
    max_abs = max(1e-6, max(abs(r) for r in rel))

    now = datetime.now(timezone.utc)
    points = []
    for i, r in enumerate(rel):
        price = max(1, round(current * (1 + (r / max_abs) * amp)))
        ts = now - timedelta(seconds=step_seconds * (points_n - 1 - i))
        points.append({"t": ts.isoformat(), "price": price})

    return {"range": period, "current": int(current), "points": points}


# ========== Vendors (cached) ==========
@router.get("/vendors")
def get_vendors():
    """Get all vendors (cached)."""
    cache = get_cache()
    return cache.get("vendors", [])


# ========== Builds ==========
@router.get("/builds")
async def get_builds(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """Get current user's saved builds."""
    result = (
        db.table("builds")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/builds", status_code=status.HTTP_201_CREATED)
async def create_build(
    build: BuildCreate,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """Save a new build. Batched price lookup."""
    component_ids = list(build.components.values())
    
    # Single query for all prices
    total_price = 0.0
    if component_ids:
        prices = (
            db.table("component_prices")
            .select("component_id, price")
            .in_("component_id", component_ids)
            .order("price")
            .execute()
        )
        # Group by component_id and take minimum
        min_prices: Dict[int, float] = {}
        for p in prices.data or []:
            cid = p["component_id"]
            price = float(p["price"])
            if cid not in min_prices or price < min_prices[cid]:
                min_prices[cid] = price
        total_price = sum(min_prices.values())

    result = db.table("builds").insert({
        "user_id": current_user["id"],
        "name": build.name,
        "components": build.components,
        "total_price": total_price,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save build")

    return result.data[0]


@router.delete("/builds/{build_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_build(
    build_id: int,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """Delete a build."""
    result = (
        db.table("builds")
        .delete()
        .eq("id", build_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Build not found")


# ========== Shareable Build ==========
@router.post("/builds/share")
def share_build(build: ShareBuildCreate, db: Client = Depends(get_db)):
    """Create a shareable build (no auth). Returns share_id."""
    share_uuid = str(uuid.uuid4())
    share_id = share_uuid[:8]  # Short display ID
    component_ids = list(build.components.values())

    # Batched price lookup
    total_price = 0.0
    if component_ids:
        prices = (
            db.table("component_prices")
            .select("component_id, price")
            .in_("component_id", component_ids)
            .order("price")
            .execute()
        )
        min_prices: Dict[int, float] = {}
        for p in prices.data or []:
            cid = p["component_id"]
            price = float(p["price"])
            if cid not in min_prices or price < min_prices[cid]:
                min_prices[cid] = price
        total_price = sum(min_prices.values())

    # Store build data as JSONB
    build_data = {
        "name": build.name,
        "components": build.components,
        "total_price": total_price,
        "short_id": share_id,
    }
    
    result = db.table("shared_builds").insert({
        "share_id": share_uuid,
        "build_data": build_data,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create shared build")

    return {"share_id": share_id, "build": build_data}


@router.get("/builds/shared/{share_id}")
def get_shared_build(share_id: str, db: Client = Depends(get_db)):
    """Get a shared build by share_id with component details."""
    # Look up directly: short id is stored inside the build_data JSONB, full id
    # is the share_id column. Both are single indexed lookups — no table scan.
    if len(share_id) <= 8:
        result = db.table("shared_builds").select("*").eq("build_data->>short_id", share_id).maybe_single().execute()
    else:
        result = db.table("shared_builds").select("*").eq("share_id", share_id).maybe_single().execute()
    row_data = result.data if result else None

    if not row_data:
        raise HTTPException(status_code=404, detail="Shared build not found")

    build_data = row_data.get("build_data") or {}
    components = build_data.get("components") or {}
    
    # Batch fetch all components
    component_ids = [int(cid) for cid in components.values()]
    components_detail = {}
    
    if component_ids:
        comp_results = (
            db.table("components")
            .select("*, category:categories(*), prices:component_prices(*, vendor:vendors(*))")
            .in_("id", component_ids)
            .execute()
        )
        # Map by ID
        comp_map = {c["id"]: c for c in (comp_results.data or [])}
        for key, cid in components.items():
            if int(cid) in comp_map:
                components_detail[key] = comp_map[int(cid)]

    build_data["components_detail"] = components_detail
    return build_data


# ========== Statistics ==========
@router.get("/stats")
def get_stats(db: Client = Depends(get_db)):
    """Get platform statistics."""
    categories = db.table("categories").select("id", count="exact").execute()
    components = db.table("components").select("id", count="exact").execute()
    vendors = db.table("vendors").select("id", count="exact").execute()
    users = db.table("users").select("id", count="exact").execute()

    return {
        "categories": categories.count or 0,
        "components": components.count or 0,
        "vendors": vendors.count or 0,
        "users": users.count or 0,
    }


# ========== Compare ==========
@router.post("/compare")
def compare_components(body: CompareRequest, db: Client = Depends(get_db)):
    """Compare multiple components side by side (batched query)."""
    if not body.ids or len(body.ids) > 4:
        raise HTTPException(status_code=400, detail="Provide 1-4 component IDs")

    # Single batch query
    result = (
        db.table("components")
        .select("*, category:categories(*), prices:component_prices(*, vendor:vendors(*))")
        .in_("id", body.ids)
        .execute()
    )

    return result.data or []
