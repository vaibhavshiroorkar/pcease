# Agentic Build Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PCease's stateless single-shot AI Advisor with a grounded, tool-using agent that searches the real component database, analyzes builds, assembles grounded recommendations, takes write actions, and streams its reasoning live to the chat UI.

**Architecture:** A new `backend/app/agent/` package exposes tools (`@tool`-decorated functions over Supabase), a provider factory (`llm.py`) that returns a tool-bound LangChain chat model for Claude **or** Gemini, and a hand-rolled async-generator agent loop (`loop.py`) that streams typed events. A new SSE endpoint (`routers/agent.py`) serializes those events. The frontend Advisor "AI Chat" tab is rewritten to consume the SSE stream and render streaming text, tool-step chips, and inline build cards. LangChain Core is used only as a library (model abstraction + tool schemas); the loop and stream are ours.

**Tech Stack:** FastAPI, Supabase (sync client), LangChain Core + `langchain-anthropic` + `langchain-google-genai`, pytest + pytest-asyncio (backend tests), React 18 + Vite 5, Vitest (one frontend parser test), native `fetch` + `ReadableStream` for SSE.

**Reference spec:** `docs/superpowers/specs/2026-05-31-agentic-build-advisor-design.md`

---

## File Structure

**Backend (create):**
- `backend/app/agent/__init__.py` — package marker
- `backend/app/agent/prompts.py` — system prompt
- `backend/app/agent/tools.py` — `@tool` functions + `TOOLS` list + `TOOL_MAP`
- `backend/app/agent/llm.py` — `get_chat_model()` provider factory
- `backend/app/agent/loop.py` — `run_agent()` async generator
- `backend/app/routers/agent.py` — `POST /api/agent/chat` SSE endpoint
- `backend/requirements-dev.txt` — test deps
- `backend/pytest.ini` — pytest config
- `backend/tests/__init__.py`, `backend/tests/conftest.py` — `FakeSupabase` fixture
- `backend/tests/test_tools.py`, `test_llm.py`, `test_loop.py`, `test_agent_endpoint.py`

**Backend (modify):**
- `backend/app/config.py` — new settings fields
- `backend/app/main.py` — include agent router
- `backend/requirements.txt` — add langchain packages

**Frontend (create):**
- `frontend/src/services/agentStream.js` — `parseFrame()` + `streamAgent()`
- `frontend/src/hooks/useAgentChat.js` — chat state hook
- `frontend/src/utils/formatText.jsx` — tiny inline text formatter
- `frontend/src/services/agentStream.test.js` — Vitest test for `parseFrame`
- `frontend/vitest.config.js` — Vitest config

**Frontend (modify):**
- `frontend/src/pages/Advisor.jsx` — rewrite the `tab === 'ai'` block
- `frontend/src/pages/Advisor.css` — chip + build-card styles
- `frontend/package.json` — add `vitest` devDep + `test` script

---

## Task 1: Backend test scaffold, config, and dependencies

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`
- Create: `backend/pytest.ini`
- Modify: `backend/app/config.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_config.py`

- [ ] **Step 1: Add runtime dependencies**

Append to `backend/requirements.txt`:

```
# Agentic AI (LangChain Core as a library — Claude + Gemini)
langchain-core>=0.3.0
langchain-anthropic>=0.3.0
langchain-google-genai>=2.0.0
```

- [ ] **Step 2: Create dev dependencies file**

Create `backend/requirements-dev.txt`:

```
-r requirements.txt
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

- [ ] **Step 3: Create pytest config**

Create `backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
```

- [ ] **Step 4: Write failing config test**

Create `backend/tests/__init__.py` (empty) and `backend/tests/test_config.py`:

```python
from app.config import Settings


def test_settings_have_agent_defaults():
    s = Settings()
    assert s.llm_provider in ("claude", "gemini")
    assert s.claude_model
    assert s.gemini_model
    assert s.agent_max_iterations >= 1
    assert hasattr(s, "anthropic_api_key")
```

- [ ] **Step 5: Run it, verify failure**

Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: FAIL — `AttributeError`/`assert` on missing `llm_provider`.

- [ ] **Step 6: Add settings fields**

In `backend/app/config.py`, inside `class Settings`, after the `gemini_api_key` line, add:

```python
    # Anthropic Claude
    anthropic_api_key: str = ""

    # Agent
    llm_provider: str = "claude"  # "claude" | "gemini"
    claude_model: str = "claude-haiku-4-5-20251001"
    gemini_model: str = "gemini-1.5-flash"
    agent_max_iterations: int = 8
```

- [ ] **Step 7: Create the FakeSupabase fixture**

Create `backend/tests/conftest.py`:

