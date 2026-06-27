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

### Batch X — Discover browser keyboard verification
See [DISCOVER_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md](DISCOVER_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md).

Added a focused Playwright suite for Discover's runtime roving-tabindex behavior
using the existing seeded metadata browser fixtures. The suite proves the
recommended-artist card grid and monitored-artist chip band keep a single managed
`tabindex="0"` target, move focus with Arrow/Home/Control+Home/Control+End keys,
render visible focus outlines, and accept Tab entry at the expected roving
targets. The first runtime pass exposed inactive card Add buttons pre-empting the
active roving card; `useRovingTabindex` now optionally removes secondary
controls in inactive items from the Tab sequence while preserving active-card
actions. Shared DOM assertions live in
`testing/browser/keyboard-accessibility-helpers.js` so later browser specs can
reuse the same focus and `tabindex` checks.

### Batch Y — Library/Search card-grid browser keyboard verification
See [PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md](PLATFORM_CARD_GRID_BROWSER_KEYBOARD_VERIFICATION_DESIGN.md).

Extended the Batch X browser proof to the first platform card-grid families:
Library release cards plus Search artist and release cards. The shared
`useArtworkGridRoving` wrapper now forwards the inactive-secondary-control
Tab-order hardening to every artwork grid that uses it, so inactive card actions
do not pre-empt the active roving card while the active card's action remains
keyboard-reachable. Added reusable helper assertions for grid movement and
per-item action `tabindex` state, plus a deterministic multi-result Search
fixture query. Runtime validation also hardened the shared roving lifecycle for
async/`v-if` grids and Vue computed-ref `count` sources.

### Batch Z — Home mixed card-grid browser keyboard verification
See [HOME_MIXED_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md](HOME_MIXED_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md).

Added a focused browser suite for the operator and requester Home monitored-
artist grids, the highest-risk remaining card-grid shape because each grid
mixes normal media-card link areas with a trailing Discover `RouterLink` tail
card. The suite proves Arrow/Home/Control+Home/Control+End movement across both
cell classes, visible focus on the tail card, and inactive first-card action
management. A small reusable requester browser helper now creates/logs in a
requester through real authenticated UI/API flows with CSRF.

### Batch AA — Missing release-card grid browser keyboard verification
See [MISSING_RELEASE_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md](MISSING_RELEASE_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md).

Added a focused browser suite for the Missing release-card grid, the next
highest-risk surface because release cards contain active secondary controls:
normal `Request` buttons and optional `Retry discovery` recovery actions. A new
wanted-release browser fixture seeds wanted summary, wanted releases, and
reconciliation summary responses. The suite proves roving Arrow/Home/
Control+Home/Control+End movement, Tab from the active card into its request
action, inactive-card action suppression, and active recovery-card controls
remaining reachable.

### Batch AB — Activity releases/wanted browser verification
See [ACTIVITY_RELEASES_WANTED_BROWSER_VERIFICATION_DESIGN.md](ACTIVITY_RELEASES_WANTED_BROWSER_VERIFICATION_DESIGN.md).

Added focused browser coverage for Activity's release surfaces. Activity
Releases now has deterministic release-radar fixture coverage proving both the
Recent releases and Upcoming releases card grids expose roving Arrow/Home/
Control+Home/Control+End movement, visible focus, active-card Request actions,
and inactive-card action suppression. Activity Wanted remains a native table
because its status/count/date data is tabular; the table now has an accessible
name and browser coverage proves the wanted rows, recovery notice, and keyboard
`Retry discovery` action against the real client API path.

### Batch AC — My Requests card-grid browser verification
See [MY_REQUESTS_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md](MY_REQUESTS_CARD_GRID_BROWSER_VERIFICATION_DESIGN.md).

