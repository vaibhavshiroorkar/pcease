# PCease — Session Handoff

_Last updated: 2026-06-01_

A snapshot of where the project stands so anyone (human or agent) can pick up cleanly.

## TL;DR

PCease was turned into an **agentic AI project**: a grounded, tool-using AI agent that builds
real PCs from the live catalog, plus a full visual redesign, a security/correctness pass, an
in-memory dummy DB for local dev, and a price-history graph. All work is on a feature branch,
not yet merged.

## Git state

- **Branch:** `feat/agentic-build-advisor` (**32 commits ahead of `main`**, not merged)
- **HEAD:** `b518964 docs: actually simplify README; move API + schema into DEVELOPMENT.md`
- **`main` is at:** `36d0ef1` (pre-agent baseline)
- **Working tree:** clean
- **Not yet done:** no PR opened; branch not merged to `main`.

## How to run locally

Both servers are currently **up** (backend `:8000` healthy, frontend `:5173`).

```bash
# Backend (Python 3.13 venv already created at backend/.venv)
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev   # http://localhost:5173
```

**No cloud accounts needed:** `backend/.env` has `USE_FAKE_DB=true`, which serves an in-memory
seeded catalog (8 categories, 6 vendors, 18 components). `/health` is green. State resets on
restart. The only thing the dummy DB can't do is the **live AI agent chat** — that needs a real
`ANTHROPIC_API_KEY` (or `GEMINI_API_KEY` + `LLM_PROVIDER=gemini`) in `backend/.env`.

> Windows note: invoke the venv Python by its **absolute path** when launching as a background
> task — relative `./.venv/...` has failed to resolve in this environment.

## Tests

- Backend: `cd backend && .venv/Scripts/python.exe -m pytest -q` → **20 passing**
- Frontend: `cd frontend && npm run test` → vitest (SSE parser)
- Frontend build: `npm run build` → clean

## What was built this project

1. **The AI agent (the headline feature).** Replaced two stateless, hallucinating Gemini prompts
   with a grounded tool-use agent over the real DB.
   - `backend/app/agent/`: `tools.py` (8 tools), `loop.py` (hand-rolled streaming loop),
     `llm.py` (Claude/Gemini factory), `prompts.py`.
   - `POST /api/agent/chat` streams SSE; frontend consumes via `services/agentStream.js` +
     `hooks/useAgentChat.js`, rendered in the Advisor "AI Chat" tab (tool-step chips + build cards).
   - Design + plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.
2. **Whole-app visual redesign** — "Performance Instrument" identity (near-black + volt-lime,
   Chakra Petch/Sora/JetBrains Mono, blueprint grid). Home hero has an animated agent console.
3. **Security/correctness/robustness pass** (commit `26f614f`) — see "Known issues" for what's
   intentionally left.
4. **In-memory dummy DB** (`backend/app/fake_db.py`, `USE_FAKE_DB`).
5. **Price-history graph** (`components/PriceGraph.jsx` + `/api/components/:id/price-history`)
   in the Browse and Builder modals, with Day/Week/Month, a time axis, and a hover tooltip.
6. **Docs split** — `README.md` (simple, human) and `DEVELOPMENT.md` (all technical detail).

## Conventions to respect

- **Mirror component UI across Browse and Builder.** The component detail UI is duplicated in
  `frontend/src/pages/Browse.jsx` (detail modal) and `frontend/src/pages/Builder.jsx` (retailer
  view). Any change to specs/price-graph/badges/actions must go in **both**. (Documented in
  DEVELOPMENT.md; there's a saved memory about this.)
- Keep prices grounded — never show invented prices outside the agent's labelled output.
- Specs render as cards (mono label + bold value).

## Known issues / deliberately deferred

- **Price history is generated, not real.** The endpoint anchors a deterministic series to the
  current price. Real fix: a daily job snapshotting `component_prices` → a `price_history` table;
  then read from it (frontend unchanged).
- **Legacy `_build_smart_recommendation`** (Manual tab) picks best-per-category and does **not**
  cross-check CPU/motherboard sockets, so it can pair e.g. an Intel CPU with an AM5 board. The
  **agent** path does run compatibility checks. Worth unifying.
- **No self-service password reset** — the old username+email reset was an account-takeover
  vector and was removed; "Forgot password?" points to Contact. Add an emailed-token flow when
  email exists.
- **JWT in `localStorage`** (XSS tradeoff) — consider httpOnly cookies.
- **Browse loads up to 500 components** in one payload — pagination/virtualization would help.
- **Manual cascade deletes** in `auth.py` — prefer DB `ON DELETE CASCADE`.
- **Other pages not bespoke-redesigned** — Browse/Builder/Compare/Forum are re-themed via tokens
  but not individually polished like Home/Advisor.
- **No CI**; legacy routers (`auth`, `forum`, parts of `advisor`) have thin/no tests.

## Suggested next steps

1. Open a PR / merge `feat/agentic-build-advisor` → `main` (or use `finishing-a-development-branch`).
2. Add the real `price_history` snapshot job.
3. Give `_build_smart_recommendation` a socket-compatibility check (or route Manual through the agent tools).
4. Bespoke-redesign Browse/Builder/Compare/Forum to match Home/Advisor.
5. Add CI (run pytest + vitest + build on PR).