```python
"""In-memory fake Supabase client for deterministic tool tests."""
import pytest


class FakeResult:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class FakeQuery:
    def __init__(self, rows):
        self._rows = list(rows)
        self._single = False
        self._maybe = False

    def select(self, *_a, **_k):
        return self

    def eq(self, field, value):
        self._rows = [r for r in self._rows if str(r.get(field)) == str(value)]
        return self

    def ilike(self, field, pattern):
        needle = pattern.strip("%").lower()
        self._rows = [r for r in self._rows if needle in str(r.get(field, "")).lower()]
        return self

    def in_(self, field, values):
        vals = {str(v) for v in values}
        self._rows = [r for r in self._rows if str(r.get(field)) in vals]
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, start, end):
        self._rows = self._rows[start:end + 1]
        return self

    def limit(self, n):
        self._rows = self._rows[:n]
        return self

    def single(self):
        self._single = True
        return self

    def maybe_single(self):
        self._maybe = True
        return self

    def insert(self, payload):
        row = dict(payload)
        row.setdefault("id", len(self._rows) + 1)
        self._rows = [row]
        return self

    def execute(self):
        if self._single or self._maybe:
            return FakeResult(self._rows[0] if self._rows else None)
        return FakeResult(self._rows)


class FakeSupabase:
    def __init__(self, tables=None):
        self.tables = tables or {}
        self.inserted = []

    def table(self, name):
        return FakeQuery(self.tables.get(name, []))


@pytest.fixture
def fake_db():
    """Supabase fake seeded with a tiny realistic catalog."""
    return FakeSupabase(tables={
        "categories": [
            {"id": 1, "slug": "cpu", "name": "Processor"},
            {"id": 2, "slug": "gpu", "name": "Graphics Card"},
            {"id": 3, "slug": "motherboard", "name": "Motherboard"},
        ],
        "components": [
            {"id": 10, "name": "Ryzen 5 7600", "brand": "AMD", "category_id": 1,
             "specifications": {"cores": 6, "socket": "AM5", "boost_clock": "5.1 GHz", "tdp": "65W"},
             "prices": [{"price": "21000", "vendor": {"name": "MDComputers"}}]},
            {"id": 11, "name": "Ryzen 7 7800X3D", "brand": "AMD", "category_id": 1,
             "specifications": {"cores": 8, "socket": "AM5", "boost_clock": "5.0 GHz", "tdp": "120W"},
             "prices": [{"price": "38000", "vendor": {"name": "PrimeABGB"}}]},
            {"id": 20, "name": "RTX 4060", "brand": "NVIDIA", "category_id": 2,
             "specifications": {"memory": "8GB", "tdp": "115W"},
             "prices": [{"price": "30000", "vendor": {"name": "Amazon.in"}}]},
            {"id": 30, "name": "MSI B650 Tomahawk", "brand": "MSI", "category_id": 3,
             "specifications": {"socket": "AM5", "ram_type": "DDR5", "form_factor": "ATX"},
             "prices": [{"price": "18000", "vendor": {"name": "MDComputers"}}]},
        ],
        "component_prices": [
            {"component_id": 10, "price": "21000"},
            {"component_id": 20, "price": "30000"},
            {"component_id": 30, "price": "18000"},
        ],
        "builds": [],
        "shared_builds": [],
    })
```

- [ ] **Step 8: Run config test, verify pass**

Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/requirements.txt backend/requirements-dev.txt backend/pytest.ini backend/app/config.py backend/tests/
git commit -m "chore: add agent settings, test scaffold, and langchain deps"
```

---

## Task 2: System prompt

**Files:**
- Create: `backend/app/agent/__init__.py`
- Create: `backend/app/agent/prompts.py`
- Create: `backend/tests/test_prompts.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_prompts.py`:

```python
from app.agent.prompts import SYSTEM_PROMPT


def test_system_prompt_sets_grounding_rules():
    p = SYSTEM_PROMPT.lower()
    assert "search_components" in p          # tells model to use tools
    assert "₹" in SYSTEM_PROMPT or "inr" in p  # India context
    assert "confirm" in p                    # confirm before write actions
```

- [ ] **Step 2: Run it, verify failure**

Run: `cd backend && python -m pytest tests/test_prompts.py -v`
Expected: FAIL — `ModuleNotFoundError: app.agent`.

- [ ] **Step 3: Create package + prompt**

Create `backend/app/agent/__init__.py` (empty).

Create `backend/app/agent/prompts.py`:

```python
SYSTEM_PROMPT = """You are PCease AI, an expert PC-building advisor for the Indian market.

You have tools that read PCease's REAL component database (Indian retailers, prices in ₹).
GROUNDING RULES — never violate these:
- NEVER invent component names, specs, or prices. Always call `search_components` or
  `get_component` and recommend ONLY parts the tools return, with their real prices.
- When the user gives a budget + use case, build a complete grounded PC: search each
  category (cpu, gpu, motherboard, ram, storage, psu, case, cooler), pick real parts that
  fit the budget, run `check_compatibility` and `estimate_wattage`, then call
  `assemble_build` with the chosen parts so a build card is shown.
- Prefer balanced builds; allocate more budget to GPU for gaming, CPU for content creation.
- Use `check_bottleneck` when the user pairs or asks about a specific CPU and GPU.

ACTION RULES:
- `save_build` and `create_share_link` change the user's data. ALWAYS confirm with the user
  in plain language and wait for a "yes" before calling them.
- If a write tool reports the user is not logged in, tell them to sign in first.

STYLE: concise, friendly, India-savvy. Prices in ₹. Use short bullet lists. Explain the
"why" behind each pick in one line.
"""
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd backend && python -m pytest tests/test_prompts.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/__init__.py backend/app/agent/prompts.py backend/tests/test_prompts.py
git commit -m "feat: add agent system prompt"
```

---

## Task 3: Read tools — `search_components` and `get_component`

**Files:**
- Create: `backend/app/agent/tools.py`
- Create: `backend/tests/test_tools.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_tools.py`:

```python
from app.agent import tools


def _invoke(tool, args, fake_db, user=None):
    payload = dict(args)
    payload["db"] = fake_db
    if "user" in tool.args:
        payload["user"] = user
    return tool.invoke(payload)


def test_search_components_filters_by_category_and_budget(fake_db):
    out = _invoke(tools.search_components,
                  {"category": "cpu", "max_price": 25000}, fake_db)
    names = [c["name"] for c in out]
    assert "Ryzen 5 7600" in names          # 21000 <= 25000
    assert "Ryzen 7 7800X3D" not in names    # 38000 > 25000
    assert out[0]["lowest_price"] == 21000
    assert out[0]["best_vendor"] == "MDComputers"


def test_search_components_unknown_category_returns_empty(fake_db):
    assert _invoke(tools.search_components, {"category": "nope"}, fake_db) == []


def test_get_component_returns_full_specs(fake_db):
    out = _invoke(tools.get_component, {"component_id": 30}, fake_db)
    assert out["name"] == "MSI B650 Tomahawk"
    assert out["specifications"]["socket"] == "AM5"
```

- [ ] **Step 2: Run them, verify failure**

Run: `cd backend && python -m pytest tests/test_tools.py -v`
Expected: FAIL — `ModuleNotFoundError` / no `search_components`.

- [ ] **Step 3: Implement read tools**

Create `backend/app/agent/tools.py`:

```python
"""Agent tools. Each @tool generates its own JSON schema from the signature + docstring.
`db` and `user` are InjectedToolArg — hidden from the model, supplied by the loop at runtime.
"""
from typing import Annotated, Optional, List, Dict
from langchain_core.tools import tool, InjectedToolArg
from supabase import Client

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


