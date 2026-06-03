# Discover — Provenance, View-State & Component Decomposition

Status: **Implemented.** This document records the design and outcome for the
three follow-up areas proposed in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md):

1. Recommendation **provenance badges**.
2. Discover search **view-mode state machine**.
3. Container/presentational **component decomposition**.

It builds on the layout/language/interaction pass in
[DISCOVER_REDESIGN_DESIGN.md](DISCOVER_REDESIGN_DESIGN.md).

---

## 1. Research (verified sources)

Research was gathered by reading official documentation directly from canonical
repositories (no assumed URLs). Tavily MCP was unavailable (invalid API key), so
sources were read through the GitHub MCP `get_file_contents` API against the
upstream repos that publish the official docs.

| Topic | Source (repo · path) | Takeaway applied |
| --- | --- | --- |
| Component props (down) / events (up) | `vuejs/docs` · `src/guide/components/events.md` | Children receive plain props and emit intent (`add`); the container owns state. |
| Slots & conditional content | `vuejs/docs` · `src/guide/components/slots.md` | Panels render their own static copy; the container passes only data. |
| `defineModel` two-way binding | `vuejs/docs` · `src/guide/components/v-model.md` | `DiscoverSearchBar` owns the query via `defineModel`, keeping the input self-contained. |
| Alert pattern (`role="alert"`) | `w3c/aria-practices` · `content/patterns/alert/alert-pattern.html` | The recommendation-error line uses `role="alert"`; it must not move focus and must not auto-dismiss. |
| Status pattern (`role="status"`) | `w3c/aria-practices` · keyboard/live-region guidance | The "searching" card uses `role="status"` + `aria-live="polite"` for a non-interrupting announcement. |

Key engineering discovery: the recommendation engine already tags every
candidate with a `source` (`musicbrainz` / `listenbrainz` / `lastfm` / `both`),
and that field survives to the client's per-seed results. The previous
`computeSuggestions` tally **discarded** it. Surfacing provenance is therefore a
**pure client change** — no backend, route, or schema edits are required.

---

## 2. Recommendations (pros / cons + final stack)

### 2.1 Provenance badges

**Decision.** Aggregate each candidate's engine `source` values across all seeds
into a de-duplicated `sources` array in the pure graph tally, then map that set
to a single, explainable badge drawn from a **fixed enumeration**.

| Source set | Badge label | Tone |
| --- | --- | --- |
| related + listeners | `Related + listeners` | `success` |
| related only | `Related artist` | `info` |
| listeners only | `Listener overlap` | `info` |
| unknown / empty | `Recommended` | `info` |

`musicbrainz` → *related* (editorial/relationship data); `listenbrainz` /
`lastfm` → *listeners* (listening-history data); `both` expands to both
categories.

| Pros | Cons |
| --- | --- |
| Explains *why* an artist surfaced → operator trust | Replaces the placeholder "N matches" badge (count moves to the meta line) |
| Pure, fully unit-tested; injection-safe fixed enum | Adds a `sources` field to the tally output |
| No API/schema change — `source` already reaches the client | Provenance ≠ score; raw score stays out of the primary view |

The seed-overlap strength ("Shared by N of your monitored artists") remains on
the card **meta line**, so no information is lost by repurposing the badge.

### 2.2 View-mode state machine

**Decision.** Replace the order-sensitive `v-if / v-else-if` ladder with a single
pure resolver, `resolveDiscoverSearchPanelMode(flags)`, returning one of
`'error' | 'pre-search' | 'searching' | 'empty' | 'results' | 'idle'`. The
template switches on the one value; each branch gets consistent live-region
semantics.

Precedence (preserved exactly): `error` → `pre-search` (only when no seeds) →
`searching` → `empty` → `results` → `idle` (seeds present, no search yet — the
panel yields to the recommendations section).

| Pros | Cons |
| --- | --- |
| One source of truth; enumerable + unit-tested | Small template refactor |
| Consistent `role="alert"` / `role="status"` a11y | Must preserve precedence (covered by tests) |

