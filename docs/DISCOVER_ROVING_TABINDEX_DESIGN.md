# Discover — Roving-Tabindex Keyboard Navigation for the Artwork Grid

Status: **Implemented.** This document records the design and outcome for
proposal #1 in [DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md):
a W3C-APG roving-tabindex surface for `PaginatedArtworkGrid`, so a dense card
grid becomes one tab stop with arrow-key navigation instead of dozens of tab
stops.

It builds on the Batch C primitive established in
[DISCOVER_FOCUS_STRENGTH_PAGINATION_DESIGN.md](DISCOVER_FOCUS_STRENGTH_PAGINATION_DESIGN.md).

---

## 1. Purpose

`PaginatedArtworkGrid` exposes a `role="list"` of artist cards and reveals them
incrementally. Before this change, every card's interactive controls (the
navigable link **and** the "Add" button) sat in the natural tab order. As the
grid grew — and especially after "Show more" revealed additional pages — a
keyboard user had to Tab through dozens of controls simply to cross it. There
was no way to move between cards with arrow keys.

This batch adds an opt-in roving-tabindex layer: exactly one card link is the
tab stop into the grid; the rest are `tabindex="-1"` and are reached with
Arrow / Home / End / Ctrl+Home / Ctrl+End. The container stays `role="list"`
(deliberately — see §2).

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs) and cross-checked against
the codebase.

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Roving tabindex practice | W3C APG — *Keyboard Interface Practices* § Roving Tabindex | One element in the composite holds `tabindex="0"`; all others `tabindex="-1"`; arrow keys move focus; the visual focus indicator must always be visible. |
| Grid keyboard intents | W3C APG — *Grid Pattern* | Arrow keys + Home/End (row-scoped) + Ctrl+Home/Ctrl+End (grid-scoped). |
| Roving controller design | Adobe Spectrum — `RovingTabindexController` | Direction modes incl. `grid`; a `directionLength` (column count) is resolved at runtime; disabled-element handling; focus-management is a *composite* technique, not limited to `role="grid"`. |
| "ARIA grid as an anti-pattern" | Adrian Roselli; WPCalypso a11y review (GitHub) | For a list of *navigable links* (not tabular data), full `role="grid"` + `row`/`gridcell` adds verbose, meaningless row/column announcements. Plain `role="list"` + roving tabindex is the more honest composite-widget technique. |

**Key decisions derived from the research:**

- **Keep `role="list"`.** These are navigable cards (links to artist detail), not
  tabular data cells. Roving tabindex is a composite-widget technique that works
  on any container; we do not need — and should avoid — the `grid` role's
  row/column semantics here.
- **Resolve columns at runtime.** The artwork grid uses
  `repeat(auto-fill, minmax(var(--hx-artwork-grid-min), 1fr))`, so the column
  count is a layout-time property that changes with the viewport. It is read from
  the browser's resolved `grid-template-columns`, never hardcoded.
- **Match platform icon-grid movement.** Horizontal (ArrowLeft/Right) is linear —
  it follows document flow and crosses row boundaries, so the whole grid is
  traversable with one key regardless of the responsive column count; vertical
  (ArrowUp/Down) uses the column stride and stops at the top/bottom row (no
  overshoot), matching file-manager/Finder icon grids.

---

## 3. Design

The work is split into three layers, mirroring the Batch C discipline (pure
DOM-free logic in `lib/`, thin component/composable wiring that is validated by
build + browser, not jsdom unit tests).

### 3.1 Pure index math — `src/client/lib/roving-index.js` (new)

Two value-only functions, fully unit-tested with the native Node runner:

- `resolveRovingIntent({ key, ctrlKey, metaKey })` →
  `'next' | 'prev' | 'up' | 'down' | 'row-start' | 'row-end' | 'first' | 'last' | null`.
  Maps the keyboard event to a semantic intent. `Home`/`End` are row-scoped;
  `Ctrl`/`Cmd`+`Home`/`End` are grid-scoped. Returns `null` for non-navigation
  keys (so Enter still activates the focused link natively).
- `resolveRovingIndex(current, intent, columns, total)` → the new active index in
  `[0, total-1]`, or `null`. Movement model:
  - Horizontal is **linear** (crosses row boundaries, stops only at the grid
    start/end).
  - Vertical moves by the **column stride** and stops at the top/bottom row.
  - `down` clamps to the last item when the target row is partial.
  - `row-start`/`row-end` jump to the current row edges; `first`/`last` to the
    grid edges.
  - Clamps a stale `current` into range first (items may have shrunk); columns
    are clamped to `[1, total]` so a single-column layout degrades to a linear
    list. Strict-boolean guards on the modifiers (no truthy coercion).

### 3.2 Composable — `src/client/composables/useRovingTabindex.js` (new)

Owns everything DOM: the active index, the cell list (resolved via a configurable
`cellSelector`, default `.hx-media-card__link-area`), the resolved column count
(read from computed `grid-template-columns`, overridable via `columnCount`),
keydown/focusin listeners, and `tabindex` 0/-1 synchronization.

- **Single tab stop.** `syncTabindex()` sets `tabindex="0"` on the active cell
  and `tabindex="-1"` on the rest.
