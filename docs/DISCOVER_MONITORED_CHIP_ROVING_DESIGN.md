# Discover — Roving Tabindex for the Monitored-Artist Chip Band

Status: **Implemented.** This document records the design and outcome for
proposal #2 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): applying
roving tabindex to the monitored-artist chip band so an operator with many
monitored artists no longer Tabs through every chip before reaching the
recommendation grid.

It reuses the Batch D infrastructure documented in
[DISCOVER_ROVING_TABINDEX_DESIGN.md](DISCOVER_ROVING_TABINDEX_DESIGN.md) and
coexists with the Batch C focus-return mechanism in
[DISCOVER_FOCUS_STRENGTH_PAGINATION_DESIGN.md](DISCOVER_FOCUS_STRENGTH_PAGINATION_DESIGN.md).

---

## 1. Purpose

`DiscoverRecommendationsPanel` renders the operator's monitored artists as a
flex-wrap `role="list"` of `RouterLink` chips (`.discover-monitored-chip`). Every
chip was in the natural tab order, so a keyboard user with N monitored artists
had to press Tab N times to cross the band and reach the recommendation grid
below. Batch D added roving tabindex to the *card grid* but left the chip band
untouched.

This batch extends the Batch D composable with a navigation **axis** and wires
it onto the chip band in horizontal mode: one chip is the single tab stop,
Left/Right (and Home/End) move focus, and the rest are removed from the tab
order.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Horizontal roving | W3C APG — *Toolbar Pattern* | "In horizontal toolbars, **Left Arrow and Right Arrow navigate** among controls." Up/Down are not navigation keys for a horizontal arrangement. |
| Direction modes | Adobe Spectrum — `RovingTabindexController` | A `direction` option (`horizontal` / `vertical` / `both` / `grid`) constrains which arrows are active — exactly the axis concept needed here. |
| Avoid arrow conflicts | MDN — `toolbar` role | "Avoid including controls whose operation requires the arrow keys used for toolbar navigation." Confirms the chip's only arrow-relevant action is navigation (links activate on Enter, not arrows). |

**Key decision derived from the research:** the chip band is a 1-D horizontal
arrangement, so it must use the **toolbar keyboard model** — Left/Right only.
Batch D's grid mode (all four arrows) would have let Up/Down also move focus,
which is wrong for a horizontal band and violates the APG toolbar guidance. This
required generalizing the roving helpers with an `axis`.

---

## 3. Design

The chip band reuses the Batch D composable; the only new logic is an `axis`
constraint, added at the pure layer so it stays fully unit-tested.

### 3.1 Axis support — `src/client/lib/roving-index.js`

`resolveRovingIntent` gains an `axis: 'grid' | 'horizontal' | 'vertical'`
(default `'grid'`, preserving the existing card-grid behavior exactly):

- `horizontal` → ArrowLeft/Right map to `prev`/`next`; **ArrowUp/Down return
  `null`** (ignored, so the page may scroll naturally).
- `vertical` → ArrowUp/Down map to `up`/`down`; ArrowLeft/Right return `null`.
- `grid` → all four arrows active (unchanged).
- In the 1-D modes there is no row concept, so Home/End always map to
  `first`/`last` (grid-scoped), not `row-start`/`row-end`.

`resolveRovingIndex` is unchanged: for a 1-D list the container is flex (not
CSS grid), so the runtime column resolver returns 1, and `next`/`prev`/`first`/
`last` are all linear — correct for the band.

### 3.2 Composable — `src/client/composables/useRovingTabindex.js`

New `axis` option (default `'grid'`), validated to the three allowed values and
forwarded to `resolveRovingIntent` in the keydown handler. No other change.

### 3.3 Panel wiring — `DiscoverRecommendationsPanel.vue`

Instantiates `useRovingTabindex` on the chip-band container
(`useTemplateRef('monitoredList')`) with
`cellSelector: '.discover-monitored-chip'` and `axis: 'horizontal'`. A watcher
on `props.chips.length` calls `refresh()` on `nextTick` so a freshly added/removed
chip's `tabindex` is re-applied to the new DOM node.

**Coexistence with Batch C focus-return.** The panel keeps its `chipRefs` Map and
`focusMonitoredArtistChip(artistId)` (used to return focus to a newly added
artist's chip after the add dialog closes). The two mechanisms integrate via the
composable's `focusin` listener: when `focusMonitoredArtistChip` calls
`.focus()` on a chip, the listener anchors roving to that chip and re-syncs the
tabindex, so the next Tab re-enters the band at the visited chip.

---

## 4. Security

- **No injection surface.** Roving adds/reads only `tabindex` attributes and
  keyboard primitives. No engine- or user-supplied string is rendered as markup;
  no `v-html`.
- **Client-only, ref-scoped DOM.** All reads (`querySelectorAll`) and
  `.focus()` calls operate on chip elements already in the page. No new network,
  query, auth, or data-flow surface.
- **`preventDefault` is scoped** to recognized roving keys only (Left/Right/
  Home/End). Up/Down, Enter, Tab, and character keys bubble normally — Enter still
  activates the focused chip link natively.

---

## 5. Files changed

| File | Change |
| --- | --- |
| `src/client/lib/roving-index.js` | `resolveRovingIntent` gains `axis` (`grid`/`horizontal`/`vertical`); 1-D modes map Home/End to `first`/`last`. |
| `src/client/composables/useRovingTabindex.js` | New `axis` option forwarded to `resolveRovingIntent`. |
| `src/client/components/media/DiscoverRecommendationsPanel.vue` | Wires `useRovingTabindex` (horizontal) on the chip band; template ref; `refresh()` on chip-set change. |
| `test/client/roving-index.test.js` | +5 axis tests (horizontal ignores Up/Down; vertical ignores Left/Right; 1-D Home/End). |

---

## 6. Validation

- Focused: `node --test test/client/roving-index.test.js` → **33/33 pass** (+5
  axis tests on top of Batch D's 28).
- Full client suite: `npm run test:client` → **3660 pass, 0 fail**.
- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.

---

## 7. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Add `axis` to the pure `resolveRovingIntent` | Key→intent contract stays pure + unit-tested; backward compatible (default `grid`); matches Spectrum's `direction` model | One more param on the helper | **Adopted.** |
| Reuse Batch D `useRovingTabindex` for the chip band | Near-zero new logic; one tested primitive serves both Discover list surfaces | Composable gains a small option (axis) | **Adopted.** |
| Keep `role="list"` (not `role="toolbar"`) | Honest semantics — these are navigable list items, not actions; consistent with the card grid | None — roving is a composite technique independent of role | **Adopted.** |

**Final stack.** One pure extension (`axis` on `resolveRovingIntent`, +5 tests) →
one composable option (`axis` passthrough) → horizontal-mode wiring on the chip
band that coexists with the Batch C focus-return via the composable's `focusin`
listener. The keyboard-a11y story now covers both Discover list surfaces (card
grid + chip band) with a single tested primitive.
