# UX Round 2 - Design

_Date: 2026-06-03_
_Branch: `feat/ux-watchlist-community`_

A multi-page refinement pass following the Browse Advanced table / theme work. Frontend-only.

## Scope and decisions

### A. Browse (refinements to the new Advanced table)

1. **Remove the "Savings" everywhere in the table.** Drop the `Savings` column from
   `SpecTable` and the "Save X" tag. (Card view savings tag stays as-is unless noted; this item is
   table-only per the user listing the "column".)
2. **Stop the layout jumping when switching modes.** Today the grid/list view toggle is hidden in
   Advanced, which shifts the toolbar. Keep the grid/list toggle present in both modes but disabled
   (greyed, non-interactive) in Advanced, so the toolbar width does not change.
3. **Remove the "Pick a category to compare specs." hint** from the Advanced table.
4. **Rework filters into a unified, collapsible filter sidebar.** Replace the current small
   header-popover filters and the inline brand/price/in-stock panel with one collapsible left
   sidebar holding everything in one place: search-independent. It contains brand, price range,
   in-stock, plus (when a specific category is active in Advanced) the per-spec filters
   (numeric ranges + categorical multi-selects from `specColumns`). The existing "Filters" toggle
   button opens/closes this sidebar. Sorting stays on the table column headers.

### B. Compare (complete rework to one unified table)

Replace the two-view (cards + table) Compare with a **single unified comparison table**:

- Each filled component is a **column**; specs are **rows**. The top rows of each column are the
  component identity and key facts: name + brand (header), then Image, Category, Best Price,
  Best From (vendor), Retailers, then the dynamic spec rows. This is essentially the existing
  `cp-table-view`, promoted to be the only layout.
- **Remove** the card view (`cp-card*`), the `SpecsComparisonTable` block, and the cards/table
  **view toggle** (`view` state). The unified table is always shown when there is at least one part.
- Keep: the per-column add button, per-column remove, best-price highlighting, the search modal,
  the summary bar, the verdict, and the empty state.
- This fixes "parts don't line up with specs / disconnected" because everything is one real table:
  each spec value sits in its component's column by construction.

### C. Builder (Share modal)

- The Share action should offer **only "Publish"**. The shareable **link is already the first
  option**, so remove the redundant/extra share choice and leave Publish (which yields the link).
  Implementation: locate the Builder share modal and drop the secondary share option, keeping the
  publish flow that produces the link.

### D. Guide (sidebar page-switcher instead of long scroll)

- Convert the Guide from one long scroll with a scrollspy TOC into a **section switcher**: the
  sidebar lists sections; clicking one shows **only that section** in the content area, sized to fit
  the screen (the content area scrolls internally if a section is long, but the page itself does not
  become a giant scroll).
- Remove the reading-progress bar and the scroll/IntersectionObserver scrollspy (no longer
  meaningful). `active` state now drives which single section renders. Keep the section data and all
  content unchanged.

### E. Footer

- Reflow the footer: **action links/buttons bottom-right**, **credits (copyright) centered**. Brand
  stays at the left. On mobile, stack and center as today.

### F. Advisor

1. **One-line tagline.** Keep "Find your perfect PC build - manually configure, chat with AI, or
   pick a preset." on a single line (no wrap on desktop; `white-space: nowrap` with graceful
   shrink / ellipsis on very small screens).
2. **Consistent left-selectors + right-build layout for all three tabs.** Agent, Preset, and Manual
   selectors live on the **left**; the **right** side shows the selected/produced build in **all**
   modes (remove the old "advanced/manual skips the right side" behavior).
3. **Remove the Presets simple/advanced sub-view** (`presetView` state and its toggle). Presets
   show as one consistent list.
4. **Two actions per build: "Show build" and "Use build".** Each preset/build item exposes a
   "Show build" button (renders it in the right panel) and a "Use build" button (loads it into the
   Builder via the existing `navigate('/builder', { state })` flow). The right panel renders the
   currently shown build for whichever tab is active.

## Non-goals

- No backend changes. No changes to the agent chat logic itself (only where its build is surfaced).
- Not touching the Community/discussions follow-up (still its own future spec).
- No theme retuning (done in the previous round).

## Testing

- `npm run build` clean and `npx vitest run` green after each area.
- `SpecTable` keeps its existing helper tests; if filter/sort logic moves, keep `specColumns.test.js`
  passing and extend if new pure logic is added.
- Manual: Browse (no savings column, toggle no longer shifts layout, no hint, sidebar filters work);
  Compare (one table, columns aligned, add/remove/search/verdict work); Builder share (only Publish);
  Guide (sidebar switches single sections, fits screen); Footer (buttons right, credits centered);
  Advisor (one-line tagline, left selectors + right build in all tabs, no presets sub-view, Show/Use
  build buttons work).
- Backend pytest still green (unchanged).

## Conventions

- No em dashes. Mirror component UI across Browse and Builder. Specs as mono label + value.
- Update HANDOFF.md and DEVELOPMENT.md in the same flow.

## Notes / sequencing

This spec spans several independent areas. The implementation plan groups them so each area is a
self-contained, committable unit and can be built/verified on its own.