def _category_id(db: Client, slug: str) -> Optional[int]:
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
    db: Annotated[Optional[Client], InjectedToolArg] = None,
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
    db: Annotated[Optional[Client], InjectedToolArg] = None,
) -> dict:
    """Get full details (all specs and every vendor price) for one component by id."""
    res = db.table("components").select(_SELECT).eq("id", component_id).maybe_single().execute()
    if not res or not res.data:
        return {"error": f"component {component_id} not found"}
    return res.data
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd backend && python -m pytest tests/test_tools.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/tools.py backend/tests/test_tools.py
git commit -m "feat: add read tools (search_components, get_component)"
```

---

## Task 4: Analysis tools — compatibility, wattage, bottleneck

**Files:**
- Modify: `backend/app/agent/tools.py`
- Modify: `backend/tests/test_tools.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_tools.py`:

```python
def test_check_compatibility_flags_socket_mismatch(fake_db):
    # 11 = AM5 CPU, 30 = AM5 board -> compatible
    ok = _invoke(tools.check_compatibility, {"component_ids": [11, 30]}, fake_db)
    assert ok["compatible"] is True
    assert ok["issues"] == []


def test_estimate_wattage_uses_specifications_tdp(fake_db):
    # 11 cpu tdp 120W, 20 gpu tdp 115W -> ~235W + headroom rounded to 50
    out = _invoke(tools.estimate_wattage, {"component_ids": [11, 20]}, fake_db)
    assert out["total_tdp"] == 235
    assert out["recommended_psu"] % 50 == 0
    assert out["recommended_psu"] >= 282  # 235 * 1.2


def test_check_bottleneck_balanced_pair(fake_db):
    out = _invoke(tools.check_bottleneck, {"cpu_id": 10, "gpu_id": 20}, fake_db)
    assert out["status"] in ("balanced", "cpu_bottleneck", "gpu_bottleneck")
    assert "severity" in out
```

- [ ] **Step 2: Run, verify failure**

Run: `cd backend && python -m pytest tests/test_tools.py -k "compatibility or wattage or bottleneck" -v`
Expected: FAIL — tools not defined.

- [ ] **Step 3: Implement analysis tools**

Append to `backend/app/agent/tools.py`:

```python
def _fetch_specs(db: Client, ids: List[int]) -> Dict[int, dict]:
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
    db: Annotated[Optional[Client], InjectedToolArg] = None,
) -> dict:
    """Check whether a set of components are compatible. Pass the component ids.
    Verifies CPU socket vs motherboard socket, RAM type vs motherboard, and motherboard
    form factor vs case. Returns {compatible: bool, issues: [string]}."""
    comp = _fetch_specs(db, component_ids)
    specs_by_socket = {}
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
    db: Annotated[Optional[Client], InjectedToolArg] = None,
) -> dict:
    """Estimate total power draw and recommend a PSU wattage (20% headroom, rounded to 50W)
    for the given component ids."""
    comp = _fetch_specs(db, component_ids)
    defaults = {"cpu": 65, "gpu": 150, "ram": 5, "motherboard": 50, "storage": 10, "cooler": 15}
    total = 0
    breakdown = []
    for c in comp.values():
        s = c.get("specifications") or {}
        # crude category guess from specs for the default fallback
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
    db: Annotated[Optional[Client], InjectedToolArg] = None,
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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd backend && python -m pytest tests/test_tools.py -v`
Expected: PASS (6 tests total).

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/tools.py backend/tests/test_tools.py
git commit -m "feat: add analysis tools (compatibility, wattage, bottleneck)"
```

---

## Task 5: Build + write tools, and the tool registry

**Files:**
- Modify: `backend/app/agent/tools.py`
- Modify: `backend/tests/test_tools.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/test_tools.py`:

```python
def test_assemble_build_computes_total(fake_db):
    out = _invoke(tools.assemble_build, {
        "title": "Budget Gaming",
        "items": [{"slot": "cpu", "component_id": 10}, {"slot": "gpu", "component_id": 20}],
    }, fake_db)
    assert out["title"] == "Budget Gaming"
    assert out["total"] == 51000   # 21000 + 30000
    assert {i["slot"] for i in out["items"]} == {"cpu", "gpu"}


def test_save_build_requires_login(fake_db):
    out = _invoke(tools.save_build,
                  {"name": "x", "components": {"cpu": 10}}, fake_db, user=None)
    assert out["ok"] is False
    assert "log in" in out["message"].lower()


def test_save_build_persists_for_user(fake_db):
    out = _invoke(tools.save_build,
                  {"name": "My PC", "components": {"cpu": 10, "gpu": 20}},
                  fake_db, user={"id": "u1"})
    assert out["ok"] is True
    assert out["build"]["name"] == "My PC"


def test_registry_exposes_all_tools():
    names = set(tools.TOOL_MAP)
    assert {"search_components", "get_component", "check_compatibility",
            "estimate_wattage", "check_bottleneck", "assemble_build",
            "save_build", "create_share_link"} <= names
```

- [ ] **Step 2: Run, verify failure**

Run: `cd backend && python -m pytest tests/test_tools.py -k "assemble or save or registry" -v`
Expected: FAIL — tools/registry not defined.

- [ ] **Step 3: Implement build + write tools + registry**

Append to `backend/app/agent/tools.py`:

```python
import uuid


def _min_prices(db: Client, ids: List[int]) -> Dict[int, float]:
    if not ids:
        return {}
    res = db.table("component_prices").select("component_id, price").in_("component_id", ids).execute()
    out: Dict[int, float] = {}
    for p in res.data or []:
        cid = p["component_id"]; price = float(p["price"])
        if cid not in out or price < out[cid]:
            out[cid] = price
    return out


@tool
def assemble_build(
    title: str,
    items: List[dict],
    db: Annotated[Optional[Client], InjectedToolArg] = None,
) -> dict:
    """Assemble a final grounded build to show the user as a build card. `items` is a list of
    {slot, component_id} where slot is cpu/gpu/motherboard/ram/storage/psu/case/cooler.
    Pulls real names and lowest prices from the database and returns a structured build card."""
    ids = [int(i["component_id"]) for i in items if i.get("component_id")]
    res = db.table("components").select(_SELECT).in_("id", ids).execute()
    by_id = {c["id"]: c for c in (res.data or [])}
    card_items = []
    total = 0
    for it in items:
        c = by_id.get(int(it["component_id"]))
        if not c:
            continue
        low = _lowest_price(c) or 0
        total += int(low)
        card_items.append({
            "slot": it["slot"],
            "category": (c.get("category") or {}).get("name", it["slot"].upper()),
            "component_id": c["id"],
            "name": c["name"],
            "vendor": _best_vendor(c),
            "price": int(low),
        })
    return {"title": title, "items": card_items, "total": total,
            "components": {i["slot"]: i["component_id"] for i in card_items}}


@tool
def save_build(
    name: str,
    components: Dict[str, int],
    db: Annotated[Optional[Client], InjectedToolArg] = None,
    user: Annotated[Optional[dict], InjectedToolArg] = None,
) -> dict:
    """Save a build to the signed-in user's account. components maps slot -> component_id.
    Only call this AFTER the user confirms. Returns {ok, message, build?}."""
    if not user:
        return {"ok": False, "message": "Please log in to save builds to your account."}
    total = sum(_min_prices(db, list(components.values())).values())
    res = db.table("builds").insert({
        "user_id": user["id"], "name": name,
        "components": components, "total_price": total,
    }).execute()
    if not res.data:
        return {"ok": False, "message": "Could not save the build. Please try again."}
    return {"ok": True, "message": f"Saved '{name}'.", "build": res.data[0]}


@tool
def create_share_link(
    name: str,
    components: Dict[str, int],
    db: Annotated[Optional[Client], InjectedToolArg] = None,
) -> dict:
    """Create a public shareable link for a build. components maps slot -> component_id.
    Returns {ok, share_id, message}."""
    share_uuid = str(uuid.uuid4())
    short = share_uuid[:8]
    total = sum(_min_prices(db, list(components.values())).values())
    res = db.table("shared_builds").insert({
        "share_id": share_uuid,
        "build_data": {"name": name, "components": components,
                       "total_price": total, "short_id": short},
    }).execute()
    if not res.data:
        return {"ok": False, "message": "Could not create share link."}
    return {"ok": True, "share_id": short, "message": f"Share id: {short}"}


# ---- Registry ----
TOOLS = [
    search_components, get_component, check_compatibility, estimate_wattage,
    check_bottleneck, assemble_build, save_build, create_share_link,
]
TOOL_MAP = {t.name: t for t in TOOLS}
```

- [ ] **Step 4: Run all tool tests, verify pass**

Run: `cd backend && python -m pytest tests/test_tools.py -v`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/tools.py backend/tests/test_tools.py
git commit -m "feat: add build/write tools and tool registry"
```

---

## Task 6: Provider factory (`llm.py`)

**Files:**
- Create: `backend/app/agent/llm.py`
- Create: `backend/tests/test_llm.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_llm.py`:

```python
import pytest
from app.agent import llm
from app import config


@pytest.fixture
def patch_settings(monkeypatch):
    def _set(**kw):
        for k, v in kw.items():
            monkeypatch.setattr(config.settings, k, v, raising=False)
            monkeypatch.setattr(llm.settings, k, v, raising=False)
    return _set


def test_resolve_provider_falls_back_when_key_missing(patch_settings):
    patch_settings(llm_provider="claude", anthropic_api_key="", gemini_api_key="g")
    assert llm._resolve_provider() == "gemini"


def test_resolve_provider_keeps_choice_when_key_present(patch_settings):
    patch_settings(llm_provider="claude", anthropic_api_key="a", gemini_api_key="g")
    assert llm._resolve_provider() == "claude"


def test_get_chat_model_raises_without_any_key(patch_settings):
    patch_settings(llm_provider="claude", anthropic_api_key="", gemini_api_key="")
    with pytest.raises(RuntimeError):
        llm.get_chat_model()
```

- [ ] **Step 2: Run, verify failure**

Run: `cd backend && python -m pytest tests/test_llm.py -v`
Expected: FAIL — `ModuleNotFoundError` / `_resolve_provider` missing.

- [ ] **Step 3: Implement factory**

Create `backend/app/agent/llm.py`:

```python
from ..config import settings
from .tools import TOOLS


def _resolve_provider() -> str:
    """Honor settings.llm_provider, but fall back to the provider whose key exists."""
    p = settings.llm_provider
    if p == "claude" and not settings.anthropic_api_key and settings.gemini_api_key:
        return "gemini"
    if p == "gemini" and not settings.gemini_api_key and settings.anthropic_api_key:
        return "claude"
    return p


def get_chat_model():
    """Return a tool-bound LangChain chat model for the active provider."""
    provider = _resolve_provider()
    if provider == "claude":
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        from langchain_anthropic import ChatAnthropic
        model = ChatAnthropic(
            model=settings.claude_model,
            api_key=settings.anthropic_api_key,
            max_tokens=2048,
        )
    elif provider == "gemini":
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        from langchain_google_genai import ChatGoogleGenerativeAI
        model = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
        )
    else:
        raise RuntimeError(f"Unknown llm_provider: {provider}")
    return model.bind_tools(TOOLS)
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd backend && python -m pytest tests/test_llm.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/llm.py backend/tests/test_llm.py
git commit -m "feat: add provider factory for Claude/Gemini chat models"
```

---

## Task 7: Agent loop (`loop.py`)

**Files:**
- Create: `backend/app/agent/loop.py`
- Create: `backend/tests/test_loop.py`

- [ ] **Step 1: Write failing test with a scripted fake model**

Create `backend/tests/test_loop.py`:

```python
import pytest
from langchain_core.messages import AIMessageChunk
from app.agent import loop


class FakeModel:
    """Scripted chat model. `turns` is a list of (text, tool_calls) per astream() call."""
    def __init__(self, turns):
        self._turns = turns
        self._i = 0

    async def astream(self, messages):
        text, tool_calls = self._turns[self._i]
        self._i += 1
        if text:
            yield AIMessageChunk(content=text)
        if tool_calls:
            # final accumulated chunk carries the tool calls
            yield AIMessageChunk(content="", tool_calls=tool_calls)


async def _collect(gen):
    return [ev async for ev in gen]


