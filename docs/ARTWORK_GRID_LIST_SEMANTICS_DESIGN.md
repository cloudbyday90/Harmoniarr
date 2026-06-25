# Platform-Wide `.hx-artwork-grid` List Semantics

Status: **Implemented.** This document records the design and outcome for
proposal #2 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): extending
the Batch H list-semantics pattern to every `.hx-artwork-grid` consumer in the
client, and centralizing the pattern in the shared CSS primitive.

It completes the work begun in Batch H
([DISCOVER_CARD_GRID_LIST_SEMANTICS_DESIGN.md](DISCOVER_CARD_GRID_LIST_SEMANTICS_DESIGN.md))
and Batch G
([DISCOVER_CHIP_ROLE_SEMANTICS_DESIGN.md](DISCOVER_CHIP_ROLE_SEMANTICS_DESIGN.md)).

---

## 1. Purpose

The shared `.hx-artwork-grid` CSS primitive (a responsive `auto-fill` card grid)
was rendered as a plain `<div>` (or `<section>`) in 10 non-Discover views, with
**no `role="list"`** and card children that were **not** list items. The grids
therefore had no list semantics at all — screen readers saw an ungrouped run of
articles. Batch H fixed only the Discover `PaginatedArtworkGrid`. This batch
makes the pattern platform-wide and centralizes it so all current and future
card grids inherit correct semantics by default.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs); the core techniques were
established in Batches G/H and re-confirmed here.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Grid + semantic wrappers | MDN — *Grid layout/Accessibility* ("markup flattening") | Use `display: contents` on a semantic `<li>` wrapper so the card stays the grid item. |
| `list-style: none` + Safari | MDN — *listitem role* | A `<ul>` with `list-style: none` loses list semantics in Safari; keep `role="list"`. |
| `display: contents` a11y | Can I Use; MDN | The Safari bug that dropped `display: contents` elements from the a11y tree was fixed in Safari 15.4 (2022); safe platform-wide in 2026. |
| Prefer native HTML | W3C — *ARIA in HTML* §3.1 | Use `<ul>`/`<li>` rather than role overrides. |

---

## 3. Design

### 3.1 Centralized CSS — `design-system.css` `.hx-artwork-grid`

The shared primitive now carries the whole pattern, so consumers only need to
use the right elements:

```css
.hx-artwork-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--hx-artwork-grid-min, 160px), 1fr));
  gap: var(--hx-space-4);
  list-style: none;   /* <ul> reset (no-op on <div>/<section>) */
  margin: 0;
  padding: 0;
}

.hx-artwork-grid > li {
  display: contents;  /* card stays the grid item; <li> keeps listitem role */
}
```

The reset is a no-op for any remaining `<div>`/`<section>` (they have no
`list-item` defaults), and `> li { display: contents }` only affects `<li>`
direct children — so the change is safe during a partial migration and is now
the single source of truth.

### 3.2 Simplified `PaginatedArtworkGrid` (Batch H cleanup)

The scoped `<ul>` reset and `.discover-grid__item { display: contents }` added in
Batch H are now redundant (subsumed by the global primitive) and were removed;
the `<li>` wrapper is retained. The Discover grid's `--hx-artwork-grid-min`
override remains.

### 3.3 Converted all 10 consumers

Each grid's container became `<ul ... role="list" ...>` and each card (plus, for
the two "discover more" tail cards, the trailing `RouterLink`) was wrapped in
`<li>`. The `v-for`/`:key` moved onto the `<li>` (scoped-slot and `@request`/
`@detail`/`@monitor` bindings are unchanged). Four grids that lacked a label
received a sensible `aria-label`.

| File (grid) | Before | After | Label added? |
| --- | --- | --- | --- |
| `ActivityReleasesView` (recent) | `<div>` | `<ul role="list">` | "Recent releases" |
| `ActivityReleasesView` (upcoming) | `<div>` | `<ul role="list">` | "Upcoming releases" |
| `ArtistDetailView` (per section) | `<div :aria-label>` | `<ul role="list" :aria-label>` | existing |
| `LibraryView` (grid branch) | `<div v-if>` | `<ul v-if role="list">` | "Library releases" |
| `MissingView` | `<div>` | `<ul role="list">` | "Missing releases" |
| `MyRequestsView` | `<section>` | `<ul role="list">` | existing ("Your requests") |
| `OperatorHomePanel` (cards + discover) | `<section>` | `<ul role="list">` | existing ("Monitored artists") |
| `RequesterHomePanel` (cards + discover) | `<section>` | `<ul role="list">` | existing ("Monitored artists") |
| `SearchView` (artists) | `<div aria-label>` | `<ul role="list" aria-label>` | existing |
| `SearchView` (releases) | `<div aria-label>` | `<ul role="list" aria-label>` | existing |

