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

### Batch D — Roving-tabindex keyboard navigation for the artwork grid
See [DISCOVER_ROVING_TABINDEX_DESIGN.md](DISCOVER_ROVING_TABINDEX_DESIGN.md).

Opt-in W3C-APG roving tabindex over the Batch C grid: one card link is the single
tab stop, arrow/Home/End/Ctrl+Home/Ctrl+End keys move focus, and the rest are
removed from the tab order. Pure index/intent math in `roving-index.js`
(`resolveRovingIntent` + `resolveRovingIndex`) + DOM-scoped controller in
`useRovingTabindex.js`. The container stays `role="list"` (navigable cards, not
tabular data), columns are resolved at runtime from computed grid tracks, and
horizontal movement is linear while vertical uses the column stride.

### Batch E — Artwork loading skeletons & stable card geometry
See [DISCOVER_ARTWORK_SKELETONS_DESIGN.md](DISCOVER_ARTWORK_SKELETONS_DESIGN.md).

Pure `resolveArtworkDisplayState({ url, isResolving })` → `image | loading |
initial` drives a three-branch artwork slot in `DiscoverArtistCard`: a neutral
`aria-hidden` skeleton during resolution (instead of a misleading avatar),
reusing the global `hx-skeleton-pulse` keyframes. The container's existing
`aspect-ratio` already held geometry (no CLS); this batch adds the explicit
loading affordance and brings reduced-motion compliance (`prefers-reduced-motion`)
to the new skeleton plus the pre-existing `.hx-skeleton` primitive and
`ArtworkImage` shimmer client-wide.

### Batch F — Roving tabindex for the monitored-artist chip band
See [DISCOVER_MONITORED_CHIP_ROVING_DESIGN.md](DISCOVER_MONITORED_CHIP_ROVING_DESIGN.md).

Reuses the Batch D `useRovingTabindex` composable on the monitored-artist chip
band in horizontal mode (APG toolbar model): one chip is the single tab stop,
Left/Right + Home/End move focus, the rest leave the tab order. Added an `axis`
(`grid`/`horizontal`/`vertical`) to the pure `resolveRovingIntent` so a 1-D band
ignores Up/Down; coexists with the Batch C focus-return via the composable's
`focusin` listener. Completes the keyboard story across both Discover list
surfaces.

### Batch G — Monitored-chip ARIA role semantics
See [DISCOVER_CHIP_ROLE_SEMANTICS_DESIGN.md](DISCOVER_CHIP_ROLE_SEMANTICS_DESIGN.md).

Refactored the chip band to native `<ul>`/`<li>`/`<a>` and removed the
`role="listitem"` override from each `RouterLink`. The override was suppressing
the `<a>`'s implicit `link` role (W3C ARIA-in-HTML §3.1 anti-pattern); native
markup restores correct "link" announcements and provides list/listitem
semantics for free. A standard `<ul>` reset preserves the flex layout; Batch C/D/F
keyboard/focus behavior is unchanged.

### Batch H — Card-grid list semantics
See [DISCOVER_CARD_GRID_LIST_SEMANTICS_DESIGN.md](DISCOVER_CARD_GRID_LIST_SEMANTICS_DESIGN.md).

Migrated the shared `PaginatedArtworkGrid` to `<ul role="list">` + `<li>` per
card, using `display: contents` on the `<li>` so the slotted `<article>` cards
remain the CSS-grid items (zero layout change — MDN Grid-Accessibility guidance).
A scoped `<ul>` reset avoids touching the 10 other `.hx-artwork-grid` consumers.
Also restored `role="list"` on `list-style: none` lists (the chip band too),
fixing a Batch G Safari regression where `list-style: none` suppressed list
semantics. Completes list-semantics correctness across both Discover surfaces.

### Batch I — Platform-wide `.hx-artwork-grid` list semantics
See [ARTWORK_GRID_LIST_SEMANTICS_DESIGN.md](ARTWORK_GRID_LIST_SEMANTICS_DESIGN.md).

