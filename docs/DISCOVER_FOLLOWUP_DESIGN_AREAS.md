# Discover — Follow-up Design Areas

This document tracks the rolling backlog of high-value Discover design targets.
Completed batches are summarized with links to their design docs; the live
section at the bottom holds the next three proposals.

---

## Completed

### Batch A — Layout, language & interaction
See [DISCOVER_REDESIGN_DESIGN.md](DISCOVER_REDESIGN_DESIGN.md).
Search-led header, product-language copy, monitored chips as navigable links.

### Batch B — Provenance, view-state & decomposition
See
[DISCOVER_PROVENANCE_STATE_DECOMPOSITION_DESIGN.md](DISCOVER_PROVENANCE_STATE_DECOMPOSITION_DESIGN.md).

1. **Recommendation provenance badges** — engine `source` aggregated into a
   de-duplicated `sources[]` in `computeSuggestions` and mapped to a fixed-enum
   badge (`Related + listeners` / `Related artist` / `Listener overlap` /
   `Recommended`) via `buildRecommendationProvenance`.
2. **View-mode state machine** — `resolveDiscoverSearchPanelMode(flags)` replaces
   the `v-if` ladder with one pure, tested resolver; `role="alert"` /
   `role="status"` standardized.
3. **Component decomposition** — `DiscoverView` is now a thin container with
   `monitoredChips` / `recommendationCards` / `searchResultCards` / `searchPanelMode`
   computeds delegating to `DiscoverSearchBar`, `DiscoverRecommendationsPanel`,
   and `DiscoverSearchResultsPanel`.

### Batch C — Focus return, strength disclosure & pagination
See
[DISCOVER_FOCUS_STRENGTH_PAGINATION_DESIGN.md](DISCOVER_FOCUS_STRENGTH_PAGINATION_DESIGN.md).

1. **Focus management on add transitions** — DOM-free `shouldRestoreInvokerFocus` /
   `describeInvoker` (`focus-return.js`) guard the modal's APG focus-return; when
   the invoking "Add" button is disabled after the add, the modal emits
   `focus-return-unavailable` and the container moves focus to the new seed chip
   (`focusArtistChip`).
2. **Engine score transparency** — `buildRecommendationStrength(suggestion)` buckets
   `rankScore` into a fixed `strong` / `moderate` / `emerging` enum rendered as a
   tinted strength pill in `DiscoverArtistCard`; no raw float reaches the UI.
3. **Recommendation pagination** — reusable `PaginatedArtworkGrid.vue` (scoped slot,
   `role="list"`) with pure paging math (`paginated-list.js`) reveals items
   incrementally and is shared by both Discover panels.

---

## Proposed (next three)

Status: Proposed (not yet implemented). Each is scoped to be picked up
independently.

### 1. Roving-tabindex keyboard navigation for the artwork grid

**Problem.** `PaginatedArtworkGrid` now exposes a `role="list"`, but every card's
interactive controls remain in the natural tab order. As lists grow (and paging
reveals more), keyboard users must Tab through dozens of controls to cross the
grid. The W3C APG grid/listbox guidance favors a single tab stop with arrow-key
roving focus.

**Proposal.** Add an opt-in roving-tabindex behaviour to the grid primitive: one
tab stop enters the grid, arrow keys move a `tabindex="0"` "active" cell while the
rest are `tabindex="-1"`, and Enter/Space activates the card's primary action.
Encapsulate the index math as a pure, tested helper (`resolveRovingIndex(current,
key, columns, total)`) so the DOM wiring in the component stays thin.

**Why it is high value.** Turns a long, tab-heavy grid into a fast,
spec-compliant keyboard surface — directly building on the Batch C primitive.

| Pros | Cons |
| --- | --- |
| Pure index math is fully unit-testable | Column count is layout-dependent (needs a resolved/observed value) |
| One tab stop instead of N×controls | Must coexist with paging reveal and `role="list"` semantics |

**Touch points.** New `roving-index.js` (+ tests), opt-in props on
`PaginatedArtworkGrid`, key handling in the grid.

**Verify against:** `w3c/aria-practices` — grid / listbox keyboard interaction
(roving tabindex).

---

### 2. Artwork loading skeletons & stable card geometry

**Problem.** Artwork resolves asynchronously per visible artist. Cards currently
pop from a blank/initial state to an image, causing layout shift and a flicker as
the grid (and paging reveal) fills in. There is no explicit loading affordance,
so a slow source looks like a broken card.

**Proposal.** Give `DiscoverArtistCard` an explicit `loading` state (driven by the
container's `isResolvingArtistArtwork`) that renders a fixed-aspect skeleton
placeholder, reserving the artwork box geometry so nothing reflows when the image
arrives. Derive the display state with a pure helper
(`resolveArtworkDisplayState({ url, isResolving })` → `image | loading | initial`).

**Why it is high value.** Removes the most visible jank on the primary browse
surface and makes slow sources legible instead of looking broken.

| Pros | Cons |
| --- | --- |
| Eliminates cumulative layout shift in the grid | Needs a reserved aspect-ratio box in card CSS |
| Pure state resolver is testable; honors text/image embedding separation | Skeleton shimmer must respect `prefers-reduced-motion` |

**Touch points.** New `resolveArtworkDisplayState` helper (+ tests),
`DiscoverArtistCard` artwork slot + skeleton CSS, container passes a `loading`
flag.

**Verify against:** `w3c/aria-practices` busy/`aria-busy` guidance;
`prefers-reduced-motion` media query for the shimmer.

---

### 3. Search debounce & typeahead affordance

**Problem.** Discover search is submit-only: the operator types a full query and
presses enter. There is no incremental feedback, and rapid resubmissions can fire
overlapping MusicBrainz requests. For exploratory discovery, a debounced
typeahead is the expected interaction.

**Proposal.** Add a pure, tested debounce/coalescing helper
(`shouldDispatchQuery(prev, next, { minLength, sinceMs })`) and a small
`useDebouncedSearch` composable that wraps `useDiscoverSearch`, dispatching after
a quiet interval once a minimum length is met and cancelling in-flight requests
on a newer query. Keep the explicit submit as a fallback.

**Why it is high value.** Makes search feel live, cuts wasted upstream requests,
and reduces error noise from half-typed queries.

| Pros | Cons |
| --- | --- |
| Pure dispatch-decision logic is unit-testable | Must respect MusicBrainz rate limits — debounce + cancel are required |
| Fewer wasted requests; snappier UX | Needs request cancellation/stale-result guarding |

**Touch points.** New `shouldDispatchQuery` helper (+ tests),
`useDebouncedSearch` composable, `DiscoverSearchBar` wiring, stale-response guard
in `useDiscoverSearch`.

**Verify against:** MusicBrainz rate-limit guidance (one request/second); AbortController
request cancellation.

---

## Suggested sequencing

1. **Roving-tabindex navigation** — completes the keyboard story on the Batch C grid.
2. **Artwork skeletons** — small, additive visual-stability win.
3. **Search debounce/typeahead** — largest surface; touches upstream request flow.