Added focused browser coverage for the My Requests request-card grid. The suite
uses a deterministic media-request fixture and proves request cards keep one
roving Tab stop, move with Arrow/Home/Control+Home/Control+End keys, retain a
visible focus ring, filter correctly to a downloading request, restore the full
grid, and open request detail with Enter. The slice also fixed a latent filter
bug: My Requests was checking a nonexistent `request.status` field. Filtering
now goes through `getMyRequestFilterStatus(request)`, a pure helper mapping the
current `requestState` + `fulfillmentStatus.code` payload to the UI buckets.

### Batch AD — Artist Detail per-section card-grid browser verification
See [ARTIST_DETAIL_SECTION_GRID_BROWSER_VERIFICATION_DESIGN.md](ARTIST_DETAIL_SECTION_GRID_BROWSER_VERIFICATION_DESIGN.md).

Added focused browser coverage for Artist Detail's per-section discography
grids, the final unverified Batch K card-grid surface. The suite uses the seeded
metadata fixture to render Albums and EPs for Boards of Canada, then proves each
section has independent roving focus, Arrow/Home/Control+Home/Control+End
movement, visible focus via the shared helper, and operator selection controls
that remain tabbable only for the active card in their own section. The slice
also aligned discography list `aria-label`s with the visible
`pluralizeReleaseType(section.type)` heading helper so accessible names cannot
drift from section copy.

### Batch AE — Release Detail modal browser verification
See [RELEASE_DETAIL_MODAL_BROWSER_VERIFICATION_DESIGN.md](RELEASE_DETAIL_MODAL_BROWSER_VERIFICATION_DESIGN.md).

Added focused browser coverage for the Release Detail modal opened from Artist
Detail. The suite keyboard-opens the modal from a release card, proves initial
focus moves to the close button, Escape and explicit Close restore focus to the
opener, Tab and Shift+Tab stay inside the native dialog, edition switching loads
a distinct fixture tracklist, and operator track override selects remain
reachable. Runtime work also hardened the modal: explicit opener focus
restoration, semantic `aria-pressed` edition buttons, no ARIA menu role without
menu keyboard behavior, visible edition focus rings, and a more robust
Enter/Space handler for `ReleaseCard`'s custom `role="button"` body.

### Batch AF — Request action browser verification
See [REQUEST_ACTION_BROWSER_VERIFICATION_DESIGN.md](REQUEST_ACTION_BROWSER_VERIFICATION_DESIGN.md).

Added focused browser coverage for the request mutation itself after the card
grid and Release Detail keyboard work. The suite verifies Search release-card
keyboard reachability into the Request action, confirmation-dialog initial
focus/Tab containment, admin requester-for selection, requested disabled-state
feedback, and Release Detail direct request payloads plus focus restoration
after success. Runtime work hardened `ConfirmRequestModal` with explicit opener
focus capture/restoration and a requester-for select focus ring; `ReleaseDetailModal`
now restores opener focus before emitting a successful `requested` close. The
metadata browser fixture now records media-request payloads and seeds eligible
admin/requester users for exact requester-for assertions.

### Batch AG — Request failure and retry-state browser verification
See [REQUEST_FAILURE_RETRY_BROWSER_VERIFICATION_DESIGN.md](REQUEST_FAILURE_RETRY_BROWSER_VERIFICATION_DESIGN.md).

Extended the request browser coverage from success paths into failure and retry
states. The metadata browser fixture now supports queued media-request failures
and pre-marked linked request keys, with shared request browser helpers for
Search release-card and Release Detail setup. The suite proves failed
confirmation-dialog and Release Detail submissions stay open, expose
`role="alert"` text, preserve requester-for selections, do not record media
requests, and remain retryable; successful retries transition to requested
feedback and Release Detail restores focus to its opener. Runtime hardening
returns focus to the retry button after failed submissions because disabled
loading buttons can otherwise drop focus.

### Batch AH — Requester-role request browser verification
See [REQUESTER_ROLE_REQUEST_BROWSER_VERIFICATION_DESIGN.md](REQUESTER_ROLE_REQUEST_BROWSER_VERIFICATION_DESIGN.md).

