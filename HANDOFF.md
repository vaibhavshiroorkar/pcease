# PCease - Session Handoff

_Last updated: 2026-06-03_

A snapshot of where the project stands so anyone (human or agent) can pick up cleanly.

## Latest session (2026-06-03): Softer theme, Browse Advanced table, Compare alignment

On branch `feat/ux-watchlist-community`. Frontend build clean; vitest **13 pass**.
Design + plan: `docs/superpowers/specs/2026-06-03-browse-advanced-table-design.md`
and `docs/superpowers/plans/2026-06-03-browse-advanced-table.md`.

- **Softer dark theme.** Lifted the near-black palette to charcoal in
  `styles/global.css` (`--bg` `#0a0b0d` -> `#15171c`, surfaces/text eased) to cut
  eye-strain while keeping the "Performance Instrument" identity (accent blue
  unchanged). The exact previous palette is snapshotted to
  **`styles/global.dark-backup.css`** (never imported); restore by copying it back
  over `global.css`.
- **Browse Simple / Advanced toggle.** New top-level toggle in the toolbar,
  defaults to **Simple** (today's grid/list cards, untouched), persisted to
  `localStorage` (`pcease_browse_mode`). **Advanced** renders a new connected
  **`components/SpecTable.jsx`**: one aligned table with category-aware spec
  columns, click-to-sort headers, and smart per-column filters (numeric specs get
  min/max, categorical specs get multi-select). "All" category shows base columns
  plus a "pick a category" hint. Rows open the existing detail modal.
- **Shared column config.** `services/specColumns.js` is now the single source of
  truth for which specs matter per category (with `parseSpecNum`/`inferColumnType`/
  `compareValues`/`distinctValues`, unit-tested in `specColumns.test.js`).
  `PartCard` imports `SPEC_PRIORITY` from it, so cards and the table never drift.
- **Compare alignment fixed.** Card view no longer renders independent per-card
  collapsible specs (which did not line up). Specs now render once in the
  connected `SpecsComparisonTable` placed directly under the cards, with
  `table-layout: fixed` equal component columns so each spec reads straight across.
- **Not yet done:** the follow-up Community spec (Reddit-style threaded
  discussions + account deletion that keeps and anonymizes posts as `[deleted]`)
  is agreed but not started. Manual browser pass on the new table interactions
  still worth a human eyeball.

## Latest session (2026-06-03): Blue theme, shared cards, UX round

On branch `feat/ux-watchlist-community`. Frontend build + vitest clean; backend **38 tests pass**.

- **Theme switched volt-lime -> electric blue** (`--accent`/`--volt` = `#3b9dff`) in
  `styles/global.css`, plus every hardcoded `rgb(198,242,78)` across CSS and the
  **`public/favicon.svg`** bar marks. Greys lightened for contrast (`--text-secondary`/`--muted`).
  Convention added to DEVELOPMENT.md: on theme change, update favicon + `theme-color` too.
- **Shared catalogue card: `components/PartCard.jsx`** (`pc-*`, `.pc-grid` / `.pc-list`). Browse
  and Watchlist both render box/list cards through it, so the two views and pages stay
  consistent (brand now sits next to the category badge in both variants). Retired the old
  `br-card*` / `wl-card*` card markup (Browse skeletons still use `br-card`/`br-list-item`).
- **Watchlist** got the Browse treatment: box/rectangular toggle (**defaults to list**), search,
  advanced filters (brand / price / in-stock), category chips, and sort - reusing `br-filters` CSS.
- **Browse:** consolidated to a single page-size selector (**15 / 30 / 60 / 120**, default 30) in
  the toolbar; removed the duplicate one that briefly lived in the pagination bar.
- **Compare:** restored as a standalone nav tab; once the first part is chosen the search
  **locks to that category** (GPU vs GPU only), with a locked banner + a guard on add.
- **Builder:** the Public checkbox + Share button became one **Share dropdown** - "Copy private
  link" (`/builder/{share_id}`) and "Publish & copy public link" (`is_public`, `/build/{slug}`).
  Save now always saves privately.
- **Advisor:** the agent's build is surfaced in a prominent **panel below the chat** (chat keeps a
  compact "see below" chip); auto-scrolls in and always shows the most recent build.
- **Home:** removed the hero "Browse parts" button; sections are full-height (`100vh`) with
  polished headers; scroll-snap removed earlier for smoothness.
- **Guide** page visually reworked (progress bar, scrollspy TOC, timeline steps).
- **Demo login:** added `demo` / `demo1234` to the fake DB (`fake_db.py`); `test_watchlist.py`
  user-count assertion bumped 3 -> 4.
- **Not yet done:** still no PR; branch not merged. Old `br-card*` detail-card CSS in Browse.css
  is partly dead (kept for skeletons) - could be trimmed.

