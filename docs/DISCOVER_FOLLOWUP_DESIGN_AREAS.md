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

---

## Proposed (next three)

Status: Proposed (not yet implemented). Each is scoped to be picked up
independently.

### 1. Focus management on add / remove transitions

**Problem.** When an artist is added (modal closes, the card flips to
`Monitored`, a new seed chip appears, recommendations re-rank), keyboard focus is
not deliberately managed. After the modal closes, focus can land on `<body>`,
forcing keyboard and screen-reader users to re-traverse the page. The W3C APG
dialog guidance requires returning focus to a sensible element on close.

**Proposal.** On modal close, return focus to the triggering card's primary
control (or, if the card became disabled, to the new seed chip / next actionable
card). Encapsulate the logic in a small `useReturnFocus` composable so the
container stays declarative, and announce the result via a polite live region
("Added <artist> to monitoring").

**Why it is high value.** Closes a real accessibility gap on the most-used
Discover action and makes rapid keyboard-driven adding pleasant.

| Pros | Cons |
| --- | --- |
| Meets APG dialog focus-return expectations | Focus targets shift as the list re-ranks — must resolve a stable fallback |
| Reusable composable for other modals | Needs `ref` wiring from cards back to the container |

**Touch points.** New `useReturnFocus` composable, `AddArtistModal` close path,
`DiscoverView` add flow, a polite live region for the confirmation.

**Verify against:** `w3c/aria-practices` dialog (modal) pattern — focus on open,
focus return on close.

---

### 2. Engine score transparency (progressive disclosure)

**Problem.** Provenance now explains *which signals* contributed, but the
numeric `rankScore` / `score` and `seedCount` strength are still invisible.
Power users tuning their library cannot see *how strong* an overlap is, only its
category.

**Proposal.** Add an opt-in, non-intrusive disclosure: an accessible
`title`/tooltip (or a details popover) on the provenance badge that surfaces a
human-readable strength ("Strong overlap · shared by 3 of your monitored
artists") derived in `discover-presentation.js`. Keep the raw float out of the
UI; present bucketed strength tiers instead.

**Why it is high value.** Deepens trust for advanced operators without cluttering
the default view (progressive disclosure).

| Pros | Cons |
| --- | --- |
| Pure, testable bucketing; no API change | Tooltip a11y must be done properly (focusable, ESC-dismiss) |
| Default view stays clean | Risk of exposing internal scoring semantics — keep to buckets |

**Touch points.** New `buildRecommendationStrength*` helpers (+ tests), badge
disclosure affordance in `DiscoverArtistCard` / `DiscoverRecommendationsPanel`.

---

### 3. Recommendation pagination via a scoped-slot list primitive

**Problem.** `computeSuggestions` caps output at 20 and the grid renders all of
them at once. As monitored libraries grow, operators want to see *more*
recommendations without an unbounded DOM, and the panel re-implements grid
markup that other surfaces also need.

**Proposal.** Introduce a reusable `PaginatedArtworkGrid` (or "show more"
incremental reveal) built with the verified Vue **scoped-slot** pattern: the
primitive owns paging/visible-count state and exposes each item back to the
parent via a scoped slot, so `DiscoverRecommendationsPanel` and
`DiscoverSearchResultsPanel` share one implementation. Raise the engine cap and
reveal incrementally.

**Why it is high value.** Scales the core browse experience and removes duplicated
grid markup across panels.

| Pros | Cons |
| --- | --- |
| One tested list primitive, reused across panels | Must keep keyboard/`role="list"` semantics intact while paging |
| Bounds the DOM as data grows | Interacts with artwork resolution — resolve only visible items |

**Touch points.** New `PaginatedArtworkGrid.vue` (scoped slot), adoption in both
Discover panels, optional bump to the `computeSuggestions` limit.

**Verify against:** `vuejs/docs` · `src/guide/components/slots.md` (scoped slots).

---

## Suggested sequencing

1. **Focus management** — accessibility correctness on the primary action.
2. **Score transparency** — small, additive, builds on provenance.
3. **Paginated grid** — largest surface; best once the panels are stable.