Added focused requester-session browser coverage for the request workflow. The
suite creates a real requester through the admin API, logs in through the forced
password-change path, and verifies Search release-card and Release Detail
requests submit without `requestedForUserId`, show no requester-for selectors,
and do not read the admin `/api/v1/users` endpoint. Runtime hardening added an
`enabled` option to `useActiveUsers`, uses it to prevent requester Release Detail
from fetching active users, and gates Artist Detail operator-policy controls to
non-requester sessions so requester UI remains least-privilege.

---

### Batch AI — Post-request My Requests refresh verification

Status: Implemented. See
`docs/POST_REQUEST_MY_REQUESTS_REFRESH_DESIGN.md`.

Added focused browser coverage for the requester post-submit handoff. The suite
creates a real requester through the admin API, completes forced password change
through the UI, verifies My Requests starts empty, submits `Music Has the Right
to Children` from Search, then returns to My Requests and verifies the submitted
request card appears with the expected release title, request kind, and
`Searching` state.

The metadata browser fixture now converts recorded media-request mutations into
the scoped My Requests read model and summary payload, plus detail/pipeline/event
stubs for continuity. This keeps the browser test on the existing production
contract (`scope=mine`) instead of adding client-only refresh hooks.

### Batch AJ — Submitted-request detail handoff browser verification

Status: Implemented. See
`docs/SUBMITTED_REQUEST_DETAIL_HANDOFF_DESIGN.md`.

Added focused browser coverage for the submitted-request list-to-detail handoff.
The suite creates and logs in a real requester, submits `Music Has the Right to
Children`, opens the resulting My Requests card by keyboard, and verifies
Request Detail renders the submitted request headline, request kind, journey,
request fields, requester attribution, and no admin-only controls.

Runtime work added an explicit empty `Fulfillment pipeline` state to
`RequestDetailView` so newly submitted requests explain that download/import
progress will appear after discovery links a usable source. This removes the
previously silent no-candidates state.

### Batch AK — Requester Request Detail cancellation browser verification

Status: Implemented. See
`docs/REQUEST_DETAIL_CANCELLATION_BROWSER_VERIFICATION_DESIGN.md`.

Added focused requester browser coverage for cancelling a submitted request from
Request Detail. The suite creates and logs in a requester, submits `Music Has
the Right to Children`, opens the detail page, activates `Cancel request`,
confirms through the shared `alertdialog`, and verifies the success toast,
cancelled journey copy, removal of further cancellation/admin controls, fixture
state persistence, and My Requests refresh to `Cancelled`.

The metadata browser fixture now handles the production-shaped
`POST /api/v1/library/media-requests/:id/cancel` contract with persisted
`cancelled` read models and `409` responses for non-cancellable states.

### Batch AL — Request Detail cancellation failure and conflict-state browser verification

Status: Implemented. See
`docs/REQUEST_DETAIL_CANCELLATION_FAILURE_BROWSER_VERIFICATION_DESIGN.md`.

Added focused requester browser coverage for cancellation failure handling. The
suite verifies a queued `503` cancellation failure shows assertive error
feedback, keeps the request in `needs_fetch`, leaves `Cancel request` available,
and succeeds on retry. It also verifies a stale `409 Conflict` shows error
feedback, refreshes Request Detail to `cancelled`, removes stale cancellation
controls, and shows `Cancelled` after navigating back to My Requests.

Runtime work keeps transient errors retryable and refreshes the detail read
model only for `409` cancellation conflicts. The metadata browser fixture now
supports cancellation-specific failure queues and a helper for marking an
existing request cancelled before the UI submits.

## Batch AM - Requester Request Detail event timeline browser verification

Status: Implemented.

