# Discover Re-Architecture — Design & Outcome

Status: Implemented (phase 1 of 3 covering layout, language, and the chip
interaction hazard). Author: platform re-architecture pass.

## Purpose

`DiscoverView` had drifted into a marketing-style landing page that fought the
rest of the product. Harmoniarr is a dense, self-hosted *arr-style ops console;
Discover is where an operator **searches for an artist, evaluates candidates,
and adds them to monitoring**. This document records the design decisions, the
evidence behind them, and the outcome of the first three changes:

1. Strip the marketing hero + prose summary cards; lead with search and results.
2. Route all Discover copy through the pure, tested presentation library and
   remove off-model `seed`/`graph`/`taste profile`/`workspace` language.
3. Fix the monitored-artist chip delete-on-click hazard by making chips
   navigate to artist detail instead of destroying recommendation state.

## Research basis

The web-search MCP (Tavily) returned `Invalid API key` in this environment, so
sources were verified through the GitHub MCP (repository existence and recent
update timestamps) and then read directly from their canonical URLs. All sources
showed activity within days of the work (June 2026), confirming currency.

| Source | Repo (verified) | Used for |
| --- | --- | --- |
| [Vue 3 — Component Events](https://vuejs.org/guide/components/events.html) | `vuejs/docs` | Props-down/events-up, `defineEmits`, kebab-case listeners |
| [Vue 3 — Composables](https://vuejs.org/guide/reusability/composables.html) | `vuejs/docs` | `useX` naming, return refs, single concern |
| [W3C APG — Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | `w3c/aria-practices` | Focus loss after destructive list operations |
| [W3C APG — Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | `w3c/aria-practices` | A cell holding a single link/button focuses that widget |
| [Radarr](https://github.com/Radarr/Radarr) | `Radarr/Radarr` | Reference *arr ops-console density and IA |

Key takeaways applied:

- **APG (focus management):** performing "a destructive operation like deleting
  an item from a list" without deliberate focus handling drops focus to
  `<body>`. The old chip destroyed graph state on its primary click with no
  focus handling — the exact anti-pattern. The fix removes the destructive
  primary click entirely.
- **APG (grid/links):** when a control is "a single widget … a link," focus and
  the click target should be that widget. A monitored-artist chip is therefore
  modeled as one `RouterLink`, not a button with hidden side effects.
- **Vue events/composables:** the recommendation composable
  (`useDiscoverGraph`) is correct and unchanged; the *view* was overloaded. Copy
  and derived text were lifted into a pure module so the view stays an
  orchestration container.

## Decisions, pros, and cons

### A. Layout & information hierarchy (item 1)

**Decision:** Remove the `.discover-stage` hero (eyebrow, oversized headline,
marketing paragraph, signal pills) and the three prose summary cards. Lead with
a compact `hx-page-header` that contains the search form, followed by a single
thin count strip (`monitored` / `recommended` / `results` / `Refreshing`).

| Option | Pros | Cons |
| --- | --- | --- |
| **Search-led header + count pills (chosen)** | Matches console density; first screen is actionable; removes off-model copy | Loses the "welcome"; counts re-surfaced compactly |
| Keep hero, shrink copy | Less churn | Still marketing-led; violates density |
| Counts only, no header copy | Maximal density | Loses orientation for new operators |

### B. Language centralization (item 2)

**Decision:** Move every piece of Discover copy and all derived card text into
`src/client/lib/discover-presentation.js` as pure functions, and replace the
banned terms (`seed`, `graph`, `taste profile`, `workspace`, `profile match`,
`Recommendation grid`) with product-language-compliant wording (`monitored
artists`, `Recommended artists`, `Search match`, `Add to monitored artists`).

| Option | Pros | Cons |
| --- | --- | --- |
| **Centralize in tested lib (chosen)** | Single source of truth; unit-tested; on-model; prevents drift | Required updating the presentation tests |
| Edit inline template strings | Fast | Untested, drifts back, still off-model |

The internal composable retains `seed`/`removeSeed` identifiers — permitted by
the product-language rule for legacy implementation internals — but no new
public copy or API references it.

### C. Monitored-artist chip interaction (item 3)

**Decision:** Convert each monitored-artist chip from a `<button>` that called
`removeSeed(id)` (labeled "Remove") into a `RouterLink` that navigates to the
artist detail page. The destructive primary click is removed; monitoring is
managed on the artist detail / Home surfaces, not Discover.

| Option | Pros | Cons |
| --- | --- | --- |
| **Chip is a navigation link (chosen)** | APG-compliant single-widget focus; matches product IA (management lives elsewhere); removes the hidden destructive click | Loses in-Discover graph trimming (intended — not Discover's job) |
| Button + explicit "×" + confirm | Preserves trimming | Re-introduces management into Discover; more controls; off-model |
| Whole-chip nav + nested remove button | — | Nested interactive elements — APG anti-pattern; rejected |

## Final recommended stack (implemented)

1. **Container/presentational discipline** — `DiscoverView` stays the
   orchestration container; copy and derived text live in the pure
   `discover-presentation.js`. (Full child-component extraction is deferred; see
   "Follow-up design areas".)
2. **Layout** — search-led header + compact count strip → recommendations
   section → search-results section → single empty-state ladder.
3. **Language** — product-language-compliant, library-sourced, banned terms
   removed.
4. **Interaction/a11y** — monitored chips are navigation links with
   `:focus-visible` rings and descriptive `View <name>` aria labels; card
   add-buttons keep their disabled/`aria-busy` semantics.
5. **Security** — text interpolation only; no `v-html` and no new injection
   surface; `formatDiscoverSearchError` still strips internal service names
   (e.g. MusicBrainz) from user-facing errors to avoid information leakage. No
   change to data flow, auth, or network calls.

## Outcome

- `src/client/views/DiscoverView.vue`: removed the hero article, the
  `summaryCards` computed, the inline `buildSuggestion*`/`buildResult*` helpers,
  and the `removeSeed` usage; added a search-led header, a count strip, and a
  navigation-based monitored-artist band; all card props now read from the
  presentation library.
- `src/client/lib/discover-presentation.js`: removed
  `buildDiscoverGraphSubtitle`, `buildDiscoverSeedsAriaLabel`,
  `buildDiscoverSeedRemoveAriaLabel`; added
  `buildDiscoverRecommendationsSubtitle`,
  `buildDiscoverMonitoredArtistsAriaLabel`,
  `buildDiscoverMonitoredArtistNavAriaLabel`, `buildDiscoverMonitoredBandCopy`,
  `buildDiscoverSuggestionsCopy`, `buildRecommendationBadgeLabel/Tone`,
  `buildRecommendationMeta`, `buildRecommendationSupport`,
  `buildSearchResultBadgeLabel/Tone`, `buildSearchResultMeta`,
  `buildSearchResultSupport`; updated the page subtitle and pre-search body copy.
- `test/client/discover-presentation.test.js`: replaced the removed-function
  tests and added coverage for every new helper.

> Note: Batch B (see
> [DISCOVER_PROVENANCE_STATE_DECOMPOSITION_DESIGN.md](DISCOVER_PROVENANCE_STATE_DECOMPOSITION_DESIGN.md))
> later superseded `buildRecommendationBadgeLabel/Tone` with
> `buildRecommendationProvenance`.

## Validation

- `node --test test/client/discover-presentation.test.js` → **76/76 pass**.
- `npx eslint` on the three changed files → clean (no unused symbols after the
  `computed`, `hasSuggestions`, and `removeSeed` removals).
- Workspace diagnostics on all three files → no errors.

## Follow-up design areas

See [DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md) for the
next three proposed high-value targets (recommendation provenance, empty-state
state machine, and component decomposition).