The three `<section>` grids (MyRequests, Operator/Requester home) were purely
card containers, so `<ul role="list">` is the more honest semantic (a card grid
is a list, not a region landmark); the `aria-label` now names the list.

### 3.4 What was intentionally left unchanged

- The scoped `--hx-artwork-grid-min` overrides and child selectors
  (`.search-grid .hx-media-card`, `.requester-home-grid .hx-media-card`) remain
  valid — they key off the card class, not the grid tag.
- `LibraryView`'s separate `.library-partial-strip` (a non-grid horizontal strip)
  was not in scope and was left as a `<div>`.

---

## 4. Security

- **No injection surface.** Pure markup + CSS semantic refactor; no engine- or
  user-supplied string is rendered as markup; no `v-html`.
- **No data-flow change.** Bindings, events, keys, and routes are unchanged; only
  wrapper elements differ.
- **No new scripts or network surface.**

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/design-system.css` | Centralized `<ul>` reset + `.hx-artwork-grid > li { display: contents }` on the shared primitive. |
| `src/client/components/media/PaginatedArtworkGrid.vue` | Removed the Batch H scoped reset/`display: contents` (now redundant). |
| `src/client/views/ActivityReleasesView.vue` | 2 grids → `<ul role="list">` + `<li>`; added labels. |
| `src/client/views/ArtistDetailView.vue` | Grid → `<ul role="list">` + `<li>`. |
| `src/client/views/LibraryView.vue` | Grid branch → `<ul role="list">` + `<li>`; added label. |
| `src/client/views/MissingView.vue` | Grid → `<ul role="list">` + `<li>`; added label. |
| `src/client/views/MyRequestsView.vue` | `<section>` → `<ul role="list">` + `<li>`. |
| `src/client/components/home/OperatorHomePanel.vue` | `<section>` → `<ul role="list">`; cards + discover card wrapped in `<li>`. |
| `src/client/components/home/RequesterHomePanel.vue` | `<section>` → `<ul role="list">`; cards + discover card wrapped in `<li>`. |
| `src/client/views/SearchView.vue` | 2 grids → `<ul role="list">` + `<li>`. |

No new pure helper or test module — the change is DOM/semantics only, validated
by build + lint (per the established discipline for component-only changes;
recommended confirmation with a per-surface browser/axe pass).

---

## 6. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds (all 10 templates compile).
- Full client suite: `npm run test:client` → **3660 pass, 0 fail**.
- Conversion audit: `rg '<(div|section)[^>]*hx-artwork-grid'` → **0 matches**
  (no unconverted containers remain); all 11 grids (incl. PaginatedArtworkGrid)
  are now `<ul>`.
- **Recommended confirmation:** a visual + axe-core sweep of the affected views
  (Library, Search, ArtistDetail, Missing, ActivityReleases, Home, MyRequests) to
  confirm identical layout and "list" announcements (not runnable here).

> Implementation note: during the LibraryView conversion, the grid's closing
> `</ReleaseCard>` anchor also matched a sibling `.library-partial-strip`
> `ReleaseCard`; this was caught by the build (missing end tag) and corrected by
> restoring the strip's closing `</div>`. The strip itself was intentionally not
> converted (it is not an `.hx-artwork-grid`).

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Centralize the reset + `> li{display:contents}` in the global primitive | Single source of truth; future grids inherit it; safe during partial migration | Slightly broader global rule | **Adopted.** |
| Convert all 10 consumers in one batch | Consistent platform-wide semantics; one verification pass | Large template surface (mitigated by build + the layout-neutral `display: contents`) | **Adopted.** |
| `<section>` grids → `<ul role="list">` | Honest semantics (a card grid is a list); `aria-label` still names the list | Drops a small named-region landmark per grid | **Adopted.** |

**Final stack.** One centralized CSS rule (reset + `> li{display:contents}`), one
Batch H cleanup, and ten consumer conversions — every card grid in the client now
exposes correct, cross-browser list/listitem semantics with identical layout,
and the pattern is codified so new grids inherit it automatically.