Requester Request Detail event history now has a focused browser contract. The
metadata browser fixture can seed first-page and cursor-paginated
`media_request_events` per media request, and the new browser test verifies
requester-safe cancellation, creation, and older reassignment events through the
production-shaped detail and load-more endpoints.

The UI hardening also moved `RequestEventTimeline.vue` from reassignment-only
presentation helpers to generic request-event helpers. Unknown reassignment
users now fall back to `previous requester` and `new requester` instead of raw
internal user IDs, and the timeline exposes an accessible `Request event
history` list for role-first browser verification.

See `docs/REQUEST_DETAIL_EVENT_TIMELINE_BROWSER_VERIFICATION_DESIGN.md`.

## Batch AN - Request Detail fulfillment pipeline event/status parity browser verification

Status: Implemented.

Requester Request Detail now has browser proof that fulfillment status, journey
stages, linked pipeline candidates, and durable event history agree for an
import-pending request. The browser fixture can seed raw operator-shaped
pipeline candidates and projects requester-safe candidates based on the active
session, matching the production requester/operator disclosure split.

The UI now exposes named semantic lists for both `Request journey` and
`Linked import candidates`, and fulfillment event copy covers fulfillment
started, download completed, import pending, imported, and fulfillment failed
events without falling back to raw enum text.

See `docs/REQUEST_DETAIL_PIPELINE_PARITY_BROWSER_VERIFICATION_DESIGN.md`.

## Batch AO - Operator Request Detail pipeline diagnostics browser verification

Status: Implemented.

Operator/admin Request Detail now has browser proof for the diagnostic side of
the pipeline projection. The suite creates an admin request, seeds a raw failed
candidate, verifies source-user/folder context, download/import status messages,
operation run IDs, import-candidate IDs, and run errors are visible, then
activates the `Open in import review` link by keyboard and confirms the target
candidate query.

Request Detail now uses small presentation helpers for operator source labels
and run diagnostics, while requester-safe tests continue to prove those same raw
fixture fields stay hidden from requester sessions.

See `docs/REQUEST_DETAIL_OPERATOR_PIPELINE_DIAGNOSTICS_BROWSER_VERIFICATION_DESIGN.md`.

## Batch AP - Failed-import recovery handoff from Request Detail to Import Review

Status: Implemented.

Operator/admin Request Detail now has browser proof that a failed import
candidate handoff lands in Import Review with the target candidate selected.
The suite creates an admin request, seeds a failed linked candidate plus matching
Import Review candidate detail/preview data, activates `Open in import review`
by keyboard, and verifies `/app/activity/candidates?candidate=...` preserves the
candidate selection even when the default pending queue filter shows zero
matching rows.

The Import Review browser fixture now covers queue list/detail, planning
preview, stage summaries, run summaries, and simple review transitions. The
handoff test verifies failed status, source folder, validation blocker,
candidate file context, and a keyboard-focusable `Reopen` recovery action.

See `docs/REQUEST_DETAIL_FAILED_IMPORT_RECOVERY_HANDOFF_DESIGN.md`.

## Batch AQ - Import Review failed-candidate recovery action states

Status: Implemented.

Import Review now has browser proof for the failed-candidate recovery mutation
itself. The suite opens a seeded failed candidate directly in Import Review,
executes `Reopen`, and verifies the candidate moves to `Pending`, the queue count
refreshes from zero to one under the default pending filter, the pending action
buttons appear, and focus moves to a visible `role="status"` message after the
removed `Reopen` button disappears.

The paired failure scenario queues a one-shot transition failure through the
browser fixture, verifies assertive `role="alert"` feedback, keeps the candidate
failed, leaves `Reopen` retryable and focused, and does not show a false success
status. `useImportReviewWorkspace` now short-circuits dependent refresh work when
the transition returns `null`.

See `docs/IMPORT_REVIEW_FAILED_CANDIDATE_RECOVERY_ACTION_DESIGN.md`.

## Batch AR - Import Review review-state transition matrix

Status: Implemented.

