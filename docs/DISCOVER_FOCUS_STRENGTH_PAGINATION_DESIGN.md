# Discover — Focus Return, Strength Disclosure & Pagination

Status: **Implemented.** This document records the design and outcome for the
three follow-up areas (Batch C) proposed in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md):

1. **Focus management** on add transitions.
2. **Engine score transparency** (progressive disclosure).
3. **Recommendation pagination** via a scoped-slot list primitive.

It builds on
[DISCOVER_PROVENANCE_STATE_DECOMPOSITION_DESIGN.md](DISCOVER_PROVENANCE_STATE_DECOMPOSITION_DESIGN.md)
and
[DISCOVER_REDESIGN_DESIGN.md](DISCOVER_REDESIGN_DESIGN.md).

---

## 1. Research (verified sources)

Research was gathered by reading official documentation directly from canonical
repositories (no assumed URLs). Tavily MCP was unavailable (invalid API key), so
sources were read through the GitHub MCP `get_file_contents` API against the
upstream repositories that publish the official docs.

| Topic | Source (repo · path) | Takeaway applied |
| --- | --- | --- |
| Dialog focus return on close | `w3c/aria-practices` · `content/patterns/dialog-modal/dialog-modal-pattern.html` | "When a dialog closes, focus returns to the element that invoked the dialog **unless** the invoking element no longer exists or is no longer focusable, in which case focus is set on another element that provides a logical work flow." |
| Add-rows precedent | `w3c/aria-practices` · dialog-modal pattern (example notes) | After an "Add Rows" dialog closes, focus moves to the first cell of the first new row — the new content, not the (now-changed) trigger. |
| Scoped slots | `vuejs/docs` · `src/guide/components/slots.md` | A list primitive can own paging state and hand each item back to the parent via a scoped slot, so panels share one implementation. |
| `defineExpose` | `vuejs/docs` · `src/api/sfc-script-setup.md` | A child component may expose imperative methods (here `focusArtistChip`) to a template `ref` on the parent. |

