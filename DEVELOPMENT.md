# PCease — Developer Guide

Technical notes for working on PCease. For the friendly overview, see [README.md](README.md).

## Stack

- **Frontend:** React 18 + Vite 5 (plain JS, one CSS file per page). No UI framework.
- **Backend:** FastAPI (Python 3.11 in prod; 3.13 works locally).
- **Database:** Supabase (Postgres + PostgREST). An in-memory fake is available for local dev.
- **AI agent:** LangChain Core as a *library* (not a runtime) over Anthropic Claude / Google Gemini.
- **Hosting:** Frontend on Vercel, backend on Render, DB on Supabase.

## Repo layout

```
backend/
  app/
    routers/      auth, components, forum, advisor (legacy), agent (SSE)
    agent/        tools.py, loop.py, llm.py, prompts.py  (the AI agent)
    fake_db.py    in-memory seeded DB for local testing
    config.py     settings (pydantic-settings)
  tests/          pytest suite
frontend/
  src/
    pages/        Home, Browse, Builder, Advisor, Compare, Forum, ...
    components/    Navbar, Footer, PriceGraph, ErrorBoundary
    services/      api.js (REST), agentStream.js (SSE)
    hooks/         useAgentChat.js
docs/superpowers/ design specs + implementation plans
```

## Local development

### Backend
```bash
cd backend
py -3.13 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

No Supabase? Set `USE_FAKE_DB=true` in `backend/.env` to run against an in-memory
seeded database (8 categories, 6 vendors, 18 components with prices). State resets
on restart. Everything except the live LLM chat works without any cloud keys.

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run test         # vitest
```

Point the frontend at the backend with `frontend/.env`: `VITE_API_URL=http://localhost:8000/api`.

## Environment variables (backend/.env)

| Var | Purpose |
|-----|---------|
| `SUPABASE_URL` / `SUPABASE_KEY` / `SUPABASE_SERVICE_KEY` | Supabase connection |
| `SECRET_KEY` | JWT signing key. **Required** in prod — the app refuses to start with `DEBUG=false` if it's still the default. |
| `DEBUG` | `false` in production (enables the SECRET_KEY check) |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | LLM for the agent |
| `LLM_PROVIDER` | `claude` or `gemini` (auto-falls back to whichever key exists) |
| `USE_FAKE_DB` | `true` for the in-memory dummy DB (local only) |

## The AI agent

A grounded, tool-using agent — not a single prompt.

- **Tools** (`agent/tools.py`): `search_components`, `get_component`, `check_compatibility`,
  `estimate_wattage`, `check_bottleneck`, `assemble_build`, `save_build`, `create_share_link`.
  All read the real DB; `db`/`user` are injected (hidden from the model).
- **Loop** (`agent/loop.py`): hand-rolled async generator that streams tokens, runs tool
  calls, and yields typed events. Provider-agnostic via `llm.py`.
- **Transport:** `POST /api/agent/chat` returns Server-Sent Events
  (`token`, `tool_start`, `tool_end`, `build`, `error`, `done`). Frontend consumes via
  `services/agentStream.js` + `hooks/useAgentChat.js`.
- **Auth:** anonymous users can chat (read tools); write tools require login.

## Price history

`GET /api/components/:id/price-history?range=day|week|month` returns a lowest-price
time series, consumed by `components/PriceGraph.jsx`. **Real history is not captured yet**
— points are generated deterministically (stable per component) and anchored to the current
price. To make it real, add a daily job that snapshots `component_prices` into a
`price_history` table and read from that in the endpoint; the frontend needs no change.

## Conventions

- **Mirror component UI across Browse and Builder.** The component detail UI exists in BOTH
  `pages/Browse.jsx` (detail modal) and `pages/Builder.jsx` (retailer view). Any change to how
  a component is presented — specs layout, the price graph, badges, actions — must be applied
  to BOTH. They are not shared components yet, so it's easy to update one and forget the other.
  (If this keeps happening, extract a shared `<ComponentDetail>`.)
- Specs render as cards: mono uppercase label + bold value (`br-specs__item` / `bd-spec`).
- Keep prices grounded — never display invented/LLM-generated prices outside the agent's
  clearly-labelled output.

## Testing

```bash
cd backend && .venv/Scripts/python.exe -m pytest -q     # backend (pytest + pytest-asyncio)
cd frontend && npm run test                              # frontend (vitest)
```

The backend tests use an in-memory fake Supabase fixture (`tests/conftest.py`) and a
scripted fake chat model for the agent loop — no network or keys needed.

## Security notes

- `SECRET_KEY` must be set in prod (startup guard when `DEBUG=false`).
- Auth has in-memory rate limiting (`utils/ratelimit.py`) on login/register.
- There is **no self-service password reset** (the old username+email reset was an
  account-takeover vector and was removed). Add a proper emailed-token flow when email exists.
- JWTs are stored in `localStorage` (XSS tradeoff) — consider httpOnly cookies later.

## API reference

Full interactive docs at `/docs` (Swagger) or `/redoc` when the server runs. Overview:

**Components**
- `GET /api/categories` — all categories
- `GET /api/components` — list with filters (`category`, `brand`, `search`, `sort`, `skip`, `limit`)
- `GET /api/components/{id}` — single component + vendor prices
- `GET /api/components/{id}/price-history?range=day|week|month` — lowest-price time series
- `POST /api/compare` — compare up to 4 components `{ "ids": [1, 2, 3] }`
- `GET /api/vendors` — tracked vendors
- `GET /api/stats` — platform counts

**Builds** *(✓ = auth required)*
- `GET /api/builds` ✓ · `POST /api/builds` ✓ · `DELETE /api/builds/{id}` ✓
- `POST /api/builds/share` — shareable link · `GET /api/builds/shared/{share_id}` — load shared

**Auth**
- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` ✓
- (no password reset — see Security notes)

**Forum** *(auth for writes)*
- `GET /api/forum/threads` · `GET /api/forum/threads/{id}`
- `POST /api/forum/threads` ✓ · `POST /api/forum/threads/{id}/replies` ✓ · `POST /api/forum/threads/{id}/vote` ✓

**AI**
- `POST /api/agent/chat` — grounded tool-using agent, streamed over SSE (preferred)
- `POST /api/advisor/recommend` — deterministic grounded build (Manual tab)
- `GET /api/advisor/templates` · `POST /api/advisor/wattage` · `POST /api/advisor/bottleneck`

## Database schema

```
categories        id · slug · name · description · icon
vendors           id · slug · name · url · logo_url
components        id · category_id · name · brand · model · specifications (jsonb) · image_url
component_prices  id · component_id · vendor_id · price · currency · url · in_stock
builds            id · user_id · name · components (jsonb) · total_price · created_at
shared_builds     id · share_id · build_data (jsonb) · created_at
users             id · username · email · hashed_password · is_active · is_admin · created_at
forum_threads     id · author_id · title · content · category · created_at
forum_replies     id · thread_id · author_id · content · created_at
forum_votes       id · thread_id · user_id · vote_type
```

Migration + seed: run `backend/supabase_migration.sql` in Supabase, then `python backend/seed_supabase.py`.

## Deploying

- **Backend (Render):** root `backend`, build `pip install -r requirements.txt`,
  start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set all `backend/.env` vars
  (including `DEBUG=false` and a real `SECRET_KEY`).
- **Frontend (Vercel):** root `frontend`, framework Vite, build `npm run build` → `dist`,
  set `VITE_API_URL` to the Render backend URL.
- **Database (Supabase):** free tier is fine; the service key handles server-side writes.