Import Review now has browser proof for the normal review-state transitions
adjacent to failed-candidate recovery. The suite opens seeded candidates directly
in Import Review and verifies `Pending -> Held -> Selected` plus
`Selected -> Rejected -> Pending`, including reject confirmation gating, success
status focus, visible focus rings, queue count changes, selected-summary
refreshes, stable route state, and persisted fixture state.

The runtime hardening keeps the transitioned candidate selected after successful
actions even when the active pending filter excludes it. This prevents `Hold` or
`Reject` from silently clearing or jumping the detail panel while the operator is
reviewing the result of their action.

See `docs/IMPORT_REVIEW_TRANSITION_MATRIX_DESIGN.md`.

## Batch AS - Import Review requester/non-admin read-only access verification

Status: Implemented.

Import Review now has browser proof for the least-privilege side of the review
workflow. The suite verifies requester deep links to
`/app/activity/candidates?...` are redirected back to Home before any
`/api/v1/import-candidates` request loads. It also verifies an operator session
can inspect candidate queue/detail context while review notes, filters,
`Select`/`Hold`/`Reject`/`Reopen`, and the admin-only operator runway remain
absent.

The browser user helper now has generic `createUserThroughApi` and
`loginUserThroughUi` helpers; existing requester helpers wrap those functions.
The read-only suite also captures network requests and proves no Import Review
transition endpoint is called outside admin management flows.

See `docs/IMPORT_REVIEW_READ_ONLY_ACCESS_DESIGN.md`.

## Batch AT - Import Review operator runway start/reconcile controls

Status: Implemented.

Import Review now has browser proof for the admin-only runway controls that
start or sync background work. The suite verifies empty queues disable media
inspection, download execution, and import apply starts; selected candidates
enable media inspection and download starts; execution reconciliation updates
heartbeat summary state; and import apply remains gated by the destructive
type-to-confirm dialog.

Runtime hardening tightened the shared start predicates so zero eligible
candidates always disables a start, even when no current run exists. Runway
panel errors now expose `role="alert"` feedback. The metadata browser fixture
now supports production-shaped POST start/reconcile endpoints, one-shot run
failures, durable run action logging, and run-summary read-after-write state.
Post-mutation queue refreshes now preserve the owning runway panel hash so the
operator stays anchored to the control they just used.

See `docs/IMPORT_REVIEW_OPERATOR_RUNWAY_CONTROLS_DESIGN.md`.

## Batch AU - Import Review selected-run deep links and historical run detail

Status: Implemented.

Import Review runway panels now have browser proof for selected-run deep links
and historical run detail loading. The suite verifies direct URLs for media
inspection, download execution, and import apply historical runs, plus selecting
older rows from recent history and preserving selected historical detail after a
panel refresh.

Runtime hardening routes panel refreshes through `useImportReviewAdminWorkflow`
so refresh calls preserve the selected run ID from query state. The recent-run
tables now expose a visible `Run` column, which makes historical rows operator-
clear and gives browser tests a user-visible identifier instead of relying on
row position.

See `docs/IMPORT_REVIEW_SELECTED_RUN_DEEP_LINKS_DESIGN.md`.

## Batch AV - Import Review run-detail failure diagnostics browser verification

Status: Implemented.

Import Review selected-run URLs now have browser proof for failed historical
run diagnostics. The suite deep-links directly into failed media inspection,
download execution, and import apply runs, then verifies the operator-visible
failure cause and diagnostic evidence in each panel.

Runtime hardening added `ImportCandidateRunFailureNotice.vue`, a shared durable
failure notice rendered as polite `role="status"` content across all three
runway panels. Execution diagnostics prove degraded transfer state, missing
transfer recovery context, failed transfer exceptions, and persisted transfer
observations. Apply diagnostics prove failed file-operation messages and
not-attempted follow-up operations. Media inspection remains aggregate-only
because per-file inspection warnings are not persisted yet.