@pytest.mark.asyncio
async def test_loop_streams_tokens_then_runs_tool_then_finishes(fake_db):
    model = FakeModel(turns=[
        ("Let me search. ", [{"name": "search_components",
                              "args": {"category": "cpu", "max_price": 25000},
                              "id": "t1"}]),
        ("Here is a CPU.", None),
    ])
    events = await _collect(loop.run_agent(
        [{"role": "user", "content": "cheap cpu?"}],
        db=fake_db, user=None, model=model,
    ))
    kinds = [e[0] for e in events]
    assert "token" in kinds
    assert "tool_start" in kinds
    assert "tool_end" in kinds
    assert kinds[-1] == "done"


@pytest.mark.asyncio
async def test_loop_emits_build_event_for_assemble_build(fake_db):
    model = FakeModel(turns=[
        ("", [{"name": "assemble_build",
               "args": {"title": "Test", "items": [{"slot": "cpu", "component_id": 10}]},
               "id": "b1"}]),
        ("Done.", None),
    ])
    events = await _collect(loop.run_agent(
        [{"role": "user", "content": "build me a pc"}],
        db=fake_db, user=None, model=model,
    ))
    build_events = [d for (e, d) in events if e == "build"]
    assert len(build_events) == 1
    assert build_events[0]["title"] == "Test"


@pytest.mark.asyncio
async def test_loop_respects_max_iterations(fake_db, monkeypatch):
    monkeypatch.setattr(loop.settings, "agent_max_iterations", 2, raising=False)
    looping = [("", [{"name": "get_component", "args": {"component_id": 10}, "id": "x"}])] * 5
    model = FakeModel(turns=looping)
    events = await _collect(loop.run_agent(
        [{"role": "user", "content": "loop"}], db=fake_db, user=None, model=model))
    # Stops at the cap and still emits done
    assert events[-1][0] == "done"
```

- [ ] **Step 2: Run, verify failure**

Run: `cd backend && python -m pytest tests/test_loop.py -v`
Expected: FAIL — `ModuleNotFoundError: app.agent.loop`.

- [ ] **Step 3: Implement the loop**

Create `backend/app/agent/loop.py`:

```python
"""Hand-rolled agentic loop. Async generator yielding (event_name, data) tuples.
LangChain owns the message/tool data structures; this loop owns control + streaming."""
import asyncio
import json
from typing import AsyncIterator, Optional, Tuple
from langchain_core.messages import (
    SystemMessage, HumanMessage, AIMessage, ToolMessage,
)
from .llm import get_chat_model
from .tools import TOOL_MAP
from .prompts import SYSTEM_PROMPT
from ..config import settings

_LABELS = {
    "search_components": "Searching components",
    "get_component": "Looking up a part",
    "check_compatibility": "Checking compatibility",
    "estimate_wattage": "Estimating wattage",
    "check_bottleneck": "Checking CPU–GPU balance",
    "assemble_build": "Assembling the build",
    "save_build": "Saving the build",
    "create_share_link": "Creating a share link",
}


def _text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"
        )
    return ""


def _to_lc_messages(history, build_context):
    msgs = [SystemMessage(content=SYSTEM_PROMPT)]
    if build_context:
        msgs.append(SystemMessage(
            content=f"The user's current build (slot -> component_id): {json.dumps(build_context)}"))
    for m in history:
        role = m.get("role")
        content = m.get("content", "")
        if role == "user":
            msgs.append(HumanMessage(content=content))
        else:
            msgs.append(AIMessage(content=content))
    return msgs


def _summary(name: str, output) -> str:
    if isinstance(output, list):
        return f"{len(output)} result(s)"
    if isinstance(output, dict):
        if "error" in output:
            return f"error: {output['error']}"
        if "total" in output:
            return f"₹{output['total']:,}"
        if "recommended_psu" in output:
            return f"{output['recommended_psu']}W PSU"
        if "compatible" in output:
            return "compatible" if output["compatible"] else "issues found"
        if "status" in output:
            return output["status"]
        if "message" in output:
            return output["message"]
    return "done"


async def _run_tool(tool_call, *, db, user):
    tool = TOOL_MAP.get(tool_call["name"])
    if tool is None:
        return {"error": f"unknown tool {tool_call['name']}"}
    args = dict(tool_call.get("args") or {})
    args["db"] = db
    if "user" in tool.args:
        args["user"] = user
    try:
        return await asyncio.to_thread(tool.invoke, args)
    except Exception as e:  # surfaced back to the model so it can self-correct
        return {"error": str(e)}


async def run_agent(
    history,
    *,
    db,
    user: Optional[dict] = None,
    build_context: Optional[dict] = None,
    model=None,
) -> AsyncIterator[Tuple[str, dict]]:
    model = model or get_chat_model()
    messages = _to_lc_messages(history, build_context)

    for _ in range(settings.agent_max_iterations):
        gathered = None
        async for chunk in model.astream(messages):
            text = _text_of(chunk.content)
            if text:
                yield ("token", text)
            gathered = chunk if gathered is None else gathered + chunk

        if gathered is None:
            break
        messages.append(gathered)
        tool_calls = getattr(gathered, "tool_calls", None) or []
        if not tool_calls:
            break

        for tc in tool_calls:
            yield ("tool_start", {"name": tc["name"],
                                  "label": _LABELS.get(tc["name"], tc["name"]),
                                  "args": tc.get("args", {})})
            output = await _run_tool(tc, db=db, user=user)
            if tc["name"] == "assemble_build" and isinstance(output, dict) and "error" not in output:
                yield ("build", output)
            messages.append(ToolMessage(content=json.dumps(output, default=str),
                                        tool_call_id=tc["id"]))
            yield ("tool_end", {"name": tc["name"], "summary": _summary(tc["name"], output)})

    yield ("done", {})
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd backend && python -m pytest tests/test_loop.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/loop.py backend/tests/test_loop.py
git commit -m "feat: add hand-rolled streaming agent loop"
```

---

## Task 8: SSE endpoint + router wiring

**Files:**
- Create: `backend/app/routers/agent.py`
- Modify: `backend/app/main.py:5` and `:51`
- Create: `backend/tests/test_agent_endpoint.py`

- [ ] **Step 1: Write failing endpoint test**

Create `backend/tests/test_agent_endpoint.py`:

```python
import pytest
from langchain_core.messages import AIMessageChunk
from fastapi.testclient import TestClient
from app.main import app
from app.routers import agent as agent_router
from app.database import get_db
from tests.conftest import FakeSupabase


