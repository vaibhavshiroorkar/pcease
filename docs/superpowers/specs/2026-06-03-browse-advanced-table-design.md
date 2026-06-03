# Browse Advanced Table, Softer Theme, Compare Alignment - Design

_Date: 2026-06-03_
_Branch: `feat/ux-watchlist-community`_

## Summary

Three related UI improvements to PCease, scoped into one spec:

1. **Softer theme** - lift the near-black palette to a charcoal/slate dark that is
   easier on the eyes, keeping the "Performance Instrument" identity. The current
   palette is backed up so it can be restored exactly.
2. **Browse Simple / Advanced toggle** - keep today's card view as "Simple"
   (default) and add an "Advanced" mode that renders a single connected spec
   table with category-aware columns, per-column sorting, and smart per-column
   filters.
3. **Compare alignment fix** - make the Compare card view's specs line up across
   components so each spec reads straight across (a connected layout), instead of
   each card laying out its specs independently.

Two further requests (Reddit-style discussions, account deletion that keeps and
anonymizes posts) are explicitly **out of scope** here and move to a follow-up
spec immediately after this one.

## Non-goals

- No user-facing theme switcher. The softer theme becomes the live default; the
  old palette is a developer-side backup only.
- No full data-grid (no column show/hide, pinning, or resizing) in the Advanced
  table. Sorting plus smart per-column filters only.
- No backend changes. All three items are frontend-only.
- No changes to the Community/Discussions subsystem or account deletion.

---

## 1. Softer theme

The palette is fully token-driven in `frontend/src/styles/global.css` `:root`, so
the whole app recolors by retuning variables. No per-component edits needed.

### Backup

Copy the current `global.css` verbatim to
`frontend/src/styles/global.dark-backup.css`. This file is never imported; it is
a snapshot so the exact current look can be restored by copying it back. Note it
in DEVELOPMENT.md.

### Token changes (values only)

| Token | From | To (approx) | Reason |
|-------|------|-------------|--------|
| `--bg` | `#0a0b0d` | `#15171c` | charcoal, not near-black |
| `--bg-secondary` | `#101216` | `#1a1d23` | matches new base |
| `--surface` | `#14171c` | `#1f232b` | cards read above bg |
| `--surface-hover` | `#1b1f26` | lift to match | consistent elevation |
| `--surface-active` | `#232832` | lift to match | consistent elevation |
| `--text` | `#f6f7f9` | `#e9ebef` | off-white kills glare |
| `--text-secondary` | `#c6ccd6` | re-tune for new bg | contrast |
| `--text-muted` | `#8b929d` | re-tune for new bg | contrast |
| `--border` | `rgba(255,255,255,.07)` | slightly stronger | cards read on lighter bg |

Accent blue, green/support signals, radii, type, and the blueprint dot-grid and
accent glows stay unchanged. Exact final hex values are tuned during
implementation against WCAG-ish contrast on the new background, but stay within
the ranges above (softer dark, same identity).

---

## 2. Browse Simple / Advanced toggle

### Mode model

- New state `mode` in `Browse.jsx`: `'simple' | 'advanced'`, default `'simple'`,
  persisted to `localStorage` (key `pcease_browse_mode`) so it sticks across
  visits.
- A segmented **Simple / Advanced** toggle in the toolbar (`br-meta__right`).
- **Simple mode:** exactly today. The grid/list view toggle and `PartCard` cards
  are unchanged. The grid/list toggle is only shown in Simple.
- **Advanced mode:** grid/list toggle hidden; renders `<SpecTable>`. Search,
  category chips, sort dropdown, page-size, and the existing advanced-filters
  panel (brand/price/in-stock) all still apply. The table consumes the same
  `pagedComponents` slice already computed.
- Detail modal is shared: clicking a table row opens the existing Browse detail
  modal (no duplication).

This keeps Simple 100% untouched (low risk) and reuses all existing filter and
pagination state.

### "All" category in Advanced

When the "All" chip is active in Advanced mode, the table shows only the base
(shared) columns plus a subtle hint "Pick a category to compare specs". Spec
columns appear once a specific category is selected. Mixed categories cannot
share spec columns meaningfully, so this is the correct default.

---

## 3. `<SpecTable>` component

New focused component: `frontend/src/components/SpecTable.jsx` (+ `SpecTable.css`).

### Responsibilities

- Presentation plus local sort/filter UI state only. No data fetching.
- Renders one connected table: sticky header row, aligned columns,
  hover-highlighted rows, row separators. A horizontal scroll wrapper handles
  wide spec column sets.
- Each row: watchlist toggle (corner), Name (clickable, opens detail), spec
  cells, Best Price, Savings, Vendor + Buy link.
- Clicking a row (outside the buy/watchlist controls) calls `onOpen(item)`.

### Props

```
<SpecTable
  items={pagedComponents}   // already filtered + paged by Browse
  category={category}       // '' for All, else slug
  onOpen={item => setDetail(item)}
  hasWatch={inWatchlist}    // (id) => bool
  toggleWatch={handleToggleWatch}
/>
```

The component owns: active sort column + direction, and per-column filter values.
It applies sort and per-column filters to `items` internally and renders the
result. (Browse-level filters already ran upstream; per-column filters are an
additional, table-only refinement.)

---

## 4. Column configuration (single source of truth)