See `docs/IMPORT_REVIEW_RUN_DETAIL_FAILURE_DIAGNOSTICS_DESIGN.md`.

## Batch AW - Media-inspection per-file diagnostic persistence

Status: Implemented.

Media inspection run detail now persists and renders bounded per-file warning
diagnostics. The worker records diagnostic rows from apply-preview media
inspection warnings into `operation_runs.summary.inspectionDiagnostics`; the run
store normalizes those rows on read; and the media inspection panel renders a
named `Media inspection file diagnostics` table for selected runs.

The implementation intentionally uses the existing operation-run JSONB summary
instead of adding a table because the data is run-scoped, bounded, and not yet
queried independently. The payload excludes raw probe output and stores only
operator-useful fields: candidate, source user, source folder, file, formatted
warning code, and message.

See `docs/MEDIA_INSPECTION_PER_FILE_DIAGNOSTICS_DESIGN.md`.

## Batch AX - Import Review diagnostic row handoff to candidate detail

Status: Implemented.

Media inspection diagnostic rows now have keyboard-accessible `Open candidate`
actions. Activating a row updates Import Review route state to the diagnostic
candidate, preserves the selected `mediaInspectionRunId`, moves the hash to the
selection workspace, and focuses that workspace so operators land back on the
authorized candidate action surface.

The route-state normalizer now also accepts internal `candidateId` keys so
composables can merge public query state and internal state without dropping the
candidate selection. Browser coverage starts from a selected historical
media-inspection run URL and proves the handoff keeps the selected run, opens
the candidate detail, and exposes the recovery action.

See `docs/IMPORT_REVIEW_DIAGNOSTIC_ROW_HANDOFF_DESIGN.md`.

## Batch AY - Import Review diagnostic file focus handoff

Status: Implemented.

Diagnostic row handoff now carries the affected file as durable route state
using `candidateFile=<fileId>`. Import Review preserves the selected
`mediaInspectionRunId`, opens the candidate, and `ImportCandidateDetailPanel`
scrolls and focuses the matching candidate file row after it renders.

The focused file row has a visible accent treatment and focus outline, while
browser coverage proves the URL keeps `candidate`, `candidateFile`, and
`mediaInspectionRunId` together and that the active element is the affected file
row.

See `docs/IMPORT_REVIEW_DIAGNOSTIC_FILE_FOCUS_HANDOFF_DESIGN.md`.

## Batch AZ - Import Review diagnostic-driven repair-state verification

Status: Implemented.

Diagnostic file handoff now has browser proof through the adjacent repair path.
The suite starts from a selected media-inspection run, opens the affected file,
executes `Reopen`, verifies success-status focus, preserves `candidate`,
`candidateFile`, and `mediaInspectionRunId`, and confirms the selected historical
run remains selected.

Runtime hardening also keeps workspace query replacements from dropping the
current hash and preserves selected run IDs plus diagnostic file state during
repair transitions. Normal queue candidate selection, filter apply, reset, and
route backfill now clear stale `candidateFile` state so file focus cannot point
at the wrong candidate.

See `docs/IMPORT_REVIEW_DIAGNOSTIC_REPAIR_STATE_DESIGN.md`.

## Batch BA - Import Review diagnostic repair failure-state verification

Status: Implemented.

Diagnostic repair now has negative-path browser proof from the same file-level
handoff context as Batch AZ. The suite starts from a selected media-inspection
run, opens the affected diagnostic file, queues a one-shot `Reopen` failure,
and verifies assertive alert feedback, retry focus on `Reopen`, preserved
`candidate`/`candidateFile`/`mediaInspectionRunId` route state, preserved file
highlighting, selected historical run continuity, and no false success status.

A reusable diagnostic Import Review browser workspace builder now lives in
`testing/browser/import-review-browser-helpers.js`, keeping future diagnostic
repair tests from copying local candidate/run fixture payloads.