## Latest session (2026-06-02): Watchlist + Community merge + UX pass

On branch `feat/ux-watchlist-community`. Design in
`docs/superpowers/specs/2026-06-02-ux-watchlist-community-design.md`.
Backend **38 tests pass** (was 31), frontend build + vitest clean.

- **Watchlist replaces ephemeral compare.** The "+" on Browse (grid/list/detail) and the
  Builder retailer view now saves to a persistent **watchlist** (bookmark toggle), mirrored
  in both pages per the project convention.
  - Store: `services/watchlist.js` (pub/sub over `localStorage`) + `hooks/useWatchlist.js`.
    Guests keep a local list; signed-in it mirrors to the backend and **merges on login**
    (wired in `AuthContext`).
  - Backend: `routers/watchlist.py` (`GET /api/watchlist`, `POST`/`DELETE
    /api/watchlist/{id}`, `POST /api/watchlist/merge`), `watchlist` table in fake-DB,
    `watchlist_migration.sql`, tests in `tests/test_watchlist.py`. **Note:** `/merge` is
    declared before `/{component_id}` so it isn't parsed as an id.
  - New `pages/Watchlist.jsx` at `/watchlist` (saved-list view; "Compare side by side"
    button still routes to the existing `/compare`). Reachable from the user dropdown
    (signed-in) and a guest icon button + Browse bar (logged-out).
- **Forum merged into Community.** `Community` now has tabs **Builds | Discussions |
  Builders** (`components/Discussions.jsx` is the old Forum; `components/Builders.jsx` is a
  new user directory via `GET /api/users` in `social.py`). Tab is in the `?tab=` param.
  `/forum` redirects to `/builds?tab=discussions`; `Forum.jsx` page deleted (Forum.css kept).
- **Nav slimmed** to Browse · Builder · Advisor · Community (Compare + Forum removed; both
  pages still routable). Watchlist lives in the top-right dropdown.
- **Guide** reworked: sticky TOC sidebar, numbered chapters, refreshed copy, CTAs now
  Agent (green) + Build + Browse. **Footer** link is now "Guide" -> `/guide` (alias added).
- **Green button hierarchy** on Home hero + final CTA and the Guide: Agent = `btn-primary`
  (volt), Build/Browse = neutral `btn`.
- **Misc:** fixed the cramped gap in the Compare search modal; added a rate-limiter reset
  fixture in `tests/conftest.py` so login limits don't leak across tests; mobile pass on
  all changed pages.
- **Not yet done:** no PR opened; this branch not merged. Avatars still data-URL only.

## Latest session (2026-06-02): Social layer

A full social layer was added (design in `docs/superpowers/specs/2026-06-02-social-layer-design.md`).
Backend **31 tests pass**, frontend build clean.

- **Builds get visibility + identity:** `is_public` (private by default), `slug`, `likes_count`.
  New `routers/social.py`: community feed (`GET /builds/public`, recent/popular, all/following),
  build detail by slug, `PATCH /builds/{id}` (rename/visibility), likes, favourites, profiles,
  following. Enrichment is done in Python so it works on Supabase **and** the fake DB.
- **Profiles:** `bio`, `avatar_url`, `favorites_public` on `users`. Public profile page
  `/u/:username` (never exposes email). Avatars are client-downscaled to a data URL (no storage).
- **Likes vs favourites:** likes are a public heart + count; favourites are a private bookmark
  with a profile toggle to show them publicly.
- **Frontend:** new `Community` (`/builds`), `BuildDetail` (`/build/:slug`), `PublicProfile`
  (`/u/:username`); reworked `Profile` (My Builds + Favourites + bio/avatar); Builder public/
  private toggle; clickable forum authors; **Community** nav item; sign-in "remember me" +
  username-or-email + inline errors. Shared `components/BuildCard.jsx` + `Avatar.jsx`.
- **Schema:** `social_migration.sql` (run after `supabase_migration.sql`). Fake DB seeded with
  demo users `alishbuilds` / `rajrenders` / `miraITX` (password `demo1234`) and public builds.
- **Bugfix:** JWT `sub` was an int (python-jose rejects non-string subjects on decode), which had
  broken **all** authenticated requests. Now `str(user["id"])` in `auth.login`.
- **Also fixed:** the `.pf`/Profile padding-top navbar-overlap bug (same class of bug as Contact).
- **Not yet done:** real avatar object storage (data URLs are fine for now); comments/notifications.

## Latest session (2026-06-02): UI polish pass

Working tree has **uncommitted** changes from this session (not yet committed):

- **Bottleneck Analysis redesign** (`Builder.jsx` / `Builder.css`): replaced the ASCII `█░` bars
  with segmented meter bars, a status pill (Balanced / CPU Limited / GPU Limited), per-component
  tier readouts, and limiter highlighting. Fixed a latent bug where `severity: "critical"` from
  the backend rendered unstyled (CSS only had `good`/`warning`/`bad`).