**Why these clauses matter here.** The Discover add flow already saved the
invoking element on open and called `.focus()` on close. But on a *successful*
add, the invoking "Add" button flips to a disabled "Monitored" state — so the
restore call is a silent no-op and focus drops to `<body>`. That is exactly the
APG edge case: the invoker is "no longer focusable", so focus must move to a
logical follow-on element (the newly added artist's seed chip).

---

## 2. Design

### 2.1 Focus management on add transitions

The decision of *whether* to restore focus to the invoker is isolated into a
pure, DOM-free predicate so it can be unit-tested with the native Node runner.
The component performs only the actual `.focus()` call.

- `src/client/lib/focus-return.js`
  - `shouldRestoreInvokerFocus({ invokerConnected, invokerDisabled })` →
    `invokerConnected === true && invokerDisabled !== true` (strict booleans, no
    truthy coercion).
  - `describeInvoker(element)` → thin DOM adapter returning
    `{ invokerConnected: element.isConnected === true, invokerDisabled:
    element.disabled === true || element.getAttribute?.('aria-disabled') ===
    'true' }`; returns a safe `{ false, false }` for `null`/`undefined`.

- `AddArtistModal.vue` — on close, restores focus to the invoker only when
  `shouldRestoreInvokerFocus(describeInvoker(previouslyFocusedElement))` is true;
  otherwise it emits a new `focus-return-unavailable` event (added to
  `defineEmits`).

- `DiscoverRecommendationsPanel.vue` — keeps a plain `Map` of artist id → seed
  chip element (`setChipRef`) and exposes `focusArtistChip(artistId)` via
  `defineExpose`.

- `DiscoverView.vue` — records `lastAddedArtistId` on a successful add and, on
  `@focus-return-unavailable`, calls
  `recommendationsPanelRef.value?.focusArtistChip(lastAddedArtistId)` on the next
  tick, moving focus to the new seed chip.

The success toast ("Added <artist> to monitored artists.") is already announced
by `ToastStack.vue` (`role="status"` + `aria-live="polite"`), so **no redundant
live region** was added.

### 2.2 Engine score transparency

A single pure helper buckets the engine's ranked overlap score into a small fixed
enumeration; the raw float never reaches the DOM.

- `src/client/lib/discover-presentation.js` —
  `buildRecommendationStrength(suggestion)` reads `rankScore` (falling back to
  `score`, then `0`), guards non-finite values, and returns:
  - `rankScore >= 1.5` → `{ tier: 'strong', label: 'Strong overlap' }`
  - `rankScore >= 0.8` → `{ tier: 'moderate', label: 'Moderate overlap' }`
  - otherwise → `{ tier: 'emerging', label: 'Emerging overlap' }`

- `DiscoverArtistCard.vue` — renders a tinted strength pill in the card eyebrow
  (`strengthLabel` / `strengthTier` props), with a `::before` dot colored per
  `data-tier`. Progressive disclosure: the default view stays clean, the badge
  category answers *why*, the strength pill answers *how strong*.

### 2.3 Recommendation pagination

A reusable primitive owns paging state; the math is a pure module.

- `src/client/lib/paginated-list.js` — `clampVisibleCount(desired, total,
  step=12)`, `resolveNextVisibleCount(current, total, step=12)`,
  `resolveRemainingCount(visibleCount, total)`. All bound-checked and non-finite
  safe; floor is one page (or `total` if smaller), ceiling is `total`.

- `src/client/components/media/PaginatedArtworkGrid.vue` — a `role="list"`
  artwork grid that reveals `visibleItems` incrementally via a per-item **scoped
  slot** (`:item`, `:index`), re-clamps on `items.length` change, and renders a
  "Show more" ghost button when items remain.

- Adopted by both `DiscoverRecommendationsPanel.vue` (initial 8, step 8) and
  `DiscoverSearchResultsPanel.vue` (initial 12, step 12), removing duplicated
  grid markup/CSS from both panels.

---

## 3. Security

- **No injection surface.** Strength labels come from a fixed enumeration; no
  engine- or user-supplied string is ever rendered as markup. No `v-html` is
  introduced anywhere in this batch.
- **Client-only paging.** Pagination is in-memory array slicing — no new network,
  query, or data surface.
- **Focus uses DOM refs only.** Focus return operates on element references that
  already exist in the page; the decision logic is value-only and cannot reach
  the network or the DOM.
- **Embedding separation preserved.** No change touches text/image embedding model
  selection or test paths.

---

## 4. Files changed

| File | Change |
| --- | --- |
| `src/client/lib/focus-return.js` | **New.** Pure `shouldRestoreInvokerFocus` + `describeInvoker` adapter. |
| `src/client/lib/paginated-list.js` | **New.** Pure paging math (`clamp` / `next` / `remaining`). |
| `src/client/lib/discover-presentation.js` | Added `buildRecommendationStrength`. |
| `src/client/components/media/PaginatedArtworkGrid.vue` | **New.** Scoped-slot `role="list"` grid with "show more". |
| `src/client/components/media/DiscoverArtistCard.vue` | Strength pill in the eyebrow (`strengthLabel` / `strengthTier`). |
| `src/client/components/media/DiscoverRecommendationsPanel.vue` | Adopts the grid; exposes `focusArtistChip`; chip `ref` map. |
| `src/client/components/media/DiscoverSearchResultsPanel.vue` | Adopts the grid; removed duplicated grid markup/CSS. |
| `src/client/components/media/AddArtistModal.vue` | Guards focus return; emits `focus-return-unavailable`. |
| `src/client/views/DiscoverView.vue` | Strength on cards; panel `ref`; post-add focus handoff. |
| `test/client/focus-return.test.js` | **New.** 16 tests. |
| `test/client/paginated-list.test.js` | **New.** 18 tests. |
| `test/client/discover-presentation.test.js` | Added `buildRecommendationStrength` tests. |

---

## 5. Validation

- Targeted: `node --test` over the three client test files — **126 pass, 0 fail**.
- Full client suite: `node --test "test/client/*.test.js"` — **3424 pass, 0 fail**.
- Lint: `npx eslint` on every changed source/test file — clean.
- Copyright: `node scripts/check-copyright.js` — **821 files**, compliant (new
  files carry GPL headers).

---

## 6. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Pure `focus-return` predicate + emit fallback | DOM-free, unit-testable; matches APG add-rows precedent exactly | Container must own the fallback target | **Adopted.** |
| Visible strength **pill** (not a tooltip) | No tooltip-a11y complexity; always visible; fixed-enum is injection-safe | Slightly more chrome on each card | **Adopted.** |
| `PaginatedArtworkGrid` scoped-slot primitive | One tested primitive reused by both panels; bounds the DOM | Parents must use a slot template | **Adopted.** |

**Final stack.** Pure logic in `lib/` (DOM-free, fully tested) + thin component
wiring (focus calls, slots, refs) that is intentionally not unit-tested in the
absence of jsdom. Fixed-enum labels, client-only slicing, and ref-only focus keep
the surface secure.
