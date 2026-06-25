# Discover — Card-Grid List Semantics

Status: **Implemented.** This document records the design and outcome for
proposal #2 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): giving
the shared `PaginatedArtworkGrid` primitive native list semantics so its cards
are exposed as list items, and a cross-browser fix for list semantics on
`list-style: none` lists (a Batch G regression found during this work).

It completes the list-semantics correctness across both Discover surfaces
(chips done in Batch G —
[DISCOVER_CHIP_ROLE_SEMANTICS_DESIGN.md](DISCOVER_CHIP_ROLE_SEMANTICS_DESIGN.md))
and preserves the Batch D roving tabindex
([DISCOVER_ROVING_TABINDEX_DESIGN.md](DISCOVER_ROVING_TABINDEX_DESIGN.md)).

---

## 1. Purpose

`PaginatedArtworkGrid` rendered a `<div role="list">` whose slot children were
`<article class="hx-media-card">` elements with **no `listitem` role** — a `list`
without `listitem` children (an ARIA ownership mismatch), and the same "prefer
native HTML" guidance that drove Batch G applied here too. This batch migrates
the grid to native `<ul>`/`<li>` semantics without disturbing the CSS-grid
layout or the Batch D roving behavior.

A research finding also corrected a Batch G regression: a `<ul>` styled with
`list-style: none` loses list semantics in Safari unless it carries `role="list"`.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Grid + semantic wrappers | MDN — *Grid layout/Accessibility* ("Grid and the danger of markup flattening") | For an item to be a grid item it must be a *direct child* of the grid container. To keep a semantic `<li>` wrapper without breaking grid layout, MDN endorses **`display: contents`** on the wrapper so its children become the grid items. |
| `list-style: none` + Safari | MDN — *listitem role* | "Styling a list with `list-style: none;` in CSS removes the list semantics." Keeping `role="list"` on the `<ul>` restores cross-browser list semantics. |
| Prefer native HTML | W3C — *ARIA in HTML*; MDN — *listitem role* | Use `<ul>`/`<li>` rather than `role="list"`/`role="listitem"` wherever possible. |

**Key decisions derived from the research:**

- **`display: contents` on the `<li>`** so the slotted `<article>` cards remain
  the CSS-grid items — zero layout change — while the `<li>` provides `listitem`
  semantics. (The historical Safari bug that dropped `display: contents`
  elements from the accessibility tree was fixed in Safari 15.4 / 2022.)
- **Keep `role="list"` on the `<ul>`** despite it being native, because the
  scoped `list-style: none` would otherwise suppress list semantics in Safari.
  This also fixed the Batch G chip band, which had dropped the role.

---

## 3. Design

### 3.1 Grid primitive — `PaginatedArtworkGrid.vue`

- Container: `<div role="list">` → `<ul role="list">` (the `role="list"` survives
  `list-style: none` in Safari).
- Each slotted card is now wrapped in `<li class="discover-grid__item">`. The
  scoped-slot contract (`:item`, `:index`) is unchanged.
- **Scoped CSS** (only the Discover grid — the shared `.hx-artwork-grid`
  primitive is used as a `<div>` in 10 other views and is deliberately untouched):
  - `.discover-grid` gains the standard `<ul>` reset
    (`list-style: none; margin: 0; padding: 0;`).
  - `.discover-grid__item { display: contents; }` dissolves the `<li>` box so the
    `<article>` card stays the grid item (identical layout), while the `<li>`
    retains `listitem` semantics in the accessibility tree.

### 3.2 Batch G regression fix — `DiscoverRecommendationsPanel.vue`

The Batch G chip `<ul>` (which has `list-style: none`) was missing `role="list"`,
so Safari/VoiceOver would not announce it as a list. `role="list"` was added back
to the chip `<ul>`. This is the documented cross-browser workaround and restores
the "list, N items" grouping announcement.

### 3.3 Batch D roving preserved

Roving targets the card *link* (`.hx-media-card__link-area`) via `cellSelector`;
`querySelectorAll` finds the links through the `<li>`/`<article>` wrappers, so
tabindex sync and arrow-key focus are unaffected. The runtime column-count
resolver reads the `<ul>`'s computed `grid-template-columns`; because the `<li>`
uses `display: contents`, the `<article>` cards are still the grid items, so the
resolved track count is unchanged.

---

## 4. Security

- **No injection surface.** Pure markup + CSS semantic refactor; no engine- or
  user-supplied string is rendered as markup; no `v-html`.
- **No data-flow change.** The slot contract, item keys, paging math, and roving
  wiring are unchanged; only the wrapper elements differ.
- **No new scripts or network surface.**

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/components/media/PaginatedArtworkGrid.vue` | `<div role="list">`→`<ul role="list">`; cards wrapped in `<li class="discover-grid__item">`; scoped `<ul>` reset + `display: contents` on the item. |
| `src/client/components/media/DiscoverRecommendationsPanel.vue` | Batch G fix: `role="list"` restored on the chip `<ul>` (Safari `list-style: none` workaround). |

No new pure helper or test module — the change is DOM/semantics only, validated
by build (per the established discipline for component-only changes; recommended
confirmation with a browser/axe pass).

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3660 pass, 0 fail** (no count
  change — no new pure logic).
- **Recommended confirmation:** a visual + axe-core check on the Discover view to
  confirm the grid still lays out identically and the cards now announce as list
  items within a list (not available in this environment).

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| `<ul role="list">` + `<li>` `display: contents` | MDN-endorsed; zero layout change; native listitem semantics; no role override | One `display: contents` rule (a11y-safe since 2022) | **Adopted.** |
| Scope the `<ul>` reset to `.discover-grid` (not the global primitive) | Zero risk to the 10 other `.hx-artwork-grid` users | Slight duplication vs a global reset | **Adopted.** |
| Restore `role="list"` on `list-style: none` lists (chip band too) | Cross-browser list semantics (Safari workaround) | Redundant-looking attribute (documented why) | **Adopted.** |
| `<li>` as real grid items (no `display: contents`) | No `display: contents` | Cards must be made to fill the `<li>`; row-alignment risk | Rejected. |

**Final stack.** One template refactor (`<ul role="list">` + `<li>` wrappers),
a scoped `<ul>` reset, and `display: contents` on the grid item — the card grid
keeps its exact CSS-grid layout while gaining native list/listitem semantics.
The Batch G chip band was corrected in the same pass so both Discover list
surfaces now carry correct, cross-browser list semantics, and the Batch C/D
keyboard/focus behavior is fully preserved.

### Related finding (not addressed here)

The shared `.hx-artwork-grid` primitive is still a `<div>` in 10 non-Discover
views (ArtistDetail, Library, Search, Home, etc.). Those surfaces have the same
`list`-without-`listitem` shape and could receive the same `<ul>`/`<li>`
treatment, but each is a separate layout surface worth its own visual
verification, so they are left for follow-up rather than changed en masse here.