See `docs/IMPORT_REVIEW_DIAGNOSTIC_REPAIR_FAILURE_STATE_DESIGN.md`.

## Batch BB - Import Review diagnostic repair retry-success verification

Status: Implemented.

Diagnostic repair now has browser proof for the failure-to-success retry loop.
The suite starts from a selected media-inspection run, opens the affected
diagnostic file, queues a one-shot `Reopen` failure, verifies retry focus on
`Reopen`, retries the same action successfully, and verifies the prior alert
clears while success status receives focus.

The route and diagnostic context remain stable across both attempts:
`candidate`, `candidateFile`, and `mediaInspectionRunId` stay in the URL, the
affected file row remains highlighted, and the selected historical
media-inspection run stays selected after the retry transitions the candidate
to `Pending`.

See `docs/IMPORT_REVIEW_DIAGNOSTIC_REPAIR_RETRY_SUCCESS_DESIGN.md`.

## Batch BC - Import Review direct diagnostic route reload verification

Status: Implemented.

Direct diagnostic Import Review URLs now have reload browser proof. The suite
loads `/app/activity/candidates` with `candidate`, `candidateFile`, and
`mediaInspectionRunId` query state plus `#import-review-selection-stage`,
verifies the candidate detail hydrates, the affected file receives focus and
highlighting, and the historical media-inspection run stays selected.

The same assertions run again after browser reload, proving the diagnostic
context does not depend on the original diagnostic-row click event.

See `docs/IMPORT_REVIEW_DIRECT_DIAGNOSTIC_ROUTE_RELOAD_DESIGN.md`.

## Batch BD - Import Review diagnostic fixture-pack consolidation

Status: Implemented.

Import Review diagnostic browser suites now share a named fixture-pack module
instead of duplicating the same selected diagnostic candidate, comparison
candidate, media-inspection run, diagnostic file IDs, route suffixes, and repair
failure message.

The older media-inspection diagnostics, diagnostic-row handoff, and repair-state
suites now consume the same fixture pack as the newer failure, retry-success,
and direct-route reload suites. The consolidation is test-support only; product
behavior and production Import Review code did not change.

See `docs/IMPORT_REVIEW_DIAGNOSTIC_FIXTURE_PACK_CONSOLIDATION_DESIGN.md`.

## Batch BE - Queued-worker maintenance-lock pause proof

Status: Implemented.

Queued-worker dispatch now has database-backed proof for maintenance-lock
pausing. The integration suite seeds a pending library scan run, acquires a
restore maintenance lock, ticks the real operation queue dispatcher through the
real pause service and PostgreSQL-backed queue store, and verifies no
stranded-run recovery runs, no run is claimed, and no handler starts.

After releasing the lock, the same dispatcher tick claims the same pending run,
increments attempt count, records the dispatcher owner, and launches the
matching handler. This complements the existing claimed-worker pause proof and
confirms both sides of the boundary: queue-side recovery and new queued work
pause during a lock, and queued work resumes after release.

See `docs/QUEUED_WORKER_MAINTENANCE_LOCK_PAUSE_PROOF_DESIGN.md`.

## Batch BF - Docker-backed deployment-path validation execution

Status: Implemented.

The shared Docker deployment-path validator was executed in a live
Docker-capable environment with evidence output enabled. The run passed the
local workspace image fresh-install path, including embedded PostgreSQL
readiness and persistence, zero pending migrations, FFmpeg/FFprobe availability,
backup export and restore preview/apply behavior, delegated Request Music smoke,
existing-data restart, startup-refusal behavior, and cleanup verification.

The first attempt correctly failed before container creation because Compose
required VAPID variables. After generating validation-only VAPID keys in the
current shell, the validation passed and produced the deployment summary plus
fresh-install evidence JSON under `.tmp/docker-deployment-evidence`.