### 2.3 Component decomposition

**Decision.** Turn `DiscoverView.vue` into a thin orchestration container that
builds plain **view-model** computeds and delegates rendering to three
presentational children:

- `DiscoverSearchBar.vue` — `defineModel` query, `isSearching` prop, emits `submit`.
- `DiscoverRecommendationsPanel.vue` — `chips`, `cards`, `isLoading`,
  `errorMessage`, `monitoredAriaLabel` props; emits `add`; owns its static copy.
- `DiscoverSearchResultsPanel.vue` — `cards` prop; emits `add`.

The container resolves artwork **before** passing it down (resolved artwork, not
the resolver), avoiding prop-drilling of composable getters.

| Pros | Cons |
| --- | --- |
| Container = orchestration only; children testable in isolation | More files + prop/event plumbing |
| Children stay logic-free (props-down/events-up) | View-model computeds must stay pure/declarative |

### 2.4 Final stack

- **Graph:** `computeSuggestions` aggregates a `sources` Set → sorted, de-duped
  `sources[]` on each suggestion.
- **Presentation lib:** `buildRecommendationProvenance(suggestion)` and
  `resolveDiscoverSearchPanelMode(flags)` (both pure, both unit-tested). The
  placeholder `buildRecommendationBadgeLabel/Tone` helpers were removed.
- **Components:** `DiscoverSearchBar`, `DiscoverRecommendationsPanel`,
  `DiscoverSearchResultsPanel`; `DiscoverView` reduced to container + three
  view-model computeds (`monitoredChips`, `recommendationCards`,
  `searchResultCards`) + `searchPanelMode`.

---

## 3. Outcome

### Files changed

| File | Change |
| --- | --- |
| `src/client/lib/discover-graph.js` | `computeSuggestions` aggregates engine `source` into a sorted, de-duplicated `sources[]` per suggestion. |
| `src/client/lib/discover-presentation.js` | Removed `buildRecommendationBadgeLabel/Tone`; added `buildRecommendationProvenance` (fixed-enum badge) and `resolveDiscoverSearchPanelMode` (state resolver). |
| `src/client/components/media/DiscoverSearchBar.vue` | New — self-contained search input (`defineModel`, emits `submit`). |
| `src/client/components/media/DiscoverRecommendationsPanel.vue` | New — monitored chips + recommendation grid; owns static copy; `role="alert"` error line. |
| `src/client/components/media/DiscoverSearchResultsPanel.vue` | New — search-result grid. |
| `src/client/views/DiscoverView.vue` | Slimmed to a container: view-model computeds + `searchPanelMode`; delegates to the three panels; `searching` card now `role="status"`. |
| `test/client/discover-graph.test.js` | Added `sources` aggregation tests (single, merge, de-dupe, missing). |
| `test/client/discover-presentation.test.js` | Replaced badge-label/tone tests with `buildRecommendationProvenance` (incl. injection-safety) and `resolveDiscoverSearchPanelMode` precedence tests. |
| `test/browser/issue-4-visual-evidence.test.js` | Evidence description updated to product language ("recommended artists"). |

### Validation

- `node --test test/client/*.test.js` → **3384 passing, 0 failing.**
- `npx eslint` on all changed files → clean.
- `get_errors` on all changed `.vue`/`.js` files → no diagnostics.

### Security notes

- **No new injection surface.** Provenance labels come from a fixed
  enumeration; no engine- or user-supplied string is rendered as the badge. A
  unit test asserts that even a markup-like `source` resolves to an allowed
  label only.
- **No `v-html`.** All dynamic text uses interpolation.
- **No new data/network flow.** Provenance reuses a field already present on the
  client; error copy continues to strip internal service names.

---

## 4. Next three high-value areas

See the refreshed proposals in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md):
focus management on add/remove transitions, engine score transparency, and
recommendation pagination via a scoped-slot list primitive.