Lift the existing `SPEC_PRIORITY` map (currently inside `PartCard.jsx`) into a
shared export so cards and the table agree on which specs matter. Proposed home:
`frontend/src/services/api.js` (alongside `CATEGORIES` and the spec helpers) or a
small `columns.js`; chosen during implementation to avoid an import cycle.

Provide `columnsForCategory(slug)` returning the ordered spec keys for that
category. `PartCard.getKeySpecs` is refactored to use the same source so the two
views never drift.

Base columns (always present): Name, Brand, Best Price, Savings, Vendor.
A Category column is added only when "All" is active. Watchlist toggle is a fixed
leading cell.

Spec columns per category (from `SPEC_PRIORITY`):

- **cpu:** Cores, Threads, Boost Clock, Socket, TDP
- **gpu:** Memory, Boost Clock, TDP, CUDA Cores
- **motherboard:** Socket, Chipset, Form Factor, RAM Slots
- **ram:** Capacity, Speed, Type, CAS Latency
- **storage:** Capacity, Type, Interface, Read Speed
- **psu:** Wattage, Efficiency, Modular
- **case:** Form Factor, Max GPU Length, Expansion Slots
- **cooler:** Type, TDP Rating, Fan Size
- **monitor:** Resolution, Refresh Rate, Panel Type, Size
- **fans:** Size, Quantity, Airflow, RPM

Labels reuse `formatSpecKey`; values reuse `formatSpecValue`. A spec missing on
an item renders a muted "-".

---

## 5. Per-column sort and smart filters

### Sort

- Clicking a column header sets it as the active sort column; clicking again
  toggles asc/desc. One active sort column at a time, with a direction caret.
- Numeric specs sort numerically by parsing the leading number out of values like
  `4.7 GHz`, `65W`, `16GB` (reuse the `parseNum` pattern already in `Compare.jsx`;
  extract it to a shared helper). Text specs sort case-insensitively.
- Base columns (Best Price, Savings, Name, Brand) are sortable too, using the
  existing price/savings helpers.

### Smart per-column filters

Each spec column exposes a filter affordance (a small icon in the header opening a
popover). The control type is inferred from the column's data across the current
`items`:

- **Numeric column** (most values parse as numbers): min/max range inputs.
- **Categorical column** (values are discrete text, e.g. socket, form factor,
  type): a multi-select of the distinct values present.

Per-column filters AND together and combine with the upstream Browse filters. A
"Clear table filters" control resets only the per-column filters. Inference rule:
if at least ~70% of non-empty values in a column parse as numbers, treat it as
numeric; otherwise categorical.

---

## 6. Compare alignment fix

### Current behavior

`Compare.jsx` has two views:

- **Table view** (`cp-table-view__tbl`): already a true aligned `<table>`; specs
  read straight across. This is fine.
- **Card view** (default): each `cp-card` renders its own collapsible spec list
  independently, so the same spec sits at different vertical positions across
  cards and does not line up. The connected `SpecsComparisonTable` exists but is
  a separate block below the cards, detached from them.

The user's complaint ("components currently don't align with the specs, it should
be connected") is about the card view.

### Fix

Make the card view's specs a single connected, row-aligned region across all
component columns, so each spec label has one row and each component's value sits
in its column directly under that component. Concretely:

- Replace the per-card independent collapsible spec lists with a shared
  spec-comparison region that aligns rows across the filled component columns,
  reusing the alignment approach already proven in the Table view.
- Keep the card "hero" area (image, name, price, vendor list) per-component as
  today; only the specs section becomes connected/aligned.
- Avoid duplicating logic: the card view and `SpecsComparisonTable` should share
  one aligned-specs renderer rather than two spec layouts.

Exact CSS approach (CSS grid with shared column count vs. promoting the existing
`SpecsComparisonTable` to be the card view's spec region) is decided during
implementation after reading `Compare.css`, following existing `cp-` patterns.
This stays within the Compare page; no shared component is forced.

---

## Testing

- **Frontend build:** `npm run build` stays clean.
- **Vitest:** add a unit test for the shared numeric-parse/sort helper and for
  `columnsForCategory` (deterministic column sets per slug).
- **Manual checks:**
  - Browse Simple mode renders identically to before (grid + list).
  - Toggle to Advanced shows the table; category change swaps spec columns;
    "All" shows base columns + hint.
  - Header click sorts; numeric vs text sort correct; per-column numeric range and
    categorical multi-select filter the rows; clear resets them.
  - Mode persists across reload.
  - Theme: spot-check Home, Browse, Builder, Compare, Community for contrast and
    that nothing relied on the old near-black.
  - Compare card view: specs line up across 2-4 components.
- **Backend tests:** unaffected (no backend changes); confirm still green.

## Conventions to respect

- No em dashes anywhere (use commas, colons, or spaced hyphens).
- Mirror component UI across Browse and Builder: the shared `columnsForCategory`
  source keeps card key-specs and the table in sync; any spec-display change must
  still consider the Builder retailer view.
- Specs render as mono label + value.
- Update HANDOFF.md and DEVELOPMENT.md in the same commit as the change.

## Follow-up (separate spec, next)

- Reddit-style threaded discussions (nested replies, voting, collapse).
- Account deletion keeps posts and anonymizes the author as `[deleted]` instead
  of cascade-deleting their content.