Extended the Batch H pattern to all 10 remaining `.hx-artwork-grid` consumers
(ActivityReleases ×2, ArtistDetail, Library, Missing, MyRequests,
Operator/Requester Home, Search ×2) and **centralized** it: the shared
`.hx-artwork-grid` rule now carries the `<ul>` reset and `> li { display: contents }`,
so every card grid is a `<ul role="list">` of `<li>`-wrapped cards with identical
layout. Added `aria-label` to the four unlabeled grids. The Batch H scoped
duplicate in `PaginatedArtworkGrid` was removed. List semantics are now correct
and consistent platform-wide, and future grids inherit the pattern automatically.

### Batch J — Card-grid roving tabindex (platform-wide) + ReleaseCard keyboard a11y
See [CARD_GRID_ROVING_DESIGN.md](CARD_GRID_ROVING_DESIGN.md).

Extended Batch D's roving tabindex to the shared card grids. Prerequisite fix:
`ReleaseCard`'s "open detail" action was mouse-only (`<article @click>`) — refactored
to a keyboard-accessible `<div role="button" class="hx-media-card__link-area">`
(sibling actions slot, no nested interactives), giving it the same roving target
as `ArtistCard`. Centralized the focus ring; added `useArtworkGridRoving` (roving +
refresh-on-count). Wired 8 grids (Search ×2, Home ×2, MyRequests, Library, Missing,
Activity ×2) with per-card `cellSelector`s (union selectors for the Home panels'
trailing discover card). ArtistDetail's per-section grids deferred.

### Batch K — ArtistDetail per-section roving
See [ARTIST_DETAIL_SECTION_ROVING_DESIGN.md](ARTIST_DETAIL_SECTION_ROVING_DESIGN.md).

