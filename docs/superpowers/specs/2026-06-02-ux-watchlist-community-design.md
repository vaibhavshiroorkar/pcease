# PCease UX refresh, Watchlist & Community merge

_Design doc. Date: 2026-06-02._

## Goal

A focused UX pass plus two feature changes:

1. Replace the ephemeral "+ add to compare" selection with a persistent **Watchlist**.
2. Merge the **Forum into Community** and add a **Builders** directory so users are
   discoverable and each has a public page.
3. Polish: Guide rewrite, green-button hierarchy, footer label, a modal spacing fix,
   and a mobile responsive pass.

## 1. Watchlist

Replaces the ephemeral Compare selection. The "+" on a component now saves it to a
persistent watchlist instead of a throwaway compare list.

- **Storage (hybrid).** `services/watchlist.js` holds an array of component IDs in
  `localStorage` (`pcease_watchlist`) so it works logged-out. When a token is present,
  every mutation is mirrored to the backend. On login, the local list is merged into the
  account (`POST /api/watchlist/merge`) and then the server copy becomes the source of
  truth. A `useWatchlist()` hook exposes `{ ids, has, toggle, remove, clear, count }`
  and re-renders subscribers on change.
- **Backend.**
  - Table `watchlist (id, user_id, component_id, created_at)`, unique on
    `(user_id, component_id)`. `watchlist_migration.sql`.
  - `routers/watchlist.py`: `GET /api/watchlist` (enriched components, like compare),
    `POST /api/watchlist/{component_id}`, `DELETE /api/watchlist/{component_id}`,
    `POST /api/watchlist/merge` (body `{ ids: [...] }`). All require auth.
  - Fake-DB support (a `watchlist` list seeded empty).
  - Registered in `main.py`. Backend tests in `tests/`.
- **Frontend UI.**
  - The "+" toggle on **Browse** (grid card, list row, detail modal) and **Builder**
    (component detail / retailer view) becomes a bookmark toggle: "Add to watchlist" /
    "In watchlist". Mirrored in both pages per project convention.
  - New `pages/Watchlist.jsx` at `/watchlist`: saved parts as cards (price summary,
    best vendor, buy link, remove). Empty state. A **"Compare side by side"** button
    routes to the existing `/compare?ids=...` so comparison is preserved.
  - Browse's sticky compare bar becomes a "View watchlist (N)" link.
- **Access.** "Watchlist" added to the top-right user dropdown. `/compare` stays
  routable (reached from the Watchlist page). The **Compare nav item is removed.**

## 2. Forum into Community

- `pages/Community.jsx` gets three tabs: **Builds | Discussions | Builders**.
  - *Builds*: current public-build feed; recent/popular/following kept as a sub-control.
  - *Discussions*: the Forum moved in as `components/Discussions.jsx` (threads list,
    search, category chips, new-thread modal, thread modal, voting, replies, pinned
    Guide card).
  - *Builders*: user directory cards (avatar, username, bio, public-build count) linking
    to `/u/:username`.
- **Backend.** `GET /api/users` in `social.py`: public, searchable (`q`), paginated,
  returns `_public_user` plus `public_builds` count. Fake-DB support.
- **Routes.** `/builds` stays Community. `/forum` redirects to `/builds?tab=discussions`.
  Tab is reflected in the `?tab=` query param. **Forum nav item removed.**
- Home community links (hero stat, feature card, final CTA) repoint to Community.

## 3. Guide

Rewrite for clarity and visual polish: sticky TOC sidebar on desktop, numbered
sections, nicer callouts, updated budget year, "Back to Forum" -> "Back to Community".
Content sections unchanged in substance.

## 4. Green button hierarchy

Agent = green primary; Build + Browse = secondary/outline. Applied to the Home hero,
Home final CTA, and the Guide closing CTAs. `btn-primary` is the volt-lime green; a
secondary/outline variant is used for the other two.

## 5. Footer

Link label "PC Building Guide" -> "Guide", pointing to `/guide` (alias route added).

## 6. Modal filter gap

Increase spacing between the filter/sort controls and the results in the Compare search
modal (`cp-search-panel`).

## 7. Mobile

Responsive pass: Home hero stacking, Guide TOC, Community tabs/grids, Watchlist, Compare
modal, Browse filters, Footer. Tap targets, no horizontal overflow, scrollable tables.

## Routes after

`/watchlist` (new), `/guide` (alias of `/forum/guide`), `/forum` -> redirect to
Community Discussions. Nav: Browse, Builder, Advisor, Community. Watchlist lives in the
user dropdown.

## Out of scope

Real avatar storage, comments/notifications, real price history, account-required
gating of the watchlist (guests keep a local list).