- **New logo + favicon**: an ascending-bars mark (volt-lime) shared by the navbar (inline SVG in
  `Navbar.jsx`) and `public/favicon.svg`, replacing the old cyan "PC" favicon.
- **Interactive hero stats** (`Home.jsx`): Components links to /browse, Retailers opens a modal
  listing tracked vendors (via `getVendors`), and "₹0 Always Free" became a live **Community**
  stat (forum thread count) linking to /forum. Added `forum_threads` to `GET /api/stats`.
- **Naming**: Advisor "AI Chat" tab and the "PCease AI Agent" empty-state heading are now just
  **"Agent"**.
- **Removed all em dashes** (131 across 29 files) from code, UI copy, and living docs; added a
  no-em-dash rule to DEVELOPMENT.md Conventions. The two frozen docs under `docs/superpowers/`
  were intentionally left as-is (point-in-time records).
- **Expanded the fake DB** (`fake_db.py`): rewrote the seed as a deterministic generator (fixed
  RNG seed) producing **~423 components** and **9 vendors** (added The IT Depot, Compify, Clarion),
  spanning entry to enthusiast tiers across all 8 categories with valid sockets/RAM types/form
  factors so compatibility, wattage, and bottleneck checks all work. CPUs/GPUs are curated real
  models; boards/RAM/storage/PSUs are generated from brand+spec tables. Backend restarted on :8000
  with `--reload` and verified serving the new catalog (`/api/stats` shows 423 / 9).

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
seeded catalog (8 categories, 9 vendors, ~423 components). `/health` is green. State resets on
restart. The only thing the dummy DB can't do is the **live AI agent chat** - that needs a real
`ANTHROPIC_API_KEY` (or `GEMINI_API_KEY` + `LLM_PROVIDER=gemini`) in `backend/.env`.

> Windows note: invoke the venv Python by its **absolute path** when launching as a background
> task - relative `./.venv/...` has failed to resolve in this environment.

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
2. **Whole-app visual redesign** - "Performance Instrument" identity (near-black + volt-lime,
   Chakra Petch/Sora/JetBrains Mono, blueprint grid). Home hero has an animated agent console.
3. **Security/correctness/robustness pass** (commit `26f614f`) - see "Known issues" for what's
   intentionally left.
4. **In-memory dummy DB** (`backend/app/fake_db.py`, `USE_FAKE_DB`).
5. **Price-history graph** (`components/PriceGraph.jsx` + `/api/components/:id/price-history`)
   in the Browse and Builder modals, with Day/Week/Month, a time axis, and a hover tooltip.
6. **Docs split** - `README.md` (simple, human) and `DEVELOPMENT.md` (all technical detail).

## Conventions to respect

- **Mirror component UI across Browse and Builder.** The component detail UI is duplicated in
  `frontend/src/pages/Browse.jsx` (detail modal) and `frontend/src/pages/Builder.jsx` (retailer
  view). Any change to specs/price-graph/badges/actions must go in **both**. (Documented in
  DEVELOPMENT.md; there's a saved memory about this.)
- Keep prices grounded - never show invented prices outside the agent's labelled output.
- Specs render as cards (mono label + bold value).

## Known issues / deliberately deferred

- **Price history is generated, not real.** The endpoint anchors a deterministic series to the
  current price. Real fix: a daily job snapshotting `component_prices` → a `price_history` table;
  then read from it (frontend unchanged).
- **Legacy `_build_smart_recommendation`** (Manual tab) picks best-per-category and does **not**
  cross-check CPU/motherboard sockets, so it can pair e.g. an Intel CPU with an AM5 board. The
  **agent** path does run compatibility checks. Worth unifying.
- **No self-service password reset** - the old username+email reset was an account-takeover
  vector and was removed; "Forgot password?" points to Contact. Add an emailed-token flow when
  email exists.
- **JWT in `localStorage`** (XSS tradeoff) - consider httpOnly cookies.
- **Browse loads up to 500 components** in one payload - pagination/virtualization would help.
- **Manual cascade deletes** in `auth.py` - prefer DB `ON DELETE CASCADE`.
- **Other pages not bespoke-redesigned** - Browse/Builder/Compare/Forum are re-themed via tokens
  but not individually polished like Home/Advisor.
- **No CI**; legacy routers (`auth`, `forum`, parts of `advisor`) have thin/no tests.

## Suggested next steps

1. Open a PR / merge `feat/agentic-build-advisor` → `main` (or use `finishing-a-development-branch`).
2. Add the real `price_history` snapshot job.
3. Give `_build_smart_recommendation` a socket-compatibility check (or route Manual through the agent tools).
4. Bespoke-redesign Browse/Builder/Compare/Forum to match Home/Advisor.
5. Add CI (run pytest + vitest + build on PR).
