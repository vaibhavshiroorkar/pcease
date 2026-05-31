"""Agent tools. Each @tool generates its own JSON schema from the signature + docstring.
`db` and `user` are InjectedToolArg — hidden from the model, supplied by the loop at runtime.
"""
from typing import Annotated, Optional, List, Any
from langchain_core.tools import tool, InjectedToolArg

_SELECT = "*, category:categories(*), prices:component_prices(*, vendor:vendors(*))"


def _lowest_price(comp: dict) -> Optional[float]:
    prices = comp.get("prices") or []
    vals = [float(p["price"]) for p in prices if p.get("price") is not None]
    return min(vals) if vals else None


def _best_vendor(comp: dict) -> Optional[str]:
    prices = comp.get("prices") or []
    if not prices:
        return None
    best = min(prices, key=lambda p: float(p["price"]))
    return (best.get("vendor") or {}).get("name")


def _category_id(db: Any, slug: str) -> Optional[int]:
    res = db.table("categories").select("id").eq("slug", slug).execute()
    rows = res.data or []
    return rows[0]["id"] if rows else None


@tool
def search_components(
    category: str,
    max_price: Optional[float] = None,
    min_price: Optional[float] = None,
    brand: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 10,
    db: Annotated[Any, InjectedToolArg] = None,
) -> List[dict]:
    """Search PCease's component database within a category. category is one of:
    cpu, gpu, motherboard, ram, storage, psu, case, cooler. Optionally filter by
    max_price/min_price (in INR), brand (e.g. AMD, Intel, NVIDIA), or a name query.
    Returns parts sorted cheapest-first with id, name, brand, key specs, lowest_price, best_vendor."""
    cat_id = _category_id(db, category)
    if cat_id is None:
        return []
    q = db.table("components").select(_SELECT).eq("category_id", cat_id)
    if brand:
        q = q.ilike("brand", f"%{brand}%")
    if query:
        q = q.ilike("name", f"%{query}%")
    rows = (q.execute().data) or []

    out = []
    for c in rows:
        low = _lowest_price(c)
        if low is None:
            continue
        if max_price is not None and low > float(max_price):
            continue
        if min_price is not None and low < float(min_price):
            continue
        out.append({
            "id": c["id"],
            "name": c["name"],
            "brand": c.get("brand"),
            "specs": c.get("specifications") or {},
            "lowest_price": int(low),
            "best_vendor": _best_vendor(c),
        })
    out.sort(key=lambda c: c["lowest_price"])
    return out[:limit]


@tool
def get_component(
    component_id: int,
    db: Annotated[Any, InjectedToolArg] = None,
) -> dict:
    """Get full details (all specs and every vendor price) for one component by id."""
    res = db.table("components").select(_SELECT).eq("id", component_id).maybe_single().execute()
    if not res or not res.data:
        return {"error": f"component {component_id} not found"}
    return res.data
