# PCease - Developer Guide

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
seeded database (8 categories, 9 vendors, ~423 components with prices, generated
deterministically in `fake_db.py`). State resets
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
| `SECRET_KEY` | JWT signing key. **Required** in prod - the app refuses to start with `DEBUG=false` if it's still the default. |
| `DEBUG` | `false` in production (enables the SECRET_KEY check) |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | LLM for the agent |
| `LLM_PROVIDER` | `claude` or `gemini` (auto-falls back to whichever key exists) |
| `USE_FAKE_DB` | `true` for the in-memory dummy DB (local only) |

## The AI agent

A grounded, tool-using agent - not a single prompt.

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
- points are generated deterministically (stable per component) and anchored to the current
price. To make it real, add a daily job that snapshots `component_prices` into a
`price_history` table and read from that in the endpoint; the frontend needs no change.

## Social layer

Public/private builds, a community feed, public profiles, likes, private favourites, and
following. Designed to work against both Supabase and the in-memory fake DB (no PostgREST
joins; `routers/social.py` enriches in Python).

- **Schema additions** (`social_migration.sql`): `users.bio/avatar_url/favorites_public`;
  `builds.is_public/slug/likes_count`; tables `build_likes`, `build_favorites`, `user_follows`.
- **Visibility:** builds are **private by default**; owner toggles public. Public builds render
  live (no snapshot). Legacy anonymous share links are unchanged.
- **Likes vs favourites:** a **like** is a public heart + `likes_count`; a **favourite** is a
  private bookmark, exposed on the profile only when `favorites_public` is on.
- **Avatars** are uploaded client-side, downscaled to a 256px JPEG **data URL**
  (`imageToAvatarDataUrl` in `services/api.js`), and stored on `users.avatar_url` - works with
  no object storage in either backend. Colored-initial fallback via `components/Avatar.jsx`.
- **Key endpoints:** `GET /builds/public` (feed: `sort=recent|popular`, `scope=all|following`),
  `GET /builds/slug/{slug}`, `PATCH /builds/{id}`, `POST/DELETE /builds/{id}/like`,
  `POST/DELETE /builds/{id}/favorite`, `GET /me/favorites`, `GET /users/{username}`,
  `POST/DELETE /users/{username}/follow`. Profiles never expose email.
- **Frontend:** `pages/Community.jsx` (`/builds`), `pages/BuildDetail.jsx` (`/build/:slug`),
  `pages/PublicProfile.jsx` (`/u/:username`), plus the reworked Profile (My Builds + Favourites)
  and a public/private toggle in the Builder. Shared `components/BuildCard.jsx`.
- **Demo accounts (fake DB only):** `alishbuilds`, `rajrenders`, `miraITX`, all password
  `demo1234`, seeded with public builds so the feed/profiles aren't empty locally.
- **Sign-in:** "Keep me signed in" picks `localStorage` vs `sessionStorage` for the JWT;
  login accepts username **or** email.
- **Bugfix shipped here:** JWT `sub` was encoded as an int, which python-jose rejects on decode
  ("Subject must be a string") - it's now `str(user["id"])` in `auth.login`. This had broken all
  authenticated requests.

## Conventions

- **Catalogue cards are shared: `components/PartCard.jsx`.** Browse and Watchlist render their
  box (grid) and rectangular (list) cards through this one component (`pc-*` classes,
  `.pc-grid` / `.pc-list` containers). Change the card once and both pages stay consistent - do
  NOT re-introduce per-page card markup. (The old `br-card*` / `wl-card*` styles are retired;
  only the Browse loading skeletons still use `br-card` / `br-list-item`.)
- **Mirror component UI across Browse and Builder.** The component *detail* UI (the modal /
  retailer view, not the card) still exists in BOTH `pages/Browse.jsx` and `pages/Builder.jsx`.
  Any change to how a component's detail is presented - specs layout, the price graph, badges,
  actions - must be applied to BOTH. (If this keeps happening, extract a shared `<ComponentDetail>`.)
- **Spec columns are shared: `services/specColumns.js`.** This is the single source of truth for
  which specs matter per category (`SPEC_PRIORITY` / `columnsForCategory`), plus the pure
  sort/filter helpers (`parseSpecNum`, `inferColumnType`, `distinctValues`, `compareValues`,
  unit-tested in `specColumns.test.js`). Both `PartCard` (card key-specs) and `SpecTable` (Browse
  Advanced columns) import from it, so the two never drift. Add a category's specs here, not in a
  component.
- **Browse has Simple / Advanced modes.** Simple is the card view (grid/list via `PartCard`);
  Advanced renders the connected `components/SpecTable.jsx` (category-aware columns, header sort).
  The chosen mode is persisted in `localStorage` under `pcease_browse_mode`. Filtering lives in a
  collapsible left **filter sidebar** owned by `Browse.jsx` (brand/price/in-stock + per-spec
  numeric/categorical filters via `specColumns.applySpecFilters`); `SpecTable` only sorts and
  renders the already-filtered `items`.