- **Click-anchoring.** A `focusin` listener makes a clicked/programmatic-focus
  cell the new roving anchor, so the next Tab returns to the grid at the
  visited card.
- **Key handling.** On a navigation key, `preventDefault()` (stops page scroll),
  resolve the next index, sync tabindex, and `.focus()` the new cell.
- **Opt-in + self-managing.** An `enabled` predicate gates attach/detach; a
  watcher flips listeners on/off and restores implicit (attribute-less)
  `tabindex` when disabled, so backward compatibility is exact when `roving` is
  off. Exposes `refresh()` for the host to re-sync after the DOM changes.
- **No per-cell listeners.** One keydown + one focusin listener on the
  container; events bubble up from the focused cell.

### 3.3 Grid wiring — `PaginatedArtworkGrid.vue`

New opt-in props `roving` (Boolean, default `false`) and `cellSelector` (default
`.hx-media-card__link-area`). A template ref resolves the container; the
composable is instantiated with `enabled: () => props.roving`. After every
reveal (`showMore`) and every `items.length` change, `refresh()` runs on
`nextTick` so the managed `tabindex` is re-applied to the freshly rendered cell
nodes. The `role="list"` and scoped-slot contract are unchanged.

### 3.4 Focus indicator — `ArtistCard.vue`

The card's own `:focus-visible` never fires because focus lands on the inner
navigable link (`.hx-media-card__link-area`). A `:focus-visible` ring
(`outline: 2px solid var(--hx-accent)`) was added directly on the link area —
outlines are not clipped by ancestor `overflow: hidden`, so the roving focus
target is always visibly indicated.

### 3.5 Opt-in — both Discover panels

`DiscoverRecommendationsPanel.vue` and `DiscoverSearchResultsPanel.vue` pass
`roving` to their grids. No other panel/view changes are required.

---

## 4. Security

- **No injection surface.** Roving adds/reads only `tabindex` attributes and
  keyboard primitives. No engine- or user-supplied string is rendered as markup;
  no `v-html` is introduced.
- **Client-only, ref-scoped DOM.** All DOM reads (`querySelectorAll`,
  `getComputedStyle`) and `.focus()` calls operate on elements already in the
  page within the grid's own subtree. No new network, query, auth, or data-flow
  surface.
- **No data change.** Navigation is purely presentational focus movement; it
  cannot mutate monitoring state, trigger requests, or reach the server. The
  "Add" button and all existing contracts are untouched.
- **`preventDefault` is scoped** to recognized roving keys only; all other keys
  (Enter, characters, Tab) bubble normally.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/lib/roving-index.js` | **New.** Pure `resolveRovingIntent` + `resolveRovingIndex`. |
| `src/client/composables/useRovingTabindex.js` | **New.** DOM-scoped roving-tabindex controller (listeners, tabindex sync, focus). |
| `src/client/components/media/PaginatedArtworkGrid.vue` | Opt-in `roving`/`cellSelector` props; template ref; `refresh()` after reveal/list change. |
| `src/client/components/media/ArtistCard.vue` | `:focus-visible` ring on `.hx-media-card__link-area`. |
| `src/client/components/media/DiscoverRecommendationsPanel.vue` | Passes `roving` to the grid. |
| `src/client/components/media/DiscoverSearchResultsPanel.vue` | Passes `roving` to the grid. |
| `test/client/roving-index.test.js` | **New.** 28 tests (intent mapping, index math, clamping, integration walk). |

---

## 6. Validation

- Focused: `node --test test/client/roving-index.test.js` → **28/28 pass**.
- Full client suite: `npm run test:client` → **3644 pass, 0 fail**.
- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds (379 modules transformed).

The composable's DOM wiring follows the Batch C precedent (`focus-return.js`):
pure logic is unit-tested; the DOM-touching layer is validated by build + the
type/contract checks, and is intended for browser verification in a running
environment.

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Roving tabindex on card **links**, keep `role="list"` | Spec-honest composite technique; avoids grid-as-anti-pattern; primary navigation is a single tab stop; index math 100% unit-testable | "Add" buttons remain tabbable (halves, not eliminates, total stops) | **Adopted.** |
| Pure `roving-index.js` + thin composable | DOM-free math fully tested; mirrors Batch C `focus-return`/`paginated-list` discipline | Composable DOM wiring not jsdom-tested (consistent with prior batches) | **Adopted.** |
| **Linear** horizontal + **column-stride** vertical | Whole grid traversable with one key; matches platform icon-grid conventions; responsive-column-safe | Right at a row edge visually jumps "down-left" (expected file-manager behavior) | **Adopted.** |
| Runtime column resolution via computed grid tracks | Correct for `auto-fill` responsive layouts; no hardcoded breakpoint assumptions | One `getComputedStyle` read per navigation key (negligible) | **Adopted.** |

**Final stack.** Pure logic in `lib/roving-index.js` (DOM-free, 28 tests) →
DOM-scoped controller in `composables/useRovingTabindex.js` → opt-in prop on the
shared `PaginatedArtworkGrid` primitive → focus ring on the card link area →
both Discover panels opted in. Fixed-enum intents, attribute-only DOM mutation,
and ref-scoped reads keep the surface secure and backward compatible.