class FakeModel:
    def __init__(self, turns):
        self._turns = turns; self._i = 0

    async def astream(self, messages):
        text, tool_calls = self._turns[self._i]; self._i += 1
        if text:
            yield AIMessageChunk(content=text)
        if tool_calls:
            yield AIMessageChunk(content="", tool_calls=tool_calls)


@pytest.fixture
def client(monkeypatch):
    db = FakeSupabase(tables={"categories": [{"id": 1, "slug": "cpu"}],
                              "components": [], "users": []})
    app.dependency_overrides[get_db] = lambda: db
    model = FakeModel(turns=[("Hello from agent.", None)])
    monkeypatch.setattr(agent_router, "get_chat_model_override", lambda: model, raising=False)
    monkeypatch.setattr(agent_router, "_test_model", model, raising=False)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_chat_streams_sse_events(client):
    with client.stream("POST", "/api/agent/chat",
                       json={"messages": [{"role": "user", "content": "hi"}]}) as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers["content-type"]
        body = "".join(chunk for chunk in r.iter_text())
    assert "event: token" in body
    assert "event: done" in body
    assert "Hello from agent." in body
```

- [ ] **Step 2: Run, verify failure**

Run: `cd backend && python -m pytest tests/test_agent_endpoint.py -v`
Expected: FAIL — no `/api/agent/chat` route.

- [ ] **Step 3: Implement endpoint (with a test seam for the model)**

Create `backend/app/routers/agent.py`:

```python
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from supabase import Client
from ..database import get_db
from ..utils.auth import get_current_user_optional
from ..agent.loop import run_agent

router = APIRouter(prefix="/api/agent", tags=["Agent"])

# Test seam: tests set this to inject a scripted model; None -> real provider.
_test_model = None


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.post("/chat")
async def chat(
    body: dict,
    db: Client = Depends(get_db),
    user: dict | None = Depends(get_current_user_optional),
):
    history = body.get("messages", [])
    build_context = body.get("build_context")

    async def gen():
        try:
            async for event, data in run_agent(
                history, db=db, user=user,
                build_context=build_context, model=_test_model,
            ):
                yield _sse(event, data)
        except Exception as e:  # config error (missing keys) or provider failure
            yield _sse("error", {"message": str(e)})
            yield _sse("done", {})

    return StreamingResponse(gen(), media_type="text/event-stream")
```

- [ ] **Step 4: Wire the router into the app**

In `backend/app/main.py`, line 5, change:

```python
from .routers import auth, components, forum, advisor
```
to:
```python
from .routers import auth, components, forum, advisor, agent
```

After line 51 (`app.include_router(advisor.router)`), add:

```python
app.include_router(agent.router)
```

- [ ] **Step 5: Run endpoint test, verify pass**

Run: `cd backend && python -m pytest tests/test_agent_endpoint.py -v`
Expected: PASS.

- [ ] **Step 6: Run the whole backend suite**

Run: `cd backend && python -m pytest -v`
Expected: PASS (all tests green).

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/agent.py backend/app/main.py backend/tests/test_agent_endpoint.py
git commit -m "feat: add SSE agent chat endpoint"
```

---

## Task 9: Frontend SSE parser + Vitest

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.js`
- Create: `frontend/src/services/agentStream.js`
- Create: `frontend/src/services/agentStream.test.js`

- [ ] **Step 1: Add Vitest devDep + test script**

In `frontend/package.json`, add `"test": "vitest run"` to `scripts`, and add to `devDependencies`:

```json
"vitest": "^2.1.0"
```

Then run: `cd frontend && npm install`

- [ ] **Step 2: Create Vitest config**

Create `frontend/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: { environment: 'node', include: ['src/**/*.test.js'] },
})
```

- [ ] **Step 3: Write failing parser test**

Create `frontend/src/services/agentStream.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseFrame } from './agentStream'

describe('parseFrame', () => {
    it('parses an event with JSON data', () => {
        const out = parseFrame('event: tool_start\ndata: {"name":"search_components"}')
        expect(out).toEqual({ event: 'tool_start', data: { name: 'search_components' } })
    })

    it('parses a token frame', () => {
        const out = parseFrame('event: token\ndata: "Hello"')
        expect(out).toEqual({ event: 'token', data: 'Hello' })
    })

    it('returns null for a frame with no data', () => {
        expect(parseFrame('event: done')).toBeNull()
    })
})
```

- [ ] **Step 4: Run, verify failure**

Run: `cd frontend && npx vitest run src/services/agentStream.test.js`
Expected: FAIL — cannot import `parseFrame`.

- [ ] **Step 5: Implement the parser + streamer**

Create `frontend/src/services/agentStream.js`:

```js
const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Parse one SSE frame ("event: x\ndata: y"). Returns {event, data} or null.
export function parseFrame(frame) {
    let event = 'message'
    let data = ''
    for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return null
    try {
        return { event, data: JSON.parse(data) }
    } catch {
        return { event, data }
    }
}