Completed the platform-wide roving story. Added `ArtistReleaseSectionGrid.vue` —
a wrapper whose each instance owns a `useArtworkGridRoving` (called synchronously
in setup, per Vue's composable rules), so every discography section is an
independent roving composite (one tab stop per section; arrows stay within it).
A scoped slot keeps the `ReleaseCard` and its operator-policy actions in
`ArtistDetailView`'s scope. `artist-detail-grid` is passed as a class so the
scoped `--hx-artwork-grid-min` overrides still apply. All card grids in the
client are now roving-tabindex surfaces.

### Batch L — Keyboard sweep + focus-ring audit
See [KEYBOARD_FOCUS_AUDIT_DESIGN.md](KEYBOARD_FOCUS_AUDIT_DESIGN.md).

Consolidated static audit of focus indicators across every roving surface
(Batches D–K) against WCAG 2.2 §2.4.11/2.4.12/2.4.13. Found and fixed three gaps:
`.hx-btn` had no focus ring (platform-wide — added `:focus-visible` outline);
`.requester-home-discover-card` (a roving cell) had no ring (added); and
`.operator-home__discover-card` used only a weak art-color change (added a clear
perimeter outline, kept the enhancement). Every roving cell and every button now
carries a consistent, WCAG-compliant `:focus-visible` ring. Runtime Playwright/axe
confirmation remains as the final step in a seeded environment.

### Batch M — Artwork skeleton→image fade-in
See [ARTWORK_FADE_IN_DESIGN.md](ARTWORK_FADE_IN_DESIGN.md).

Completes the Batch E loading-state story. The skeleton now persists over the
fetch gap and the resolved `<img>` cross-fades in (`opacity 0→1`, 200ms) only on
`@load`, gated by `imageLoaded`/`imageFailed` refs (reset on URL change; `@error`
falls back to the avatar). The image overlays the skeleton (absolute, `inset:0`),
the artwork container became a positioning context (`position: relative`), and the
transition is scoped to `prefers-reduced-motion: no-preference` (CLS/LCP-safe —
geometry is reserved by the container's aspect-ratio). Includes an avatar fill fix.

### Batch N — Search debounce & typeahead
See [SEARCH_DEBOUNCE_TYPEAHEAD_DESIGN.md](SEARCH_DEBOUNCE_TYPEAHEAD_DESIGN.md).

Discover search now responds as the operator types. A pure `resolveSearchDispatch`
helper (min-length, de-dupe, rate-limit gates; 13 tests) drives a
`useDebouncedSearch` composable that debounces (350ms quiet), caps at MusicBrainz's
~1 req/s (`minIntervalMs`), and cancels in-flight searches via AbortController
(`searchMusicBrainzArtists` + `runSearch` became signal-aware; abort = cancellation,
not error). `runSearch`'s clear-results/panel-state behavior is preserved, and the
press-enter `submit()` fallback bypasses the rate cap. The search input stays
enabled while searching so typing continues.

### Batch O — Generalize artwork fade-in to `ArtworkImage`
See [ARTWORK_IMAGE_FADE_IN_DESIGN.md](ARTWORK_IMAGE_FADE_IN_DESIGN.md).

A CSS-only change attaches the Batch M `@load`-gated fade-in to `ArtworkImage`'s
existing `data-state` machine: `<img>` is `opacity: 0` until
`.hx-artwork[data-state='loaded']`, then fades to 1 over 200ms under
`prefers-reduced-motion: no-preference`. No JS/template/helper change (the state
machine + `@load` already exist). Now every card artwork — `ReleaseCard`,
`RequestCard`, `ArtistCard` default — fades in deliberately platform-wide, with
no double-application (`DiscoverArtistCard` keeps its own Batch M slot).

### Batch P — Typeahead result announcement (live region)
See [TYPEAHEAD_LIVE_REGION_DESIGN.md](TYPEAHEAD_LIVE_REGION_DESIGN.md).

Makes the Batch N typeahead screen-reader-accessible. A pure `buildSearchStatusMessage`
helper (11 tests) drives a visually-hidden `role="status" aria-live="polite"
aria-atomic="true"` region that announces only completed searches ("N artists
found" / "No artists found" / the formatted error) and stays quiet mid-flight to
avoid per-keystroke spam. Added a global `.sr-only` utility (replacing per-component
duplicates) and demoted the Batch B "searching" card to a plain visual article so
the live region is the single announcement source (the input's dynamic
`aria-label` + button `aria-busy` still convey the in-flight state).

### Batch Q — Prominent shared skeleton for `ArtworkImage`
See [ARTWORK_IMAGE_SKELETON_DESIGN.md](ARTWORK_IMAGE_SKELETON_DESIGN.md).

Replaced `ArtworkImage`'s faint 6%-white loading sheen with a solid skeleton
gradient + the global `hx-skeleton-pulse` keyframes (Batch E parity), so every
card artwork has consistent, visible loading feedback (WCAG 1.4.11 — faint
shimmers are missed by low-vision users). Deleted the now-unused local
`hx-artwork-shimmer` keyframes; the Batch O fade-in and reduced-motion guard are
unchanged. CSS-only.

### Batch R — Consolidate `sr-only` variants onto the global utility
See [SR_ONLY_CONSOLIDATION_DESIGN.md](SR_ONLY_CONSOLIDATION_DESIGN.md).

Replaced four component-scoped `sr-only` duplicates (`library-sr-only`,
`rdm-sr-only`, `rjt-sr-only`, RequestCard's scoped `.sr-only`) with the single
global `.sr-only` (Batch P). Deleted the four scoped definitions; the global
carries the canonical clip pattern incl. `clip-path: inset(50%)` (which three
variants lacked). One source of truth; no behavior change (all were the same
visually-hidden clip technique). CSS-only.

### Batch S — Cross-fade skeleton→image handoff
See [CROSSFADE_HANDOFF_DESIGN.md](CROSSFADE_HANDOFF_DESIGN.md).

Eliminated the brief container-bg flash during the artwork fade-in by keeping the
skeleton **persistent under** the fading image (not a literal cross-fade, which
causes a mid-transition "dip"). `ArtworkImage`: img gets `z-index: 1` (above the
`::after`); the skeleton `::after` persists during `[data-state='loaded']` with
`animation: none`. `DiscoverArtistCard`: `showSkeleton` persists during the image
state; `is-covered` class stops the pulse once loaded. No flash, no dip; reduced-
motion users get an instant swap.

### Batch T — Render performance: `content-visibility: auto` for card grids
See [CONTENT_VISIBILITY_DESIGN.md](CONTENT_VISIBILITY_DESIGN.md).

Added `content-visibility: auto` + `contain-intrinsic-size: auto 320px` to the
global `.hx-media-card` primitive. The browser skips layout/paint of off-screen
cards (estimated 50%+ rendering cost reduction on large grids) while rendering
on-screen and focused cards normally. Progressive enhancement (Baseline 2024);
roving-safe (focused cards are always "relevant to the user"); a11y-safe (content
stays in the DOM + accessibility tree). One CSS rule; no component changes.

### Batch U — `decoding="async"` on artwork images
See [DECODING_ASYNC_DESIGN.md](DECODING_ASYNC_DESIGN.md).

Added `decoding="async"` to all 5 artwork `<img>` elements (ArtworkImage,
DiscoverArtistCard, DiscoverRecommendationsPanel chip avatar, OperatorArtistCard,
ArtistDetailRelatedArtistCard). A progressive-enhancement hint (Baseline Jan 2020)
that lets the browser avoid blocking other content during image decode — most
impactful when many card images decode at once during scroll-fill. Pairs with
`loading="lazy"` (fetch deferral) and `content-visibility: auto` (render
deferral) to complete the three-stage artwork pipeline.

### Batch V — Consolidate `--hx-artwork-grid-min` overrides
See [GRID_MIN_CONSOLIDATION_DESIGN.md](GRID_MIN_CONSOLIDATION_DESIGN.md).

Removed dead code (the global mobile `--hx-artwork-grid-min: 140px` was
ineffective — every grid's scoped class wins on specificity) and added a
documentation registry (a table comment in `.hx-artwork-grid` listing every
per-view desktop/mobile value + scoped class). The per-view scoped overrides
stay (correct pattern for differing values + required specificity).

### Batch W — Route rogue card images through `ArtworkImage`
See [ROGUE_CARDS_ARTWORKIMAGE_DESIGN.md](ROGUE_CARDS_ARTWORKIMAGE_DESIGN.md).

Added a `#fallback` named slot to `ArtworkImage` (default: the music-note SVG) so
cards can provide a custom error placeholder. Routed `OperatorArtistCard`'s
artwork through `ArtworkImage` (gets the full skeleton/fade/cross-fade lifecycle
from Batches E/O/Q/S); the `#fallback` preserves its colored artist-initial
avatar. `ArtistDetailRelatedArtistCard` deferred (60px round avatar — layout
mismatch with ArtworkImage's square artwork box; low value at that size).

---

## Proposed (follow-up)

Status: Proposed (not yet implemented).

### Runtime keyboard verification (Playwright) in a seeded environment

**Problem.** Batch L performed the static focus-ring audit and fixed the gaps in
source, but the runtime behavior — actual arrow-key movement, Tab order across
composites, and per-surface 3:1 contrast of the rendered ring — can only be
proven in a running app. That needs the full stack (Express + PostgreSQL +
seeded data), which is not available in-env.

**Proposal.** Add a focused Playwright (test/browser) suite that, against a
seeded dev server, asserts: one tab stop enters each grid/section; Arrow /
Home / End / Ctrl+Home / Ctrl+End move focus as expected; Tab crosses between
composites; and the focused cell's computed outline meets the 2px/3:1 standard.
This converts the Batches D–L "recommended confirmation" notes into automated
evidence and guards against regressions.

**Why it is high value.** Locks in the platform-wide roving + focus work with
real, repeatable evidence; catches any runtime-only regression.

| Pros | Cons |
| --- | --- |
| Automated, repeatable proof of the a11y work | Requires a seeded full-stack environment to run |
| Guards Batches D–L against future regressions | Playwright suite is heavier than unit tests |

**Touch points.** `test/browser/` (new spec); seeded dev-server fixture; small
fixes if runtime gaps surface.

**Verify against:** W3C APG roving tabindex; WCAG 2.2 §2.4.11; axe-core.