- **Compare is one unified table** (`pages/Compare.jsx`): each component is a column, specs are
  rows. There is no separate card view. Add a row/spec by editing the single table render.
- **Guide is a section switcher** (`pages/Guide.jsx`): the sidebar sets `active` and only that one
  section renders (no long scroll, no scrollspy).
- **Advisor uses a split layout** (`pages/Advisor.jsx`): selectors/inputs on the left, a shared
  `BuildPanel` on the right for all three tabs. "Show build" sets the right panel; "Use build"
  routes to the Builder via `navigate('/builder', { state: { recommendation } })`.
- **Component specs come back as `specifications`** from the API, but the UI reads `item.specs`.
  `services/api.js` normalizes `specifications -> specs` for component-returning endpoints
  (`getComponents`, `getComponent`, `compareComponents`, `getWatchlist`). Read `item.specs`
  in the frontend; do not reintroduce `specifications` reads in new code.
- **Discussions are Reddit-style threaded** (`components/Discussions.jsx`): replies nest via
  `parent_reply_id`, rendered as a collapsible tree with reply-to-comment. The backend
  (`routers/forum.py`) validates the parent belongs to the thread.
- **Account deletion anonymizes, it does not purge** (`routers/auth.py::_anonymize_user`): the
  user is tombstoned (`is_deleted=true`, scrubbed email/username/password) but their threads,
  replies, and builds are kept; the forum shows them as `[deleted]`. New schema columns
  (`forum_replies.parent_reply_id`, `users.is_deleted`) ship in
  `backend/forum_followup_migration.sql` - run it on Supabase. Note: the fake DB has no
  relational embeds, so forum author names only resolve on real Supabase.
- **Theme = CSS variables in `styles/global.css`.** The accent is currently electric blue
  (`--accent`/`--volt` = `#3b9dff`); the base is a softened charcoal (`--bg` `#15171c`). When
  changing the theme, also update static assets that can't read the tokens: **`public/favicon.svg`**
  (the bar marks) and the `theme-color` meta in `index.html`. Grep the old hex (and its `r,g,b`
  form) across CSS for stragglers. The previous near-black palette is snapshotted to
  **`styles/global.dark-backup.css`** (never imported); to restore it, copy that file back over
  `global.css`.
- Specs render as cards: mono uppercase label + bold value (`br-specs__item` / `bd-spec`).
- Keep prices grounded - never display invented/LLM-generated prices outside the agent's
  clearly-labelled output.
- **No em dashes (`—`) anywhere** - not in UI copy, comments, docs, commit messages, or
  agent/LLM output. Use a comma, colon, parentheses, or a spaced hyphen (` - `) instead; use a
  plain hyphen (`-`) for empty-value placeholders in tables. This keeps the writing from reading
  as machine-generated. (One-time cleanup removed 131 of them across the codebase.)

## Testing

```bash
cd backend && .venv/Scripts/python.exe -m pytest -q     # backend (pytest + pytest-asyncio)
cd frontend && npm run test                              # frontend (vitest)
```

The backend tests use an in-memory fake Supabase fixture (`tests/conftest.py`) and a
scripted fake chat model for the agent loop - no network or keys needed.

## Security notes

- `SECRET_KEY` must be set in prod (startup guard when `DEBUG=false`).
- Auth has in-memory rate limiting (`utils/ratelimit.py`) on login/register.
- There is **no self-service password reset** (the old username+email reset was an
  account-takeover vector and was removed). Add a proper emailed-token flow when email exists.
- JWTs are stored in `localStorage` (XSS tradeoff) - consider httpOnly cookies later.

## API reference

Full interactive docs at `/docs` (Swagger) or `/redoc` when the server runs. Overview:

**Components**
- `GET /api/categories` - all categories
- `GET /api/components` - list with filters (`category`, `brand`, `search`, `sort`, `skip`, `limit`)
- `GET /api/components/{id}` - single component + vendor prices
- `GET /api/components/{id}/price-history?range=day|week|month` - lowest-price time series
- `POST /api/compare` - compare up to 4 components `{ "ids": [1, 2, 3] }`
- `GET /api/vendors` - tracked vendors
- `GET /api/stats` - platform counts

**Builds** *(✓ = auth required)*
- `GET /api/builds` ✓ · `POST /api/builds` ✓ · `DELETE /api/builds/{id}` ✓
- `POST /api/builds/share` - shareable link · `GET /api/builds/shared/{share_id}` - load shared

**Auth**
- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` ✓
- (no password reset - see Security notes)

**Forum** *(auth for writes)*
- `GET /api/forum/threads` · `GET /api/forum/threads/{id}`
- `POST /api/forum/threads` ✓ · `POST /api/forum/threads/{id}/replies` ✓ · `POST /api/forum/threads/{id}/vote` ✓

**AI**
- `POST /api/agent/chat` - grounded tool-using agent, streamed over SSE (preferred)
- `POST /api/advisor/recommend` - deterministic grounded build (Manual tab)
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