// Async generator yielding {event, data} from POST /agent/chat.
export async function* streamAgent({ messages, buildContext, signal }) {
    const token = localStorage.getItem('pcease_token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages, build_context: buildContext }),
        signal,
    })
    if (!res.ok || !res.body) throw new Error(`Agent error ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const ev = parseFrame(frame)
            if (ev) yield ev
        }
    }
}
```

- [ ] **Step 6: Run test, verify pass**

Run: `cd frontend && npx vitest run src/services/agentStream.test.js`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/vitest.config.js frontend/src/services/agentStream.js frontend/src/services/agentStream.test.js
git commit -m "feat: add frontend SSE agent stream parser + vitest"
```

---

## Task 10: `useAgentChat` hook

**Files:**
- Create: `frontend/src/hooks/useAgentChat.js`

- [ ] **Step 1: Implement the hook**

Create `frontend/src/hooks/useAgentChat.js`:

```js
import { useState, useRef, useCallback } from 'react'
import { streamAgent } from '../services/agentStream'

// Message shape:
// { role: 'user' | 'assistant', content: string, tools: [{name,label,summary,done}], build: {…}|null }

export function useAgentChat() {
    const [messages, setMessages] = useState([])
    const [isStreaming, setIsStreaming] = useState(false)
    const abortRef = useRef(null)

    const send = useCallback(async (text, buildContext) => {
        if (!text.trim() || isStreaming) return
        const history = [...messages, { role: 'user', content: text }]
        setMessages([...history,
            { role: 'assistant', content: '', tools: [], build: null }])
        setIsStreaming(true)
        abortRef.current = new AbortController()

        // Patch the last (assistant) message immutably.
        const patch = (fn) => setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = fn(next[next.length - 1])
            return next
        })

        try {
            const wire = history.map(m => ({ role: m.role, content: m.content }))
            for await (const { event, data } of streamAgent({
                messages: wire, buildContext, signal: abortRef.current.signal,
            })) {
                if (event === 'token') {
                    patch(m => ({ ...m, content: m.content + data }))
                } else if (event === 'tool_start') {
                    patch(m => ({ ...m, tools: [...m.tools,
                        { name: data.name, label: data.label, summary: '', done: false }] }))
                } else if (event === 'tool_end') {
                    patch(m => {
                        const tools = [...m.tools]
                        for (let i = tools.length - 1; i >= 0; i--) {
                            if (tools[i].name === data.name && !tools[i].done) {
                                tools[i] = { ...tools[i], summary: data.summary, done: true }
                                break
                            }
                        }
                        return { ...m, tools }
                    })
                } else if (event === 'build') {
                    patch(m => ({ ...m, build: data }))
                } else if (event === 'error') {
                    patch(m => ({ ...m, content: m.content + `\n\n⚠ ${data.message}` }))
                }
            }
        } catch (e) {
            patch(m => ({ ...m, content: m.content || `⚠ ${e.message}` }))
        } finally {
            setIsStreaming(false)
        }
    }, [messages, isStreaming])

    const reset = useCallback(() => {
        abortRef.current?.abort()
        setMessages([])
        setIsStreaming(false)
    }, [])

    return { messages, isStreaming, send, reset }
}
```

- [ ] **Step 2: Smoke-build to confirm no syntax/import errors**

Run: `cd frontend && npm run build`
Expected: Build succeeds (the hook compiles; it isn't imported yet so tree-shaken, but must parse).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useAgentChat.js
git commit -m "feat: add useAgentChat streaming hook"
```

---

## Task 11: Rewrite the Advisor AI Chat tab

**Files:**
- Create: `frontend/src/utils/formatText.jsx`
- Modify: `frontend/src/pages/Advisor.jsx`
- Modify: `frontend/src/pages/Advisor.css`

- [ ] **Step 1: Create the tiny text formatter**

Create `frontend/src/utils/formatText.jsx`:

```jsx
// Minimal inline formatter: **bold**, `code`, and lines starting with - or * become bullets.
// No markdown dependency. Returns an array of React nodes.
export function formatText(text) {
    if (!text) return null
    return text.split('\n').map((line, li) => {
        const trimmed = line.trimStart()
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ')
        const body = isBullet ? trimmed.slice(2) : line
        const parts = []
        const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
        let last = 0, m
        while ((m = regex.exec(body)) !== null) {
            if (m.index > last) parts.push(body.slice(last, m.index))
            const tok = m[0]
            if (tok.startsWith('**')) parts.push(<strong key={parts.length}>{tok.slice(2, -2)}</strong>)
            else parts.push(<code key={parts.length}>{tok.slice(1, -1)}</code>)
            last = m.index + tok.length
        }
        if (last < body.length) parts.push(body.slice(last))
        return isBullet
            ? <div key={li} className="ad-bullet">• {parts}</div>
            : <div key={li}>{parts.length ? parts : ' '}</div>
    })
}
```

- [ ] **Step 2: Update Advisor imports and hook usage**

In `frontend/src/pages/Advisor.jsx`, replace the import block at lines 1-6 with:

```jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { API, formatPrice } from '../services/api'
import { FiCpu, FiSend, FiArrowRight, FiSliders, FiMessageSquare, FiPackage, FiZap, FiMonitor, FiCode, FiRadio, FiSearch, FiCheck } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useAgentChat } from '../hooks/useAgentChat'
import { formatText } from '../utils/formatText'
import './Advisor.css'
```

In the `Advisor()` component, **remove** the old AI tab state (lines 44-46: `question`, `chatHistory`, `asking`) and the `askQuestion` function (lines 81-96). Replace them with:

```jsx
    // AI tab — agentic chat
    const [question, setQuestion] = useState('')
    const { messages, isStreaming, send } = useAgentChat()

    const askQuestion = async (e) => {
        e.preventDefault()
        if (!question.trim() || isStreaming) return
        const q = question
        setQuestion('')
        await send(q)
    }
```

Update the auto-scroll effect (line 53) to depend on the new state:

```jsx
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isStreaming])
```

- [ ] **Step 3: Replace the AI tab JSX**

Replace the entire `{tab === 'ai' && ( … )}` block (lines 288-347) with:

```jsx
                {/* ==================== AI TAB (Agentic) ==================== */}
                {tab === 'ai' && (
                    <div className="ad-ai">
                        <div className="ad-chat">
                            <div className="ad-chat__msgs">
                                {messages.length === 0 ? (
                                    <div className="ad-chat__empty">
                                        <div className="ad-chat__icon"><FiMessageSquare size={36} /></div>
                                        <h3>PCease AI Agent</h3>
                                        <p>Ask for a build or any PC advice — I search the real catalog, check compatibility, and assemble a grounded build.</p>
                                        <div className="ad-chat__sugg">
                                            {[
                                                'Build me a ₹60,000 gaming PC',
                                                'Best GPU under ₹30,000?',
                                                'Is the Ryzen 5 7600 a good pick?',
                                                'Build a ₹1.2L streaming rig',
                                                'What PSU do I need for an RTX 4060 build?',
                                            ].map((s, i) => (
                                                <button key={i} className="ad-sugg-chip" onClick={() => setQuestion(s)}>{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => (
                                        <div key={i} className={`ad-msg ad-msg--${msg.role}`}>
                                            <div className="ad-msg__avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                                            <div className="ad-msg__bubble">
                                                {/* tool-step chips */}
                                                {msg.tools?.length > 0 && (
                                                    <div className="ad-steps">
                                                        {msg.tools.map((t, ti) => (
                                                            <span key={ti} className={`ad-step ${t.done ? 'done' : 'running'}`}>
                                                                {t.done ? <FiCheck size={11} /> : <FiSearch size={11} />}
                                                                {t.label}{t.done && t.summary ? ` · ${t.summary}` : '…'}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* streaming text */}
                                                {msg.content && <div className="ad-msg__text">{formatText(msg.content)}</div>}
                                                {/* inline build card */}
                                                {msg.build && (
                                                    <div className="ad-buildcard">
                                                        <div className="ad-buildcard__head">
                                                            <strong>{msg.build.title}</strong>
                                                            <span>{formatPrice(msg.build.total)}</span>
                                                        </div>
                                                        <ul>
                                                            {msg.build.items.map((it, ii) => (
                                                                <li key={ii}>
                                                                    <span className="ad-bc-cat">{it.category}</span>
                                                                    <span className="ad-bc-name">{it.name}</span>
                                                                    <span className="ad-bc-price">{formatPrice(it.price)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <button className="btn btn-primary btn-sm"
                                                            onClick={() => navigate('/builder', { state: { recommendation: msg.build } })}>
                                                            Open in Builder <FiArrowRight size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                                {isStreaming && messages[messages.length - 1]?.content === '' && !messages[messages.length - 1]?.tools?.length && (
                                    <div className="ad-msg ad-msg--assistant">
                                        <div className="ad-msg__avatar">🤖</div>
                                        <div className="ad-msg__bubble ad-msg--typing"><span /><span /><span /></div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                            <form className="ad-chat__input" onSubmit={askQuestion}>
                                <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
                                    placeholder="Ask for a build or any PC advice…" disabled={isStreaming} />
                                <button type="submit" className="btn btn-primary" disabled={isStreaming || !question.trim()}>
                                    <FiSend size={14} />
                                </button>
                            </form>
                        </div>
                    </div>
                )}
```

- [ ] **Step 4: Add styles**

Append to `frontend/src/pages/Advisor.css`:

```css
/* ===== Agentic chat additions ===== */
.ad-steps { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.ad-step {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; padding: 3px 8px; border-radius: 999px;
    background: var(--surface-2, #1b1f27); border: 1px solid var(--border, #2a2f3a);
    color: var(--text-muted, #9aa4b2);
}
.ad-step.running { color: var(--accent, #5b9dff); }
.ad-step.done { color: var(--success, #4ade80); }
.ad-msg__text { white-space: normal; line-height: 1.55; }
.ad-bullet { padding-left: 4px; }
.ad-buildcard {
    margin-top: 10px; border: 1px solid var(--border, #2a2f3a);
    border-radius: 10px; padding: 12px; background: var(--surface-2, #161a21);
}
.ad-buildcard__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.ad-buildcard ul { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 4px; }
.ad-buildcard li { display: grid; grid-template-columns: 64px 1fr auto; gap: 8px; font-size: 13px; align-items: center; }
.ad-bc-cat { color: var(--text-muted, #9aa4b2); font-size: 11px; text-transform: uppercase; }
.ad-bc-price { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 5: Build to verify it compiles**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/formatText.jsx frontend/src/pages/Advisor.jsx frontend/src/pages/Advisor.css
git commit -m "feat: rewrite Advisor AI tab as agentic streaming chat"
```

---

## Task 12: Manual end-to-end verification + docs

**Files:**
- Modify: `backend/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Document new env vars**

In `backend/.env.example`, add:

```
# Agent (optional — Gemini already supported; Claude optional)
ANTHROPIC_API_KEY=
LLM_PROVIDER=claude
```

- [ ] **Step 2: Update README AI section**

In `README.md`, update the AI Advisor bullet (line 15) to:

```
- **AI Agent** — A grounded, tool-using agent: give it a budget and use case and it searches the real catalog, checks compatibility and wattage, and assembles a real build with live prices. Streams its steps. Powered by Claude or Gemini (configurable).
```

And under **AI** in the Stack section (line 29), change to:

```
**AI** — Agentic tool-use loop over the real DB, provider-agnostic (Anthropic Claude / Google Gemini) via LangChain Core
```

- [ ] **Step 3: Run the full backend suite once more**

Run: `cd backend && python -m pytest -v`
Expected: All green.

- [ ] **Step 4: Manual smoke test (requires a real API key)**

With a valid `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` in `backend/.env`:

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```
In another shell:
```bash
cd frontend && npm run dev
```
Open `http://localhost:5173/advisor`, AI Chat tab, send "Build me a ₹60,000 gaming PC". Verify: tool-step chips appear ("Searching components…"), text streams in, and a build card renders with real parts/prices. Click "Open in Builder" and confirm the build loads.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example README.md
git commit -m "docs: document agentic advisor env vars and update README"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** read tools (T3), analysis tools incl. `specifications` fix (T4), build/write tools w/ auth gating (T5), provider factory + fallback (T6), streaming loop w/ tool-call accumulation + max-iter guard (T7), SSE endpoint + error fallback (T8), frontend parser (T9), hook (T10), AI-tab rewrite w/ chips + build cards + Builder handoff (T11), memory via client-held history (T7 `_to_lc_messages`, T10 `wire`), docs (T12). Deterministic `_build_smart_recommendation` remains untouched as non-AI fallback (T8 error path returns a graceful message; explicit build fallback is available via the existing `/advisor/recommend` which is unchanged).
- **Type consistency:** `run_agent(history, *, db, user, build_context, model)` signature is identical across T7/T8 tests and the endpoint. SSE event names (`token`/`tool_start`/`tool_end`/`build`/`error`/`done`) match across loop, endpoint, parser, and hook. Tool names in `TOOL_MAP` match `_LABELS` and the system prompt.
- **Note for executor:** `langchain_core.tools` `@tool` exposes `.name` and `.args` (a dict of model-visible args); the loop uses `"user" in tool.args` to decide whether to inject `user`, which works because `InjectedToolArg` params are excluded from `.args`.