Released-image and upgrade-path validations were explicitly skipped because
`HARMONIARR_IMAGE` and `HARMONIARR_BASELINE_IMAGE` were not configured.

See `docs/DOCKER_BACKED_DEPLOYMENT_PATH_VALIDATION_EXECUTION.md`.

## Batch BG - Released-image and baseline-upgrade evidence execution

### Released-image and baseline-upgrade evidence execution

Status: Implemented.

The deployment-path wrapper now has live local execution evidence for all three
API-level packaged-runtime paths: fresh install, released image, and
baseline-to-candidate upgrade. The run used
`HARMONIARR_IMAGE=ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta` and
`HARMONIARR_BASELINE_IMAGE=harmoniarr-walkthrough:latest`, wrote JSON evidence
under `.tmp/docker-release-upgrade-evidence`, verified each smoke evidence file
with `npm run validate:docker-smoke-evidence`, and confirmed no
`harmoniarrsmoke` or `harmoniarrupgrade` containers or volumes remained.

The local environment could not prove GHCR digest pull availability because
registry access returned `denied`, so the evidence is executable local-tag
proof rather than registry-authenticated immutable digest proof. Final release
closure should repeat the same command with registry access and immutable
digest refs.

| Pros | Cons |
| --- | --- |
| Proves released-image and upgrade behavior through the standard Compose path | Local tag proof does not replace registry digest proof |
| Captures release-archive-ready JSON for fresh install, released image, upgrade path, and summary | Takes longer than single-path smoke |
| Exposed and fixed environment leakage between fresh-install builds and released-image refs | Still needs browser-smoke evidence for UI-facing release confidence |

See `docs/RELEASED_IMAGE_BASELINE_UPGRADE_EVIDENCE_EXECUTION.md`.

## Batch BH - Packaged-runtime browser-smoke execution

Status: Implemented.

The packaged Docker walkthrough runtime now has browser-smoke execution
evidence. `npm run validate:docker-browser-smoke` passed against
`http://127.0.0.1:47956` with the walkthrough admin, wrote
`.tmp/docker-browser-smoke-evidence/harmoniarr-docker-smoke-browser-operator.json`,
and captured seven checkpoint screenshots under
`.tmp/docker-browser-smoke-evidence/screenshots`.

The smoke runner now uses user-facing selectors for the visible account menu,
Activity page, Background Jobs section, and Download candidates page instead of
stale implementation classes or tab labels. It also supports optional
checkpoint screenshots through
`HARMONIARR_DOCKER_BROWSER_SMOKE_SCREENSHOT_DIR`.

| Pros | Cons |
| --- | --- |
| Proves browser-critical flows against the shipped runtime | Does not replace the full browser suite |
| Complements the fresh-install, released-image, and upgrade JSON evidence | Requires screenshot artifact hygiene |
| Produces release-archive-ready UI screenshots and JSON | Still needs final registry-authenticated digest replay |

See `docs/PACKAGED_RUNTIME_BROWSER_SMOKE_EXECUTION.md`.

## Proposed (follow-up)

Status: Proposed (not yet implemented).

### Registry-authenticated immutable release replay

**Problem.** Local Docker evidence now covers API-level deployment paths and
packaged browser smoke, but the local environment could not prove GHCR digest
pull availability because registry access returned `denied`.

**Proposal.** Repeat the deployment-path and browser-smoke evidence run with
registry-authenticated immutable digest refs, then archive the deployment
summary, smoke JSON, and screenshot artifacts as the final release evidence
pack.

**Why it is high value.** This converts local executable proof into final
supply-chain proof for the exact registry-published artifact.

| Pros | Cons |
| --- | --- |
| Proves the exact immutable registry artifact | Requires registry credentials/access |
| Closes the remaining release-evidence caveat | Longer than local tag replay |
| Produces a complete release archive | Depends on registry availability |

**Touch points.** Docker release evidence, release workflow artifacts, GHCR
access, and release validation sign-off.
