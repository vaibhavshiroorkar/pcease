"""Agent tools. Each @tool generates its own JSON schema from the signature + docstring.
`db` and `user` are InjectedToolArg — hidden from the model, supplied by the loop at runtime.
"""
from typing import Annotated, Optional, List, Any, Dict
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


# ---------------------------------------------------------------------------
# Analysis tools
# ---------------------------------------------------------------------------

def _fetch_specs(db, ids: List[int]) -> Dict[int, dict]:
    if not ids:
        return {}
    res = db.table("components").select("id, name, specifications").in_("id", ids).execute()
    return {r["id"]: r for r in (res.data or [])}


def _tdp(specs: dict, default: int) -> int:
    raw = specs.get("tdp") or specs.get("wattage")
    if raw is None:
        return default
    try:
        return int(str(raw).lower().replace("w", "").strip())
    except (ValueError, AttributeError):
        return default


# Form-factor compatibility (mirrors the frontend Builder map)
_FORM_FACTOR_COMPAT = {
    "ATX": ["ATX", "Micro-ATX", "Mini-ITX"],
    "Micro-ATX": ["Micro-ATX", "Mini-ITX"],
    "Mini-ITX": ["Mini-ITX"],
}


@tool
def check_compatibility(
    component_ids: List[int],
    db: Annotated[Any, InjectedToolArg] = None,
) -> dict:
    """Check whether a set of components are compatible. Pass the component ids.
    Verifies CPU socket vs motherboard socket, RAM type vs motherboard, and motherboard
    form factor vs case. Returns {compatible: bool, issues: [string]}."""
    comp = _fetch_specs(db, component_ids)
    cpu_socket = mb_socket = mb_ram = ram_type = mb_form = case_forms = None
    for c in comp.values():
        s = c.get("specifications") or {}
        if "cores" in s or "boost_clock" in s:
            cpu_socket = s.get("socket")
        if "chipset" in s or "ram_type" in s:
            mb_socket = s.get("socket"); mb_ram = s.get("ram_type"); mb_form = s.get("form_factor")
        if "capacity" in s and "type" in s and "DDR" in str(s.get("type", "")):
            ram_type = s.get("type")
        if s.get("supported_form_factors"):
            case_forms = s.get("supported_form_factors")

    issues = []
    if cpu_socket and mb_socket and cpu_socket != mb_socket:
        issues.append(f"CPU socket {cpu_socket} does not match motherboard socket {mb_socket}.")
    if ram_type and mb_ram and ram_type not in mb_ram and mb_ram not in ram_type:
        issues.append(f"RAM type {ram_type} may not be supported by the motherboard ({mb_ram}).")
    if mb_form and case_forms and mb_form not in case_forms:
        issues.append(f"Motherboard form factor {mb_form} may not fit this case.")
    return {"compatible": len(issues) == 0, "issues": issues}


@tool
def estimate_wattage(
    component_ids: List[int],
    db: Annotated[Any, InjectedToolArg] = None,
) -> dict:
    """Estimate total power draw and recommend a PSU wattage (20% headroom, rounded to 50W)
    for the given component ids."""
    comp = _fetch_specs(db, component_ids)
    defaults = {"cpu": 65, "gpu": 150, "ram": 5, "motherboard": 50, "storage": 10, "cooler": 15}
    total = 0
    breakdown = []
    for c in comp.values():
        s = c.get("specifications") or {}
        guess = "gpu" if "memory" in s else "cpu" if "cores" in s else "motherboard"
        watts = _tdp(s, defaults.get(guess, 10))
        total += watts
        breakdown.append({"name": c.get("name"), "wattage": watts})
    recommended = ((int(total * 1.2) + 49) // 50) * 50
    return {"total_tdp": total, "recommended_psu": recommended,
            "headroom_percent": 20, "breakdown": breakdown}


def _cpu_tier(name: str) -> int:
    name = (name or "").lower()
    if any(x in name for x in ["9900", "9950", "7950", "7900", "14900", "13900"]):
        return 5
    if any(x in name for x in ["7800", "7700", "14700", "13700", "9700"]):
        return 4
    if any(x in name for x in ["7600", "5600", "14600", "13600", "12600"]):
        return 3
    if any(x in name for x in ["5500", "12400", "13400", "14400"]):
        return 2
    return 1


def _gpu_tier(name: str) -> int:
    name = (name or "").lower()
    if any(x in name for x in ["4090", "4080", "7900 xtx", "7900 xt"]):
        return 5
    if any(x in name for x in ["4070 ti", "4070 super", "7800 xt"]):
        return 4
    if any(x in name for x in ["4060 ti", "4070", "7700 xt", "6800"]):
        return 3
    if any(x in name for x in ["4060", "6700", "7600"]):
        return 2
    return 1


@tool
def check_bottleneck(
    cpu_id: int,
    gpu_id: int,
    db: Annotated[Any, InjectedToolArg] = None,
) -> dict:
    """Analyze CPU-GPU balance for a given cpu_id and gpu_id. Returns status
    (balanced / cpu_bottleneck / gpu_bottleneck), severity, and a message."""
    comp = _fetch_specs(db, [cpu_id, gpu_id])
    cpu = comp.get(cpu_id); gpu = comp.get(gpu_id)
    if not cpu or not gpu:
        return {"error": "CPU or GPU not found"}
    ct, gt = _cpu_tier(cpu["name"]), _gpu_tier(gpu["name"])
    diff = abs(ct - gt)
    if diff <= 1:
        return {"status": "balanced", "severity": "good",
                "message": "CPU and GPU are well balanced."}
    if ct < gt:
        return {"status": "cpu_bottleneck", "severity": "warning" if diff <= 2 else "critical",
                "message": f"The CPU ({cpu['name']}) may bottleneck the GPU."}
    return {"status": "gpu_bottleneck", "severity": "warning" if diff <= 2 else "critical",
            "message": f"The GPU ({gpu['name']}) may bottleneck the CPU."}
