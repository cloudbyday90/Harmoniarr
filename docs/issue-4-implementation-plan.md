# Issue #4 — Full App Re-scope: Harmoniarr as a Media Consumption App

## Status: In Progress

### Core Design Shifts

- **Operator tool → media consumption app.** Every user-facing screen is redesigned around the act of finding, requesting, and tracking music — not administering a system.
- **Requesters as the primary persona.** The home page, discovery flow, and request experience are designed for the person who wants music, not the person running the server.
- **Artwork-first UI.** Tables become card grids. Text results become artwork cards. The visual identity of albums and artists drives the interface.
- **Multi-user aware throughout.** Requests carry attribution. Activity surfaces whose requests are whose. The experience is explicitly shared.
- **Two distinct nav experiences.** Operator items move entirely into Settings. Requesters get a clean, purpose-built nav. The two roles are not just filtered versions of the same nav.
- **The app finds music for you.** Release Radar surfaces new releases from artists you monitor. The "Coming Soon" watchlist pre-queues upcoming albums. You shouldn't have to check manually.
- **Smart acquisition.** Download result scoring, per-user format preferences, and cross-user deduplication mean the right file gets downloaded once for everyone.
- **Installable and notifying.** PWA support makes Harmoniarr a first-class mobile app. Push notifications tell you when your request is ready.

---

### Implementation Progress

**Step 1 — Complete:** Navigation & shell — `AppShell.vue` now has two distinct nav configurations. Operator nav: Home, Discover, Missing, Activity, Settings. Requester nav: Home, Discover, Search, My Requests. `<ToastStack>` is mounted in `AppShell.vue`. Note: requester nav includes a Search entry (not in original spec) and does not surface Account as a top-level nav item (Account remains in the sidebar footer).

**Step 2 — Complete:** Requester home page — `RequesterHomePanel.vue` ships the artwork-first artist card grid using `ArtistCard.vue` and `ArtworkImage.vue`, backed by `useMonitoredArtists`. Cold-start `EmptyState` with CTA to Discover is implemented. The persistent "Find more artists" tail card is present at the end of the grid — same dimensions as an artist card, dashed border, compass/discover SVG icon, routes to `/app/discover`. Visible whenever `artists.length > 0`; hidden in cold-start state where the full `EmptyState` takes its place.

**Step 26 — Complete:** Operator dashboard — `DashboardView.vue` uses a `v-if isRequester` to render either `RequesterHomePanel.vue` or `OperatorDashboardPanel.vue`. The operator panel includes: all-user request queue (scoped to `mine` vs. all), active Soulseek downloads strip, library wanted summary, and onboarding panel. `OnboardingSummaryPanel` is preserved.

**Step 3 — Complete:** Discover screen — `DiscoverView.vue` is a full taste-graph exploration flow. Ships: MusicBrainz artist search via `useDiscoverSearch`, one-tap monitoring via `useArtistMonitoring`, "Done — go to Home" CTA when any artist has been monitored. **New:** `useDiscoverGraph.js` composable — maintains taste seeds (artists the user has picked), fetches `GET /api/v1/metadata/artists/:artistId/similar` per seed, merges results with intersection-boost scoring (artists recommended by multiple seeds score higher). Seeds displayed as removable pill chips; suggestions rendered in an `hx-artwork-grid` below, each with a stable colored-initial avatar via `getArtistAvatar` (FNV-1a hash of MBID → muted color palette). Monitoring a suggestion makes it a new seed (snowball effect). `fetchSimilarArtists` added to `metadata-api.js`. Pure-logic modules `discover-graph.js` (computeSuggestions) and `artist-avatar.js` (getArtistAvatar, AVATAR_PALETTE) unit-tested independently from Vue.

**Step 4 — Complete:** External similarity service integration — `GET /api/v1/metadata/artists/:artistId/similar` is live. New files: `src/server/integrations/listenbrainz/listenbrainz-client.js` (ESM HTTP client with serial queue, rate-limit header tracking, exponential backoff, graceful 404 → `[]`), `src/server/metadata/similar-artists-service.js` (24 h in-memory TTL cache, `extractMbRelatedArtists`, `mergeSimilarArtists` exported pure functions, `createSimilarArtistsService` factory). `lookupArtistRelations` added to `musicbrainz-client.js`. Service wired into `metadata-module.js` and route registered in `metadata-routes.js`. Route inventory and metadata-module tests updated. Note: `:artistId` on this route is a MusicBrainz MBID, not a local DB ID. LB `similar-to-artist` endpoint returns 404 on the live API as of May 2026 — client handles this gracefully with `[]`, so the route operates on MB relationship data until LB releases the endpoint.

**Step 5 — Complete:** Artwork infrastructure — `ArtworkImage.vue` ships with `localSrc` → MusicBrainz CAA URL (release or release-group) → placeholder SVG fallback. Props: `localSrc`, `mbid`, `mbidType` ('release' | 'release-group'), `alt`. Used throughout `ArtistCard`, `ReleaseCard`, `ConfirmRequestModal`, and `RequesterHomePanel`.

**Step 6 — Complete:** My Requests screen — `MyRequestsView.vue` at `/app/my-requests` is a read-only status view. Uses `useMyRequests` composable, renders `RequestCard` per request, `EmptyState` for zero requests, and `RequestStatusPill` for fulfillment state. `RequestCard` includes a cancel action where applicable. No request intake form.

**Step 7 — Complete:** Search screen — `SearchView.vue` fully rewritten with dual mode: MusicBrainz card search ('music' mode) and Soulseek peer search ('network' mode). Music mode renders `ArtistCard` and `ReleaseCard` grids with `ArtworkImage`. Artist results show Monitor toggle via `useArtistMonitoring`; release results trigger `ConfirmRequestModal` via `useReleaseRequest`.

**Step 8 — Not Started:** Missing/Wanted screen — `MissingView.vue` still renders wanted releases as an `hx-table`. Card grid conversion not yet done.

**Step 9 — Not Started:** Multi-user awareness pass — per Decision 8: artist monitoring has no user scope (it is system-global), so monitoring actions have no per-user UI dimension. What *is* per-user: (a) request attribution — request cards throughout the UI show who submitted the request, (b) operators can request on behalf of another user via a "Request for" selector in `ConfirmRequestModal`, (c) `requested_for_user_id` column on `media_requests` (already applied via migration `20260504_020000_media_request_target_user.sql` — no schema migration required in this step), (d) the operator dashboard request card surfaces both submitter and beneficiary when they differ ("Requested by Admin for Partner"), (e) My Requests for each user shows only requests where `requested_by_user_id = me OR requested_for_user_id = me`. The `ActivityUsersView.vue` update and user-attribution pill on request cards are the primary deliverables.

**Step 10 — Not Started:** Responsive & mobile — card grids collapse to single-column on narrow viewports. Sidebar collapses to a bottom nav or hamburger on mobile. All touch targets meet minimum size requirements.

**Step 11 — Not Started:** Release Radar — "New this week from artists you monitor." Server-side job scans MusicBrainz for recent releases (last 30 days) from all monitored artists. Surfaces as a dedicated section on the home page above the full artist grid: horizontal scroll strip or top-of-grid section. Each card has a one-click Request button. Requires a scheduled job and a new server route.

**Step 12 — Not Started:** Activity feed — household-level stream of recent events: requests submitted, downloads completed, new releases added to the library. Visible to all users. Shows who did what. Makes the app feel like a shared space rather than an isolated tool. New `ActivityFeedView.vue` or inline panel on the home page.

**Step 13 — Not Started:** Cross-user deduplication — if two users request the same release, one Soulseek search and download serves both. The server detects duplicate requests (by `musicbrainz_release_id` or artist+title match) and links them to the same download job. Both users see the request as fulfilled when the download completes. Requires schema change on `media_requests`.

**Step 14 — Not Started:** "Coming Soon" watchlist — MusicBrainz has announced release dates for upcoming albums. When monitoring an artist, the app checks for releases with a future date and surfaces them as "Coming Soon" cards. User can pre-request; the request stays pending until the release date passes. Requires a scheduled MusicBrainz check per monitored artist.

**Step 15 — Not Started:** Per-user format/quality preferences — each user can set a preferred format (FLAC, MP3 320, MP3 V0, any) and minimum quality floor. Soulseek search filters and ranks results accordingly per requester. Stored in user settings. Operator can set a system-wide default.

**Step 16 — Not Started:** Download result scoring — rank Soulseek search results automatically before queuing: format, bitrate, completeness (track count vs. expected), uploader reputation (past success rate). Reduce the frequency of manual import review by surfacing the best candidate first. Requires scoring logic in the search/queue pipeline.

**Step 17 — Not Started:** PWA — Progressive Web App manifest + service worker. Add to home screen on mobile, push notifications ("Your request for [album] is ready"). No app store, no native code. Requires a `manifest.webmanifest`, icons, and a notification delivery mechanism (Web Push API + server-side push subscription management).

**Step 18 — Complete:** Artist detail page — `ArtistDetailView.vue` at `/app/artists/:mbid` (canonical MBID route, accessible to requesters). Loads three data sources in parallel: local metadata (monitoring state + artist fields), MusicBrainz release-group browse (discography), and similar artists (related strip). Discography grouped by primary type (Albums, EPs, Singles, Broadcast, Other) via `groupReleaseGroupsByType`, newest first within each section. Each release group rendered as a `ReleaseCard` using `normalizeReleaseGroupForCard` (maps `firstReleaseDate→date`, clears release MBID so artwork loads from CAA release-group endpoint). Related artists strip shows up to 8 similar artists as colored-initial avatar tiles, each navigable to their own detail page. Header: artist name, type/country/disambiguation meta, Monitor button (via `useArtistMonitoring`), "Open in MusicBrainz" external link. Release requests via `useReleaseRequest` + `ConfirmRequestModal`. `useArtistDetail` composable manages parallel loading with independent error surfacing; 404 from local resolve treated as "not imported yet" rather than an error. `setMonitoring(patch)` allows the parent view to update cached monitoring state post-action without a full reload. `ArtistCard` gains an optional `to` prop that wraps the artwork+body area in a `RouterLink` when provided (backward-compatible; existing usages without `to` are unaffected). Navigation wired: RequesterHomePanel, DiscoverView (suggestions + search), SearchView all pass `buildArtistDetailLocation(artist.id, artist.name)` to their `ArtistCard`s. New pure lib `artist-detail-route.js` (route location builder, normalizer, grouper). Test suites: `artist-detail-route.test.js` (27 tests) and `useArtistDetail.test.js` (26 tests). 353 client tests pass, no regressions.

**Step 19 — In Progress:** Release request confirmation modal — `ConfirmRequestModal.vue` ships a `<dialog>`-based modal showing artwork, release title, artist, and year with a Confirm/Cancel action. Used from `SearchView` and `ReleaseCard`. Outstanding: the full release detail surface (tracklist, label, format, track count from MusicBrainz) is not implemented — the modal is a lightweight confirmation, not a rich detail overlay.

**Step 20 — Not Started:** Library view — new `LibraryView.vue` at `/app/library`. Artwork-first grid of fully acquired artists and releases. Celebrates what you have, not just what you're missing. Sourced from the existing metadata + library state. Toggle between artist view (grouped) and release view (flat grid). Filter by format, year, genre.

**Step 21 — Not Started:** Album art color extraction — extract the dominant color from each card's artwork and apply it as a subtle CSS variable (`--card-accent`) on that specific card. Used as a card border tint or inner glow. Runs client-side via `canvas.getContext('2d')` after `ArtworkImage.vue` loads. Makes each card visually distinct and the grid feel alive rather than uniform.

**Step 22 — Complete:** Rich empty states — `EmptyState.vue` ships with `title`, `body`, `ctaLabel`, `ctaTo`, `variant` props and an `icon` slot. Used on: RequesterHomePanel (no monitored artists), DiscoverView (no search results, error states), MyRequestsView (no requests), SearchView (no results). The 'discover' variant is defined.

**Step 23 — Complete:** Global toast system — `useToast.js` composable exposes `toast.success()`, `toast.error()`, `toast.info()`. `ToastStack.vue` is mounted in `AppShell.vue`, renders as a fixed-position stack with `TransitionGroup`. Toasts auto-dismiss (success/info) or require manual dismiss (error). Used by `useArtistMonitoring` and `useReleaseRequest`.

**Step 24 — Not Started:** Filter and sort controls on card grids — a `<GridControls>` component reused on the home page, Missing screen, Library view, and My Requests. Sort options: name (A–Z), missing count, date monitored, release date. Filter options: type (Albums, EPs, Singles), format (FLAC only, any), monitored status. State persisted to `localStorage` per view.

**Step 25 — Not Started:** System-aware dark/light theme — the design system already uses CSS custom properties. Add a light theme variable set (`[data-theme="light"]`). Default to `prefers-color-scheme`. Add a manual override toggle in Settings → Account (stored in `user_preferences` JSONB). No third-party theme library needed.

---

### Current State Snapshot (Shipped Infrastructure)

The re-scope is in active progress. The screens below have shipped:

**New / rewritten screens:**
- `DashboardView.vue` — role-split: `RequesterHomePanel.vue` (artwork-first artist grid with "Find more artists" tail card) + `OperatorDashboardPanel.vue` (request queue, downloads, library stats)
- `DiscoverView.vue` at `/app/discover` — MusicBrainz artist search + one-tap monitoring; graph traversal pending Step 3 completion
- `MyRequestsView.vue` at `/app/my-requests` — read-only request status view with `RequestCard` and `RequestStatusPill`
- `SearchView.vue` — dual-mode: MusicBrainz card search (artists + releases) + Soulseek peer search

**New shared components:**
- `ArtworkImage.vue` — localSrc → CAA fallback → placeholder
- `EmptyState.vue` — titled empty state with CTA slot and variant support
- `ToastStack.vue` + `useToast.js` — global toast system mounted in `AppShell`
- `ArtistCard.vue`, `ReleaseCard.vue`, `RequestCard.vue`, `RequestStatusPill.vue`
- `MonitorButton.vue`, `RequestButton.vue` — single-purpose action components
- `ConfirmRequestModal.vue` — `<dialog>`-based request confirmation with artwork + metadata

**New composables:**
- `useArtistMonitoring.js` — import + monitor flow with toast feedback
- `useDiscoverSearch.js` — MusicBrainz artist search state for Discover
- `useMonitoredArtists.js` — fetches the current user’s monitored artist list
- `useMyRequests.js` — fetches paginated request history
- `useReleaseRequest.js` — request creation + state tracking with toast feedback

**New lib modules:**
- `src/client/lib/media-request-api.js` — typed wrappers for media request CRUD
- `src/client/lib/release-normalization.js` — helpers to extract title/artist/year from heterogeneous release shapes
- `src/client/lib/request-status.js` — status label, tone, and sort-order helpers for `RequestStatusPill`
- `src/client/lib/artist-avatar.js` — FNV-1a hashed palette + colored initial avatar (Step 3)
- `src/client/lib/discover-graph.js` — pure `computeSuggestions` for the taste-graph (Step 3)
- `src/client/lib/artist-detail-route.js` — `buildArtistDetailLocation`, `normalizeReleaseGroupForCard`, `groupReleaseGroupsByType` (Step 18)

**New screens:**
- `ArtistDetailView.vue` at `/app/artists/:mbid` — full artist page with discography, related artists strip, monitoring, and MusicBrainz link (Step 18)

**Server changes:**
- `metadata-routes.js` and `metadata-search-service.js` updated (search improvements, monitored-artist fetch support)
- Migration `20260505_010000_drop_user_maintenance_locks.sql` shipped
- `src/server/integrations/listenbrainz/listenbrainz-client.js` — new ESM ListenBrainz HTTP client (serial queue, rate-limit headers, backoff, graceful 404)
- `src/server/metadata/similar-artists-service.js` — new service with 24 h TTL cache, MB relation extraction, LB+MB merge logic
- `musicbrainz-client.js` extended with `lookupArtistRelations`
- `GET /api/v1/metadata/artists/:artistId/similar` route live (`:artistId` = MBID)

**Router:**
- `discover` route added at `/app/discover` → `DiscoverView`
- `my-requests` route added at `/app/my-requests` → `MyRequestsView`
- `artist-detail` route added at `/app/artists/:mbid` → `ArtistDetailView`
- All three routes are accessible to requesters

**The following pre-existing foundations carry forward unchanged:**

**Client APIs (`src/client/lib/`)**
- `metadata-api.js`: `searchMusicBrainzArtists`, `searchMusicBrainzReleases`, `browseMusicBrainzArtistReleaseGroups`, `importMusicBrainzArtist`, `updateMetadataArtistMonitoring`, `searchLocalMetadataArtists`
- `library-api.js`: `createMediaRequest`, `fetchMediaRequests`, `fetchMediaRequestSummary`
- `slskd-search-api.js`: `fetchSlskdDownloads`

**Composables (`src/client/composables/`)**
- `useAsyncResource` — generic polling composable
- `useLibraryWantedSummary`, `useLibraryWantedReleases` — wanted-release state
- `useOnboardingSummary` — onboarding state and step tracking

**Design system (`src/client/design-system.css`)**
- `hx-card`, `hx-stat-grid`, `hx-stat-card`, `hx-table`, `hx-btn`, `hx-pill`, `hx-empty`, `hx-skeleton`, `hx-input`, `hx-field`, `hx-page`, `hx-sidebar-link`

**Nav configuration (`AppShell.vue`)**
- `operatorNav`: Home, Missing, Activity, Search, Settings
- `requesterNav`: My Requests, Account
- `visibleNav` computed — switches between the two based on `isRequester`

---

## 1. Problem Statement

Harmoniarr was built from the inside out — as a system to manage a music library. Every screen reflects operator concerns: job queues, reconciliation status, discovery runs, import candidates, metadata maintenance. The nav is an operator nav. The dashboard is an operator dashboard.

This is the wrong primary persona for the app's actual value proposition. Harmoniarr's value is: **you want music, you find it, you have it.** That workflow — discovery → request → download → library — is buried beneath operator panels and admin vocabulary.

The re-scope addresses this at every layer:
- The home page becomes an artwork-first view of what you care about (your monitored artists, what you're missing).
- Discovery becomes a first-class experience: a taste-seeding graph that narrows from one artist you know to a personal library of artists you'll love, using MusicBrainz relationships and external similarity data.
- The nav is redesigned — not filtered — for two genuinely different experiences: the person who wants music and the person who runs the server.
- Every table that represents music becomes a card grid.
- Multi-user awareness is woven throughout: whose request is whose, who's active, what the shared library state is.

The operator controls don't disappear — they move where they belong: Settings.

---

## 2. Existing Infrastructure to Leverage

| Component | File | Notes |
|---|---|---|
| MusicBrainz artist search | `src/client/lib/metadata-api.js` | `searchMusicBrainzArtists({ query, limit })` → results with `id`, `name`, `type`, `country`, `disambiguation` |
| MusicBrainz release search | `src/client/lib/metadata-api.js` | `searchMusicBrainzReleases({ release, artist, limit })` → results with `id`, `title`, `date`, `artist`, `releaseGroup` |
| Artist release-group browse | `src/client/lib/metadata-api.js` | `browseMusicBrainzArtistReleaseGroups({ artistId, limit, offset, type })` |
| Import artist | `src/client/lib/metadata-api.js` | `importMusicBrainzArtist(artistId)` — upserts artist into local metadata store |
| Update artist monitoring | `src/client/lib/metadata-api.js` | `updateMetadataArtistMonitoring(artistId, { monitored })` |
| Local artist search | `src/client/lib/metadata-api.js` | `searchLocalMetadataArtists({ query, limit })` — searches already-imported artists |
| Create media request | `src/client/lib/library-api.js` | `createMediaRequest({ artistName, releaseTitle, requestKind })` — POST with CSRF |
| Fetch media requests | `src/client/lib/library-api.js` | `fetchMediaRequests({ scope })` → `payload.mediaRequests[]` |
| Fetch request summary | `src/client/lib/library-api.js` | `fetchMediaRequestSummary({ scope })` → counts + fulfillmentCounts |
| Wanted summary | `src/client/composables/useLibraryWantedSummary.js` | `libraryWantedSummary`, `releaseCounts` (missing, partial) |
| Wanted releases | `src/client/composables/useLibraryWantedReleases.js` | `wantedReleases`, `isLoading`, `loadWantedReleases()` |
| Onboarding summary | `src/client/composables/useOnboardingSummary.js` | `summary.issueCount`, `steps`, `nextAction` |
| Async polling | `src/client/composables/useAsyncResource.js` | `{ fetcher, project, initialData, pollIntervalMs }` → `{ data, isLoading, load }` |
| Soulseek downloads | `src/client/lib/slskd-search-api.js` | `fetchSlskdDownloads({ includeRemoved })` |
| Nav shell | `src/client/components/AppShell.vue` | `operatorNav`, `requesterNav`, `visibleNav` computed — existing two-nav pattern to be expanded |
| Router | `src/client/router.js` | `requesterRestrictedRouteNames` set controls which routes requesters cannot access |

---

## 3. Gaps (What Is Missing)

### 3.1 No Taste-Seeding / Discovery Flow

There is no mechanism for a user to express taste and have the app build a monitored artist list from it. New users have no way to populate their library beyond manually searching for artists one at a time. The discovery experience — the mechanism by which a media app becomes personal — does not exist.

Required:
- `DiscoverView.vue` (new screen)
- Server route proxying similar-artist lookups from Last.fm or ListenBrainz (to avoid CORS, enable caching, and keep API keys server-side)
- First-run detection: auto-show Discover after onboarding completes if `monitoredArtistCount === 0`
- Re-enterable: "Discover" in the requester and operator nav always leads back to it

### 3.2 No Artwork Infrastructure

There are no shared components or utilities for displaying album/artist artwork. The Cover Art Archive (CAA) URL pattern for MusicBrainz releases is `https://coverartarchive.org/release/{mbid}/front` and for release groups `https://coverartarchive.org/release-group/{mbid}/front`. Local stored artwork exists in the metadata store but has no client-side access pattern.

Required:
- `ArtworkImage.vue` component: `src` prop → tries local → falls back to CAA URL → falls back to placeholder SVG. Handles loading state, error state, lazy loading.
- Decide on local artwork API route: `GET /api/v1/metadata/artists/:id/artwork` and `GET /api/v1/metadata/releases/:id/artwork`

### 3.3 No External Artist Similarity API Integration

MusicBrainz relationship data (influenced-by, similar, member-of, collaboration) exists but is not sufficient alone for the taste-seeding graph. A dedicated similarity service provides ranked similar-artist lists with wider coverage.

**Last.fm**: `artist.getSimilar` API — free, no auth required for read-only, returns similar artists with match score. Artist name or MusicBrainz ID can be used as the lookup key.

**ListenBrainz**: `GET /1/popularity/similar-to-artist/{artist_mbid}` — open, uses MusicBrainz IDs natively (no name-matching ambiguity), actively maintained, aligns with MusicBrainz ecosystem.

**Decision: ListenBrainz + MusicBrainz relationships. Last.fm is not a planned fallback.** See Q7.5 resolution and Decision 4 for rationale.

Required server route: `GET /api/v1/metadata/artists/:id/similar` — fetches from ListenBrainz, merges with MusicBrainz relationship graph, deduplicates, scores, and caches per artist MBID with a 7-day TTL. Returns `[{ id, name, score }]`.

### 3.4 No Artwork-First Home Page

`DashboardView.vue` is tables, panels, and operator status widgets. The home page for a media consumption app should be a card grid of the user's monitored artists with their cover art. When clicked, an artist card reveals the releases missing from that artist's monitored discography.

Required:
- Full rewrite of `DashboardView.vue`
- Uses `ArtworkImage.vue`
- Sources monitored artists from `searchLocalMetadataArtists` or a new `fetchMonitoredArtists` API call
- Cold-start state (no monitored artists) renders a full-width Discover CTA

### 3.5 Nav Is a Filtered Single Experience, Not Two Distinct Experiences

The current `requesterNav` and `operatorNav` are different arrays rendering through the same template. But the experiences they represent are genuinely different — not just hidden items. The requester nav needs different grouping, different primary actions, different emphasis. The operator nav needs Settings to fully absorb all system/admin sub-items.

Required:
- Requester nav: **Home**, **Discover**, **My Requests**, *(divider)*, **Account**
- Operator nav: **Home**, **Discover**, **Missing**, **Activity**, *(divider)*, **Settings** (Settings sub-nav includes: General, Connections, Media Storage, Users, Library Browser, Recovery)
- Both use the same `AppShell.vue` but the nav section renders differently based on role
- Remove "Activity" as a top-level item from requester nav entirely

### 3.6 Requests Screen Has No Request Intake

`RequestMusicView.vue` is currently a form + a table — but in the redesigned app the request intake lives on the home page (search → card → request). The dedicated requests screen becomes a pure status view: artwork cards of the user's submitted requests, fulfillment state, and a cancel action. The two-field form and its submit logic are removed entirely. The table becomes an artwork-first card grid consistent with the rest of the redesign.

### 3.7 Missing Screen Is a Table

`MissingView.vue` shows wanted releases as a table. In the artwork-first redesign, this should be a card grid grouped by artist or by release type, with each card showing album art, release title, and a Request action.

### 3.8 Search Returns Text Lists

`SearchView.vue` returns search results as text lists. In the artwork-first redesign, both artist and release search results should render as artwork cards — consistent with the home page, the missing screen, and the discover flow.

### 3.9 No Release Radar

The app has no mechanism for surfacing new releases from monitored artists automatically. A user who monitors Radiohead has no way to know when a new album drops unless they happen to search for it. A Release Radar job — scanning MusicBrainz for releases dated within the last 30 days across all monitored artists — would make the home page genuinely dynamic and reduce the need to actively check for new music.

Required: a scheduled server-side job, a DB table or cache for recent-release results, and a new client route/section on the home page.

### 3.10 No Activity Feed

The app has no shared household view of what's happening. Downloads complete silently. Requests are only visible to the person who made them (or the operator via the Activity sub-nav). A lightweight activity feed — "Alex requested Funeral by Arcade Fire", "Download complete: OK Computer" — would make the app feel like a shared household experience rather than a personal tool that happens to be multi-user.

### 3.11 No Cross-User Deduplication

If two household members request the same release, the current system runs two independent Soulseek searches and downloads. There is no deduplication logic. This wastes bandwidth, clutters the download queue, and results in duplicate files. Detection requires matching by `musicbrainz_release_id` (preferred) or artist name + release title string match. Linking duplicate requests to a single download job requires a schema change.

### 3.12 No "Coming Soon" / Pre-Request Support

MusicBrainz records announced future release dates. When an artist is monitored, their upcoming releases are knowable. The app currently does nothing with this data. A "Coming Soon" section — releases with future dates from monitored artists — allows users to pre-request and have the acquisition run automatically when the date passes.

### 3.13 No Per-User Format/Quality Preferences

All users share the same Soulseek search parameters. A FLAC-only collector and a "anything that plays" casual listener both get the same search behavior. Per-user format and quality preferences would let each person set their floor and have their requests searched accordingly.

### 3.14 No Download Result Scoring

Soulseek search results are heterogeneous — the same album might appear as a 128kbps rip, a FLAC rip with wrong track count, and a perfect FLAC with complete metadata. Currently there is no automated ranking before queuing. A scoring layer (format, bitrate, completeness, uploader history) would surface the best candidate first and reduce manual import review.

### 3.15 Not a PWA

Harmoniarr has no `manifest.webmanifest`, no service worker, and no push notification support. Household users on phones cannot add it to their home screen with a native app experience. Push notifications ("your request is ready") would significantly improve the UX for non-operator users who don't check the app constantly.

### 3.16 No Multi-User Attribution on Requests

Requests exist with a `requestedBy` user association on the server, but the client displays requests as an undifferentiated list. In a multi-user household, you want to know whose request is whose — both for social context ("Alex requested this") and for operator triage.

Required: request cards throughout the app surface the requesting user's display name or avatar.

### 3.17 No Artist Detail Page

There is nowhere to go when you click an artist. The home page expands inline to show missing releases, but there is no dedicated artist page with a full discography, bio, related artists, and monitoring controls. At scale — when a user monitors dozens of artists — the inline expansion pattern breaks down. A dedicated `/app/artists/:id` page provides the depth the card grid cannot.

### 3.18 No Release Detail Confirmation

Requesting a release is currently a single-tap action with no confirmation or context. A release detail modal — showing tracklist, label, year, existing request state — would reduce mis-requests and give the user context before committing. Consistent with how Overseerr handles this.

### 3.19 No Library View ("What You Have")

Every existing screen focuses on what's missing or what's requested. There is no screen that celebrates what the library already contains. A "Library" view — artwork grid of fully acquired artists and albums — completes the three-part picture: Missing, Requested, Owned.

### 3.20 Artwork Cards Are Visually Uniform

Every card in the grid looks the same — same border, same background, same accent. Album artwork varies, but the card chrome does not respond to it. Dominant-color extraction (a standard web technique via canvas) would give each card a unique tint derived from its own artwork, making the grid visually rich and immediately recognizable at a glance.

### 3.21 Empty States Are Not Designed

When a screen has no data — no monitored artists, no missing releases, no requests — it shows either nothing or a bare text message. These states are the first thing new users see. Intentional empty states with a headline, brief explanation, and contextual CTA are a baseline UX requirement for a media consumption app.

### 3.22 No Global Feedback System

Feedback for user actions (monitoring an artist, submitting a request, encountering an error) is handled per-component with inline state. This means inconsistent UX across screens, some actions giving no visible feedback at all. A global toast/snackbar system driven by a shared composable gives every action a consistent, non-disruptive feedback mechanism.

### 3.23 Card Grids Have No Filter or Sort Controls

At small scale (5 artists, 10 missing releases) the grid is browsable. At real scale (50+ artists, 200+ missing releases) it is not. Without sort (by name, by missing count, by date added) and filter (by type, by format, by monitored status) controls, the grid degrades into a wall of cards with no way to find what you're looking for.

### 3.24 No Theme Support

The design system uses CSS custom properties but only defines one theme (dark). There is no light theme and no mechanism to switch. `prefers-color-scheme` support is a baseline expectation. A light/dark toggle in account settings is table stakes in 2026.

---

## 4. Design Decisions

### Decision 1: Discover Is Both a Wizard and a Permanent Destination

The taste-seeding flow is not a one-time setup step you discard after first use. Music taste evolves. Users find new artists. The Discover screen is always in the nav, works the same way on first run as on the twentieth — type a seed artist, follow the graph, monitor what resonates, stop when done. First-run detection (`monitoredArtistCount === 0` after onboarding) auto-navigates to Discover, but it's not a modal or a wizard with forced steps.

### Decision 2: Taste Graph Is Open-Ended, Each Pick Narrows the Field

When a user picks an artist in Discover, the next set of suggestions is derived from the *intersection* of similar artists across all picks made so far — not just the most recently picked one. The graph contracts toward the user's specific taste rather than just expanding in one direction. The user stops when satisfied; there is no forced step count.

### Decision 3: Monitoring IS the Pick

In the Discover flow, there is no separate "add to watchlist" vs. "monitor" distinction. Picking an artist in the taste graph immediately monitors them. The feedback is a `Monitored` state badge on the card. This is the same `importMusicBrainzArtist` + `updateMetadataArtistMonitoring` pattern, invoked with one tap.

### Decision 4: ListenBrainz for Similarity, MusicBrainz Relationships as Supplement; No Last.fm

ListenBrainz uses MusicBrainz IDs natively, requires no API key, and is maintained by the same MetaBrainz foundation — architecturally consistent with the rest of the metadata stack. MusicBrainz artist relationships (influenced-by, member-of, collaboration, similar) are editorially curated community data, not derived from listening volume, which makes them the correct supplement for niche genres where ListenBrainz co-listening data is sparse.

**Last.fm is not a planned fallback.** Last.fm derives similarity from listening patterns the same way ListenBrainz does — the constraint is user listening volume, not which platform is queried. For obscure artists, both services have sparse data; Last.fm's larger user base raises the floor slightly but does not fix the problem. MusicBrainz editorial relationships are what fill the niche gap, because niche fan communities (metal, jazz, regional folk) are exactly the communities that meticulously maintain MB relationship data. Additionally, Last.fm requires an API key — adding a config step, a settings field, and a third external dependency that self-hosted operators would need to provision. The incremental coverage gain does not justify the operational cost.

**Server route merge/score logic** (`GET /api/v1/metadata/artists/:id/similar`):
1. Fetch ListenBrainz similar-artist list for the MBID → scored results (LB match score, 0–1)
2. Fetch MusicBrainz relationship graph for the MBID → filter to relationship types: `similar`, `influenced by`, `member of band`, `collaboration`
3. Merge by MBID, deduplicate. Score MB entries by type: `similar` = 0.7, `influenced by` = 0.5, `collaboration` / `member of` = 0.4
4. When the same MBID appears in both sources, take `max(lb_score, mb_score)` rather than summing (avoid inflating scores for well-known artists)
5. Sort descending by score, return top 20
6. Cache per MBID with 7-day TTL — LB data changes slowly; MB relationships change very rarely

Sparse results (fewer than 20) are not a failure state. The Discover flow works with 3 suggestions as well as 20 — the seed search box always provides an escape hatch for manual exploration.

### Decision 5: Artwork Source — Local First, MusicBrainz CAA Fallback

`ArtworkImage.vue` attempts local stored artwork first (served from the metadata store via a dedicated API route). If absent, it fetches from the MusicBrainz Cover Art Archive using the release group MBID. If CAA returns 404 or fails, a placeholder SVG is shown. The placeholder is styled to match the card grid proportions so layout never breaks.

### Decision 6: Operator Items Move Into Settings, Not Behind a Role Toggle

All operator-facing controls (library scan, reconciliation, discovery runs, artwork maintenance, import review, job queue, user management, recovery) live under `/app/settings` sub-routes. The top-level "Activity" nav item becomes an operator-only entry point for monitoring the system state — it is not hidden from operators, it is just no longer the default destination. Requesters never see it.

### Decision 7: Two Distinct Home Pages, One Route

`DashboardView.vue` renders two completely different page layouts based on role:

**Requester home page** answers: "what artists do I care about, and what am I still missing?" It is a personal artwork-first card grid of the current user's monitored artists. Cold-start state (no monitored artists) redirects to Discover.

**Operator home page** answers: "what is the current state of everything in the household?" It is a full media state dashboard with three primary panels: all requests across all users (filterable by user, status, and date — each card shows who requested it), active downloads and the processing queue, and a library summary (owned / missing / partial counts). Operators also have access to additional filter controls not visible to requesters.

**Discover is a standalone page for both roles.** It is not embedded in or launched from the home page. It lives at `/app/discover` and is always in the nav. It is the dedicated place to find new artists. The home page does not contain a discovery flow — it surfaces what you've already committed to.

### Decision 8: Artist Monitoring Is System-Global; Release Requests Are Per-User; Operators Can Request On Behalf Of

**Monitoring is a shared library function, not a personal preference.** The metadata pipeline — artist discovery, reconciliation, Soulseek acquisition — runs against one set of monitored artists for the whole household. This is the Lidarr model. When an artist is monitored, the system watches for new releases for everyone. There is no concept of "User A monitors Radiohead but User B does not." Monitoring is a system state, not a user preference. The home page shows all system-monitored artists; it feels personal because requesting is personal, and each person's request history is their own.

**Requests are per-user.** A media request is attributed to the user who submits it (`actorUserId`). Each user sees their own requests in My Requests. Operators see all users' requests on the dashboard. Fulfillment state is shared (the file is downloaded once), but the request record belongs to the person who asked.

**Operators can request on behalf of another user.** When an operator submits a request via Search or the ConfirmRequestModal, they see an additional "Request for" selector listing all household users, defaulting to "Myself". This allows the household admin to add music on behalf of a less technical household member without that person needing to log in. The server validates that the session user is an admin before accepting a `requestedForUserId` that differs from the actor. This column (`requested_for_user_id`) already exists on `media_requests`, added by migration `20260504_020000_media_request_target_user.sql` (distinct from `requested_by_user_id`, which is always the submitter). The dashboard operator card shows both: "Requested by Admin for Partner" when the two differ.

**Searching for a song returns release results.** The Search screen supports artist and release (album/EP/single) search. There is no track-level request unit — the minimum requestable entity is a release. When a user searches for a song by name, MusicBrainz returns recordings; the results surface as the containing release group cards (the single or album that includes the track), with the matched track name shown as a subtitle on the card. Requesting the release acquires the whole thing, which contains the song. This matches how Lidarr handles singles: a single is a release-group type, not an individual track.

| Entity | User action | System effect | Scope |
|---|---|---|---|
| **Artist** | Monitor | System watches for new releases; artist joins the shared discovery pipeline | System-global — all users see it |
| **Album / EP / Single** | Request | Creates a `media_request` attributed to the actor (or `requested_for_user_id` for operators) | Per-user |
| **Song (track)** | Search → find containing release → Request | Same as album request | Per-user |
| **Artist** (operator, on behalf of) | Monitor | Same system-global effect — no per-user scope | System-global |
| **Album** (operator, on behalf of) | Request for User X | Creates a `media_request` with `requested_for_user_id = X` | Shows under User X's My Requests |

### 5.1 `AppShell.vue` — Nav Redesign

```js
const requesterNav = [
  { name: 'dashboard', label: 'Home', icon: 'home' },
  { name: 'discover', label: 'Discover', icon: 'discover' },
  { name: 'request-music', label: 'My Requests', icon: 'requests' },
];

const operatorNav = [
  { name: 'dashboard', label: 'Home', icon: 'home' },
  { name: 'discover', label: 'Discover', icon: 'discover' },
  { name: 'missing', label: 'Missing', icon: 'missing' },
  { name: 'activity', label: 'Activity', icon: 'activity' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
];
```

Account link moves to the sidebar footer for both roles (as it is currently). Global search input in the topbar is either removed or wired to `SearchView.vue`.

### 5.2 `DashboardView.vue` — Role-Split Home Page

`DashboardView.vue` uses a top-level `v-if isOperator` to render one of two entirely distinct layouts. No partial overlap — they share only the route and the outer `AppShell`.

**Requester layout** (top to bottom):
1. **Monitored artist card grid** — `fetchMonitoredArtists()`. Each card: `ArtworkImage` + artist name + missing-release count badge. Click → navigates to `ArtistDetailView`. The final slot in the grid is always a **"Find more artists" card** — same dimensions as an artist card, dashed border, compass/discover icon, label "Find more artists", routes to `/app/discover`. Visible whenever `artists.length > 0`; it is the persistent, low-key Discover entry point for users who already have some library.
2. **Cold-start state** (v-if no monitored artists) — renders a full-page `EmptyState` with title "Start building your music home", body copy, and a "Discover artists" CTA button routing to `{ name: 'discover' }`. **No auto-redirect on mount** — see Q7.4 resolution. The empty state disappears naturally when any artist is monitored household-wide. The "Find more artists" tail card is not shown in this state (the full `EmptyState` takes its place).
3. **Onboarding panel** (v-if issues exist) — `OnboardingSummaryPanel`, below the card grid.

**Operator layout** (top to bottom):
1. **Request queue** — all requests from all users as artwork cards. Each card: album art + release title + artist + requesting user pill + status pill (Pending, Downloading, Fulfilled, Failed) + date. Filterable by user (dropdown), by status (pill group), by date range. Sortable by date submitted (default) or by status.
2. **Active downloads strip** — live list of in-flight Soulseek downloads with progress indicators. Polls `fetchSlskdDownloads()` at 10 s.
3. **Library summary panel** — stat grid: Owned, Missing, Partial, Requested (total counts). Links to Library view, Missing view.
4. **Onboarding panel** (v-if issues exist) — `OnboardingSummaryPanel`.

### 5.22 Operator Dashboard Filter Controls

The request queue on the operator dashboard is the primary place operators manage household requests. Filter controls:
- **User filter**: dropdown listing all household users + "All users" (default). Selecting a user scopes the card grid to that user's requests only.
- **Status filter**: pill group — All, Pending, Downloading, Fulfilled, Failed. Multi-select.
- **Date range**: "Last 7 days / 30 days / All time" toggle.
- **Sort**: Date submitted (newest first), Status (active first), User (A–Z).

Filter state is not persisted — resets on navigate away. Operators also see the same `<GridControls>` filter/sort bar on the Missing and Library screens (Step 24) with operator-specific filter options (e.g., filter missing releases by requesting user).

### 5.3 `DiscoverView.vue` — New Screen

State:
```js
const seeds = ref([]);           // artists the user has picked
const suggestions = ref([]);     // current similar-artist suggestions
const monitoredIds = ref(new Set());
const isLoading = ref(false);
const query = ref('');           // seed search input
const searchResults = ref([]);   // MusicBrainz artist search results for seed input
```

Flow:
1. Empty state: search box ("Start with an artist you love") + results from `searchMusicBrainzArtists`
2. Pick an artist → `monitorArtist(artist)` + add to `seeds` + fetch `/api/v1/metadata/artists/:id/similar` → merge into `suggestions`, remove already-monitored and already-picked
3. Suggestions render as artist cards — **not** as `ArtworkImage` CAA lookups (see 7.2). Unmonitored suggestion cards use styled initial avatars: a stable background color derived from a hash of the artist MBID + the uppercased first character of the display name. Once an artist is monitored, their card transitions to showing CAA release cover art from the local metadata store. The `ArtistCard` component handles both states via a `monitored` prop that switches between the avatar and `ArtworkImage`.
4. Pick from suggestions → same loop: monitor + add to seeds + re-fetch similar for new pick + merge
5. "Done" button at any point → navigate to `dashboard`
6. Suggestions narrow toward the intersection of all seeds' similar-artist sets

**Avatar implementation (`useArtistAvatar`):** Accepts an artist MBID string. Runs a simple djb2-style hash over the MBID characters, maps the result into a curated palette of ~12 mid-saturation hues (avoiding near-black and near-white), and returns `{ bg: '#...' , fg: '#...' , initial: 'R' }`. The palette is chosen so that both a dark `fg` and a light `fg` variant are readable — color selection alternates between light and dark text based on luminance. CSS handles sizing and border-radius to match the `ArtworkImage` container dimensions exactly.

Route: `/app/discover` → `discover` (new named route in `router.js`)

### 5.4 `ArtworkImage.vue` — New Shared Component

```vue
<template>
  <div class="hx-artwork" :class="{ 'is-loading': loading, 'is-placeholder': usePlaceholder }">
    <img
      v-if="!usePlaceholder"
      :src="resolvedSrc"
      :alt="alt"
      loading="lazy"
      @error="onError"
      @load="onLoad"
    />
    <div v-else class="hx-artwork-placeholder" aria-hidden="true">
      <span class="hx-artwork-placeholder-icon">♪</span>
    </div>
  </div>
</template>
```

Props: `localSrc` (URL from local metadata API), `mbid` (release group MBID for CAA fallback), `mbidType` ('release-group' | 'release'), `alt`. Tries `localSrc` first, falls back to `https://coverartarchive.org/${mbidType}/${mbid}/front-250`, falls back to placeholder on error.

### 5.5 Server Route — `/api/v1/metadata/artists/:id/similar`

New server route (Node.js/Express). Proxies ListenBrainz `GET /1/popularity/similar-to-artist/{mbid}`, merges with MusicBrainz relationship data for the same artist, deduplicates by MBID, ranks by combined signal (ListenBrainz score + relationship type weight), caches response per artist ID for 24 hours (in-memory or DB). Returns `[{ id, name, score, source }]`.

**Rate limiting and client policy:**

ListenBrainz read-only endpoints require no API key. MusicBrainz relationship data lookups (the merge source) **MUST** use the existing `createMusicBrainzClient()` from `src/server/integrations/musicbrainz/musicbrainz-client.js`. This client enforces:
- A serial request queue with 1 100 ms minimum inter-request spacing (configurable via `MUSICBRAINZ_MIN_INTERVAL_MS`, floor: 1 000 ms) — safe under MusicBrainz's 1 req/sec per IP hard limit
- `User-Agent: Harmoniarr/<version> (<contact>)` on every request — required by MusicBrainz policy. Without a valid `HARMONIARR_CONTACT_URL` or `HARMONIARR_CONTACT_EMAIL` environment variable, the client throws at construction time.
- Exponential backoff on network errors and HTTP 503 (delay scales as `min_interval × 2^attempt` + random jitter up to 250 ms, capped at 4 doublings)

For ListenBrainz calls, a new `createListenBrainzClient()` in `src/server/integrations/listenbrainz/listenbrainz-client.js` must follow the same serial-queue pattern with a 1 000 ms minimum interval. ListenBrainz responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset-In` (seconds) headers. When `X-RateLimit-Remaining === 0`, the client must pause `X-RateLimit-Reset-In × 1 000` milliseconds before the next request.

The 24-hour per-artist cache on this route means each external service is called at most once per artist per day — far below any threshold even for a library with hundreds of monitored artists.

### 5.6 `MissingView.vue` — Card Grid

Replace the `hx-table` with an `hx-artwork-grid` card layout. Each release card: `ArtworkImage` + artist name + release title + year + Request button (if not already requested). Group by artist with collapsible artist headers. Preserve existing `useLibraryWantedReleases` composable as the data source.

### 5.7 `SearchView.vue` — Artwork-First Results

**Shipped (Step 7 complete).** `SearchView.vue` operates in two modes toggled by the user:

- **Music mode** — MusicBrainz artist + release card search. Artist results render as `ArtistCard` with `ArtworkImage` (CAA) and a Monitor toggle. Release results render as `ReleaseCard` with `ArtworkImage` and a Request action (via `ConfirmRequestModal`). Both grids use `hx-artwork-grid`.
- **Network mode** — Soulseek peer search. Returns raw file results from slskd. Oriented toward operators and power users who want to find a specific file directly.

Search is **retrieval**, not discovery. When a requester already knows what they want ("I want the new Fontaines D.C. album"), Search is the right tool — type the release title, see the card, confirm the request. Discover is for growing the monitored artist roster through graph exploration. The Monitor toggle appears on artist cards in Search because it is useful when a requester searches for an artist to request an album and realizes they should be monitoring them permanently, but it is not the primary action; the Request flow is.

**Action model per entity type and role (per Decision 8):**

| Result type | Requester action | Operator action |
|---|---|---|
| **Artist card** | [Monitor] — system-global, no user scope | [Monitor] — same |
| **Album / EP / Single card** | [Request] → `ConfirmRequestModal` → submits for self | [Request] → `ConfirmRequestModal` with "Request for" user selector |
| **Song search** | Returns the containing release card; request the release | Same, with user selector |
| **Soulseek file result** | Not accessible (network mode is operator-only) | Direct file enqueue |

**Song search flow — no N+1:** MusicBrainz recording search returns tracks. All resolution to the parent release group MUST be done **in the initial recording search call** using the `inc` parameter — never via per-recording follow-up lookups. A naive implementation that calls `lookupRelease()` or `lookupReleaseGroup()` for each result is a severe N+1: 10 results × 1 rate-limited API call × 1.1 s per call = 11+ seconds minimum. The correct approach is a single call.

**`searchRecordings` must be added to `musicbrainz-client.js`:**

```js
async function searchRecordings({ query, limit = 10, offset = 0 }) {
  return requestJson('recording', {
    operation: 'recording search',
    query: {
      query,
      limit,
      offset,
      inc: 'releases+release-groups+artist-credits',
    },
  });
}
```

The `inc=releases+release-groups+artist-credits` parameter causes the MB API to embed each recording's associated releases (including their release-group) inline in a single response. Export this from the `return` object alongside `searchArtists` and `searchReleases`.

**`searchRecordings` must be added to `musicbrainz-search-service.js`:**

```js
async function searchRecordings({ query, limit }) {
  const normalizedQuery = normalizeSearchText(query, 'query');
  const normalizedLimit = normalizeSearchLimit(limit);

  const payload = await observeMusicBrainzProviderCall(
    providerHealthRecorder,
    () => musicBrainzClient.searchRecordings({ query: normalizedQuery, limit: normalizedLimit }),
  );

  const recordings = Array.isArray(payload.recordings) ? payload.recordings : [];

  // Resolve recording → parent release group in-memory using the embedded
  // `releases[].release-group` objects returned by inc=release-groups.
  // Deduplicate by release-group MBID — multiple recordings on the same album
  // must not produce duplicate release cards.
  const releaseGroupMap = new Map();
  for (const recording of recordings) {
    const releases = Array.isArray(recording.releases) ? recording.releases : [];
    for (const rel of releases) {
      const rg = rel['release-group'];
      if (!rg?.id || releaseGroupMap.has(rg.id)) continue;
      releaseGroupMap.set(rg.id, normalizeRecordingReleaseGroupResult(recording, rel, rg));
    }
  }

  return {
    query: normalizedQuery,
    limit: normalizedLimit,
    total: payload.count ?? 0,
    offset: payload.offset ?? 0,
    results: [...releaseGroupMap.values()],
  };
}
```

**`normalizeRecordingReleaseGroupResult(recording, release, releaseGroup)`** — new helper returning:
```js
{
  id: releaseGroup.id,                   // release-group MBID → used as dedup key
  sourceProvider: 'musicbrainz',
  musicbrainzReleaseGroupId: releaseGroup.id,
  musicbrainzReleaseId: release.id,      // the specific release that surfaced this
  title: release.title,
  date: release.date ?? null,
  score: toScore(recording.score),
  artistCredit: buildArtistCredit(recording['artist-credit']),
  artist: /* first artist-credit artist, same shape as normalizeReleaseSearchResult */,
  primaryType: releaseGroup['primary-type'] ?? null,
  secondaryTypes: releaseGroup['secondary-types'] ?? [],
  matchedTrack: {                        // subtitle: "from <release title>"
    id: recording.id,
    title: recording.title,
    lengthMs: recording.length ?? null,
  },
}
```

When multiple releases for the same release-group are returned (different pressings), the first one encountered in the recording search is used — the client does not need to pick the canonical one at search time because the full release list is shown in `ReleaseDetailModal`.

The server route for recording search is `GET /api/v1/search/recordings?q=<term>&limit=<n>` — a new endpoint. It calls `searchMusicBrainzRecordings` (export added alongside the existing exports in `metadata-module.js`). The deduplication logic above runs server-side before the response reaches the client. The client renders each result as a `ReleaseCard` with `matchedTrack.title` shown as a subtitle ("from *OK Computer*"). Requesting it submits the release MBID, not the recording — the acquisition unit is a release.

**Network mode access:** The Soulseek peer search tab is visible to both roles in the nav, but only operators have the full file-enqueue capability. Requesters who land on the Network tab see a message directing them to use the music search instead. This keeps the Soulseek power-tool surface away from household requesters who would find it confusing.

The artist-card initial avatar system from Discover (see 7.2 and section 5.3) is **not** used on Search artist cards. In Search, artists are retrieved from the local metadata store (already imported) or from MusicBrainz with an immediate import intent — both paths either have CAA art already or load it via `ArtworkImage`. The initial avatar is only meaningful for completely unknown/unimported suggestions in the Discover graph.

### 5.8 Release Radar — Server Job + Home Page Section

New scheduled job (`releaseRadarJob`) runs daily. For each monitored artist, queries MusicBrainz for release groups where `first_release_date >= CURRENT_DATE - INTERVAL '30 days'` — the window is measured from the release date, not from when the artist was monitored (see Q7.6). Release group types are filtered to each artist's `monitored_release_group_types` (default: `['album', 'ep']`) — singles only appear for artists where single monitoring is explicitly enabled. Stores results in `release_radar_cache` table. New server route: `GET /api/v1/library/release-radar` → returns recent releases across all monitored artists, sorted by release date descending.

Home page: renders a "New Releases" horizontal strip above the main artist grid when `releaseRadar.length > 0`. Each card: `ArtworkImage` + artist name + release title + release date + Request button (cross-referenced against existing requests). Strip is hidden if no recent releases exist. A "View all missing releases" link at the strip footer navigates to the Missing screen for the complete age-unlimited backlog.

**Rate limiting:** The job MUST use `createMusicBrainzClient()` for all MusicBrainz API calls — never raw `fetch()`. The client's serial queue serializes MB requests process-wide at 1 req/sec. Expected job duration: ~1 second per monitored artist (one browse API call per artist, with 1 100 ms gap). For 50 monitored artists ≈ 60 seconds; for 200 artists ≈ 4 minutes — both comfortably within a daily window. No parallel artist queries; the serial queue is the contract.

**Scheduling — do not use fixed-time cron:** MusicBrainz explicitly discourages applications waking up at the same fixed time (e.g., 03:00 UTC) because it creates synchronized load spikes globally. The Release Radar job MUST be scheduled using the same heartbeat pattern as library discovery (a `setInterval`-equivalent loop with a random-offset initialization): fire 24 hours after the last completed run, plus a random jitter of `Math.floor(Math.random() * 30 * 60 * 1000)` milliseconds (0–30 minute window) to distribute load across the day. The job does NOT run at server startup — only after the first 24 h + jitter interval.

**Required environment variables (already enforced by the client):**
- `HARMONIARR_CONTACT_URL` — public URL for the instance (e.g., `https://github.com/Harmoniarr/Harmoniarr`). Preferred over email.
- `HARMONIARR_CONTACT_EMAIL` — fallback contact if no URL. One of these two is required.
- `MUSICBRAINZ_MIN_INTERVAL_MS` — optional; default 1100. Must not be set below 1000.

### 5.9 Activity Feed

Two surfaces, same data source (see Q7.7):

**Operator — full-page `ActivityFeedView.vue`**: linked from the Activity nav item (operator nav only). Full event stream with filtering by user, event type, and date range. Pagination or infinite scroll. This is the management view.

**Requester — inline "Recent Activity" panel on `RequesterHomePanel.vue`**: compact list of the last 10 household events, below the artist grid and above the onboarding panel (if present). Not paginated — just the recent heartbeat. No dedicated nav item for requesters.

Both surfaces are powered by `GET /api/v1/activity/feed`. The server returns the full household event stream with no per-user filtering — scope is controlled by the client surface (full view vs. top-10 panel). Event payload: `{ eventType, userId, userName, entityType, entityTitle, timestamp }`. Client polls at 30 s.

Event types: `request_created`, `download_completed`, `release_added`, `artist_monitored`, `request_fulfilled`. `request_fulfilled` renders differently for the requester who owns the request ("Your request for [album] is ready") vs. other users ("[album] added to library") — the `userId` field enables this distinction client-side.

Events render as a compact list: entity icon + description + relative timestamp. Attribution ("Alex") is always shown for `request_created` and `artist_monitored` events.

### 5.10 Cross-User Deduplication

On `POST /api/v1/library/media-requests`, the server performs a dedup check before inserting a new row. An "active" request is one with `status NOT IN ('cancelled', 'failed')`.

**Dedup lookup query:**

```sql
SELECT id, status, requested_for_user_id
FROM media_requests
WHERE status NOT IN ('cancelled', 'failed')
  AND (
    (musicbrainz_release_id IS NOT NULL AND musicbrainz_release_id = $1)
    OR
    (musicbrainz_release_id IS NULL
     AND lower(trim(artist_name)) = lower(trim($2))
     AND lower(trim(release_title)) = lower(trim($3)))
  )
LIMIT 1;
```

Parameters: `$1 = musicbrainzReleaseId` (nullable), `$2 = artistName`, `$3 = releaseTitle`. MBID match is preferred when present (exact); fallback to normalised text match for requests that arrived without an MBID.

**On match found:** The new request is inserted with `linked_request_id = <existing request id>`. A new row IS created — the requester gets their own status row. The download serves both. Status `pending` on the new row; both rows transition to `fulfilled` when the single download completes. HTTP response is `201 Created` with a `linked: true` flag in the body so the client can display "Someone has already requested this — you've been added to the queue."

**On no match:** Normal insert. `linked_request_id = NULL`.

**Unique constraint note:** A user cannot be linked twice to the same primary request. Add a partial unique index on migration 6.2:

```sql
CREATE UNIQUE INDEX uq_media_requests_linked_per_user
  ON media_requests (linked_request_id, requested_for_user_id)
  WHERE linked_request_id IS NOT NULL;
```

This prevents the edge case where a user submits the same request twice in rapid succession before the first insert completes.

### 5.11 Per-User Format/Quality Preferences

New `user_preferences` table (or JSON column on `users`). Fields: `preferredFormat` (enum: `flac`, `mp3-320`, `mp3-v0`, `any`), `minimumBitrate` (integer, nullable). Exposed via `GET/PUT /api/v1/users/me/preferences`. In Settings → Account, a preferences panel lets the user set their floor. Soulseek search queries attach the requesting user's preferences as filter constraints.

### 5.12 Download Result Scoring

A pluggable `createCandidateScoringService({ scorers, weights })` pipeline. Each scorer is a pure function `(candidate, referenceData) => 0–100` where `referenceData` carries MusicBrainz release data, current library state, and uploader reputation cache. Scorers combine as a weighted sum, normalized to a final 0–100 score. The pipeline runs server-side before returning ranked results to the client. Top result is auto-queued; others surface in import review.

**Hard pre-filters (reject before scoring):**
- All files locked (`lockedFileCount === fileCount`) → skip
- `uploadSpeed` below operator-configured floor (default: 0, no filter) → skip
- All extensions outside user's `allowedFormats` (Step 5.11) → skip
- `queueLength` above operator ceiling (default: 1,000,000 — matches slskd default) → skip

**Scorer definitions (default weights; all configurable in Settings → Library → Scoring):**

| Scorer | Default weight | Signal | Source |
|---|---|---|---|
| **Format tier** | 30% | FLAC = 100; MP3 320 = 70; MP3 V0 = 60; MP3 V2 = 40; MP3 <192 = 10; unknown = 0 | `extension` per file |
| **Audio depth** | 15% | `bitDepth × sampleRateHz`: 24-bit/96kHz = 100; 24-bit/44.1kHz = 80; 16-bit/44.1kHz = 60; unknown = 50 (neutral) | `bitDepth`, `sampleRateHz` per file |
| **Track count match** | 15% | Exact = 100; off by 1 = 75; off by 2–3 = 25; unknown expected = 50; off by >3 = 0 | `fileCount` vs. MusicBrainz |
| **Duration-sum match** | 15% | `Σ file.lengthSeconds` vs. MusicBrainz `release.length`. Within 5% = 100; 5–10% = 60; >10% = 10; unavailable = 50 | `lengthSeconds` per file |
| **Format consistency** | 10% | Single extension = 100; 2 extensions = 50; 3+ mixed = 0 | `normalizedPayload.extensions` |
| **Peer delivery** | 10% | `hasFreeUploadSlot` (+50 base); `uploadSpeed` percentile within result set (0–50); `queueLength` penalty: >100 = −10, >500 = −30 | `normalizedPayload` |
| **Uploader reputation** | 5% | ≥5 prior attempts: `successRate × 100`. Below floor: 50 (neutral). Penalizes known-bad uploaders without punishing unknowns | `import_candidates` aggregate |

**Upgrade-aware format boost:** If the library already holds a lower-quality version of this release, the format scorer adds +15 to any candidate that represents a quality upgrade. Requires `currentLibraryQuality` in `referenceData`.

**Architecture:**
```js
const scorers = [
  { name: 'format',       weight: 0.30, fn: scoreFormat },
  { name: 'audioDepth',   weight: 0.15, fn: scoreAudioDepth },
  { name: 'trackCount',   weight: 0.15, fn: scoreTrackCount },
  { name: 'duration',     weight: 0.15, fn: scoreDuration },
  { name: 'consistency',  weight: 0.10, fn: scoreFormatConsistency },
  { name: 'delivery',     weight: 0.10, fn: scorePeerDelivery },
  { name: 'reputation',   weight: 0.05, fn: scoreUploaderReputation },
];

function scoreCandidate(candidate, referenceData, scorers) {
  const totalWeight = scorers.reduce((s, r) => s + r.weight, 0);
  const weighted = scorers.reduce((s, r) => s + r.fn(candidate, referenceData) * r.weight, 0);
  return Math.round((weighted / totalWeight) * 100) / 100;
}
```

Uploader reputation requires no new schema — derived from `import_candidates` grouped by `username`. Format tier ordering follows Soularr `allowed_filetypes` convention. Default weights lean audiophile (format + audio depth = 45%); operator shifts weights in Settings to match household priorities. Weight changes apply to the next search — no re-scoring of historical candidates.

### 5.13 PWA

Add `public/manifest.webmanifest` with app name, icons (192px + 512px + maskable), `start_url: /app`, `display: standalone`, `theme_color`. Register a service worker (`/sw.js`) for offline shell caching.

---

**Schema additions:**

```sql
-- One-to-many per user; soft-deleted on 410/412 (never hard-deleted immediately)
CREATE TABLE user_push_subscriptions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  user_agent      TEXT,
  invalidated_at  TIMESTAMPTZ,   -- set on 410/412; NULL = active
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Async delivery queue; background worker processes pending rows
CREATE TABLE notification_queue (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  subscription_id  INTEGER REFERENCES user_push_subscriptions(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  coalesce_key     TEXT,          -- for grouping within the 2-min window
  payload          JSONB NOT NULL,
  ttl_seconds      INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending', -- pending|sent|failed|expired
  attempts         INTEGER NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**API routes:**
- `POST /api/v1/users/me/push-subscriptions` — register new subscription
- `DELETE /api/v1/users/me/push-subscriptions/:id` — explicit revoke
- `GET /api/v1/users/me/push-subscriptions/status` — returns `{ active: boolean, invalidatedAt: string|null }` for UI state
- `GET /api/v1/notifications/settings` / `PUT` — per-user notification preferences (stored in `user_notification_settings` column or `user_preferences` JSONB)

---

**Events, defaults, and TTLs (see Q7.9):**
- `request_fulfilled` — ON always, TTL 86400s, tag `request_fulfilled:${requestId}`
- `new_release_from_monitored_artist` — OFF by default, TTL 259200s, coalesced into batch within 2-min window
- `download_completed` — operators only, OFF by default, TTL 3600s

---

**Notification payload shape:**
```json
{
  "title": "OK Computer is ready",
  "body": "Your request has been fulfilled and is now in your library.",
  "icon": "/icons/icon-192.png",
  "badge": "/icons/badge-72.png",
  "tag": "request_fulfilled:42",
  "renotify": false,
  "actions": [
    { "action": "view", "title": "View" },
    { "action": "dismiss", "title": "Dismiss" }
  ],
  "data": { "url": "/app/my-requests", "eventType": "request_fulfilled" }
}
```

---

**Server-side dispatch (`enqueueNotification`):**

Event emitters (request service, release radar job, import service) call `enqueueNotification({ userId, eventType, entityId, payload })` rather than calling `webpush.sendNotification()` directly. This function:
1. Resolves all active (non-invalidated) subscription rows for the user
2. Applies coalescing: checks for an unprocessed row with same `(user_id, event_type, coalesce_key_group)` within the last 2 minutes — updates payload if found, inserts if not
3. Writes one `notification_queue` row per subscription

The background worker (same heartbeat pattern as library discovery) processes `pending` rows where `next_attempt_at <= NOW()`:
- **HTTP 410/412**: set `subscription.invalidated_at = NOW()`, mark queue row `expired`
- **5xx / network error**: exponential backoff — `next_attempt_at = NOW() + (30s × 2^attempts)`, max 3 attempts, then mark `failed`
- **Success**: mark `sent`, set `sent_at`

---

**Service worker push and click handlers:**

```js
// sw.js — foreground suppression
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: false }).then(clients => {
      const focused = clients.find(c => c.focused);
      if (focused) {
        focused.postMessage({ type: 'push-notification', data });  // in-app toast
      } else {
        return self.registration.showNotification(data.title, {
          body: data.body, icon: data.icon, badge: data.badge,
          tag: data.tag, renotify: false, data: data.data, actions: data.actions,
        });
      }
    })
  );
});

// sw.js — deep-link click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: false }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(targetUrl));
      return self.clients.openWindow(targetUrl);
    })
  );
});
```

Click targets: `request_fulfilled` → `/app/my-requests`, `new_release` → `/app/release-radar`, `download_completed` → `/app/activity/operations`.

---

**`useNotificationPermission()` composable — permission state machine:**

All surfaces that interact with push (ConfirmRequestModal, Settings → Notifications) consume this composable rather than calling `Notification.permission` directly. States and their UI implications:

| State | UI |
|---|---|
| `unknown` | Show "Get notified" offer (contextual, post-confirm) |
| `granted+subscribed` | Subscription active; show management UI |
| `granted+expired` | "Your subscription expired. [Re-enable]" CTA |
| `granted+unsubscribed` | Auto-resubscribe silently on next app load |
| `denied` | "Blocked in browser — open Site Settings → Notifications to re-enable" (no broken Enable button) |
| `unsupported` | Hide notification UI entirely |
| `ios-needs-standalone` | Illustrated "Add to Home Screen" guidance |

---

**Permission request timing — contextual:**

The permission prompt fires inside `ConfirmRequestModal` after the user confirms a request, before the modal closes. An inline callout renders: *"Get notified when it's ready. [Enable notifications]"* — one button, dismissible. Only shown when `permissionState === 'unknown'`. Settings → Notifications is the management surface, not the acquisition surface.

---

**Notification preferences schema (future-proofed for per-artist granularity):**

```json
{
  "request_fulfilled": { "enabled": true },
  "new_release": { "enabled": false, "except_artist_mbids": [] },
  "download_completed": { "enabled": false }
}
```

Adding per-artist exclusions in v2 is additive JSON — `except_artist_mbids` is already present. No schema migration required.

---

**VAPID keys:** Generated and stored in app config on first boot. Never re-generated in-place — changing VAPID keys invalidates all existing subscriptions instantly.

### 5.14 `ArtistDetailView.vue` — New Screen

Routes (see Q7.10 for full rationale):
```js
{ path: 'artists/local/:id(\\d+)',   name: 'artist-detail-local', component: ArtistDetailView },
{ path: 'artists/:mbid([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
  name: 'artist-detail', component: ArtistDetailView },
```

Both routes render `ArtistDetailView.vue`. The component derives its mode from which param is present. Route ordering matters — `local` must come first to prevent `:mbid` consuming the literal `local` segment.

**Data composable:** `useArtistDetail(mbid)` — three independent parallel fetches (see Q7.10):
1. `GET /api/v1/metadata/musicbrainz/artists/:mbid/local` → core artist + monitoring (existing route)
2. `GET /api/v1/metadata/musicbrainz/artists/:mbid/discography` → release groups with pre-computed `acquisitionState` per group (new endpoint)
3. `GET /api/v1/metadata/artists/:mbid/similar` → related artists strip (existing similarity route)

Sections fail independently. Section 3 timeout/failure hides the strip; sections 1+2 are unaffected.

**Full mode** (MBID present):
- Hero row: name (from route state — renders instantly), then artwork fills in from API response. `sort_name` subtitle if different, monitoring toggle, country + type pill, "Open in MusicBrainz" link (`musicbrainz.org/artist/:mbid`)
- Bio excerpt: from `raw_payload` annotation or `annotation` field cached in the artist record. No extra MB call if already stored; blank if absent
- Discography grid: grouped by type (Albums → EPs → Singles → Other), ordered by `first_release_date DESC` within group. Each card shows `acquisitionState` pill: `owned` / `requested` / `missing` / `coming_soon`. Cards open `ReleaseDetailModal` on click
- Related artists strip: horizontal-scroll `ArtistCard` thumbnails. Visible only when `similar.length > 0`
- Nav breadcrumb: `Home → [Artist Name]` using route state name before API resolves

**Local mode** (no MBID — edge case):
- On mount: calls `GET /api/v1/metadata/artists/local/:id`. If response contains `musicbrainzArtistId`, silently `router.replace` to `artist-detail` route (URL upgrades, no flash)
- Hero: name from route data, no portrait, monitoring toggle
- Muted notice: *"No MusicBrainz data linked — biography and related artists unavailable"*
- Local discography grid from DB (no acquisition states in v1 for local-mode artists — shown as grey `unlinked` pill)
- No bio, no related artists, no external link

**Loading skeleton:**
- Hero: name renders immediately from `history.state`. Artwork shows skeleton rect
- Discography: skeleton card tiles (same dimensions as real cards) while `discographyLoading`
- Similar strip: compact spinner only while `similarLoading`

**Document title:** Set to `"${artistName} — Harmoniarr"` in `onMounted` / `watch(artist, ...)`. Uses route state name until API resolves so title is never blank.

**Acquisition state priority (server-computed):** `owned` > `requested` > `missing` > `coming_soon` > `unmonitored`

Route accessible to both requesters and operators.

### 5.15 Release Detail Modal — `ReleaseDetailModal.vue`

Modal component used wherever a release card appears in the app (home page, Missing screen, Search, Library, Artist Detail). See Q7.11 for full data source, canonical selection, ownership, and MB fallback rationale.

**Props:**
- `releaseGroupMbid: string` — required; the canonical key
- `releaseGroupId?: string` — local UUID, optional hint to avoid an MBID lookup
- `releaseTitle: string` — rendered in hero immediately on open
- `artistName: string` — rendered in hero immediately on open
- `releaseYear?: string` — rendered in hero immediately on open
- `artworkUrl?: string` — rendered in hero immediately on open (re-uses already-loaded `ArtworkImage` from the originating card)
- `preferReleaseMbid?: string` — if provided, pre-selects this specific edition on open (used by Artist Detail cards that know the release MBID from the discography endpoint)

**Data composable: `useReleaseDetail(releaseGroupMbid, { preferReleaseMbid? })`**

Single call to `GET /api/v1/metadata/musicbrainz/release-groups/:rgMbid/tracklist` (with optional `?preferReleaseMbid=`). Returns `{ release, media, ownership, allReleases, requestState, source }` in one round trip. One `loading` ref governs the whole modal — no per-section loading state.

Edition switching calls the same endpoint with `?preferReleaseId=<localUUID>`. Response shape is always identical — `isOwned` indicators, `ownership` summary, and `requestState` are all present on every call regardless of which edition is active.

**Layout (top to bottom):**

1. **Hero row** — artwork (from props, instant), title, artist, year, label, total runtime, track count. Renders synchronously on open with no skeleton.

2. **Ownership callout** — shown only when `0 < ownership.matchedTrackCount < ownership.expectedTrackCount`:
   > *"You already own 10 of 12 tracks. Requesting will complete your collection."*
   Hidden when release is fully owned or unowned. For `reconciliationStatus = "partial"`.

3. **Action row** — request state rendered from `requestState` (no second fetch):
   - **Requesters:** "Request" / "Cancel Request" / status badge (Downloading, Owned)
   - **Operators:** Same + "Request for" `<select>` listing all household users, defaulting to self. `onBehalfOfUserId` in request body; server validates admin. Selector hidden entirely for requesters (role check in composable, not template).

**"Request for" user list — population spec:**

The `<select>` in the operator action row is populated by a `useActiveUsers()` composable. This composable is only invoked when `isOperator` is true — requesters never call it.

```js
// src/client/composables/useActiveUsers.js
import { ref } from 'vue';
import { fetchUsers } from '../lib/users-api.js';

// Module-level cache — fetched once per operator session, shared across all modal opens.
let cachedUsers = null;
let fetchPromise = null;

export function useActiveUsers() {
  const users = ref(cachedUsers ?? []);
  const isLoading = ref(!cachedUsers);
  const error = ref(null);

  if (!cachedUsers) {
    if (!fetchPromise) {
      fetchPromise = fetchUsers()
        .then((data) => {
          cachedUsers = (data.users ?? []).filter((u) => !u.isDisabled);
          fetchPromise = null;
          return cachedUsers;
        })
        .catch((err) => {
          fetchPromise = null;
          throw err;
        });
    }
    fetchPromise.then((resolved) => {
      users.value = resolved;
      isLoading.value = false;
    }).catch((err) => {
      error.value = err;
      isLoading.value = false;
    });
  }

  return { users, isLoading, error };
}
```

Key decisions:
- **Disabled users are excluded.** `GET /api/v1/users` returns all users; the composable filters `!u.isDisabled` before returning. A disabled user cannot receive a request.
- **Module-level cache.** The user list is fetched once per page load (not per modal open) and reused. For a household app (2–10 users), this is appropriate. If Settings → Users creates or disables a user, a page refresh picks it up.
- **Fetch is only triggered when `isOperator`.** No API call is made for requester sessions; the composable is not imported in requester code paths.
- **The selector defaults to the acting operator's own user ID** (`sessionUserId`). The `<option value="">` first item is "Myself" (maps to null / uses `requested_by_user_id`). Other users are listed alphabetically by username.
- **Loading state:** While `isLoading = true`, the selector renders as disabled with a single "Loading users..." option. The Confirm button is also disabled until the user list resolves.
- **Error state:** If the fetch fails, the selector shows "Unable to load users" and the Confirm button remains disabled. A retry button appears. This is a rare failure case; the most likely cause is a broken session, which would be caught at the route level.

4. **Edition switcher** — pill row, visible only when `allReleases.length > 1`:
   ```
   [OK Computer (1997, GB) ●]  [Japanese Ed. (1997, JP) ···]  [Deluxe (2009, XW) ···]
   ```
   Active edition has filled indicator. Each non-canonical pill has a `···` menu with **"Set as Default Edition"**, which calls `PATCH /api/v1/metadata/releases/:releaseId/canonical`. Server re-runs `markCanonicalRelease` with the user's choice, responds with updated `allReleases`. Switcher reflects new canonical without modal re-open.

5. **Tracklist** — disc-grouped. Columns: owned indicator (`●` when `isOwned: true`, empty otherwise), track number (`numberText` if present, else `position`), title, duration (`mm:ss` from `lengthMs`; `—` if null). Multi-disc: `"Disc N"` section header per medium, or medium `title` if set (e.g. `"Live Disc"`). Single-disc: no header. Per-disc total duration shown for multi-disc releases.

6. **Source note** — `source: "musicbrainz"` only: muted inline note *"Tracklist from MusicBrainz — not yet in your library."* plus a subtle "importing in background..." indicator while `enqueueMetadataImport` runs. Hidden when `source: "local"`.

**Skeleton state:** While `loading = true`, the hero row is fully rendered from props. Sections 2–6 show track-shaped skeleton rows (number + title + duration columns). The skeleton matches the tracklist's disc structure if `release.mediumCount` is available on the card (optional hint prop).

**"Open in MusicBrainz"** — external link in the modal footer, visible in full mode only. `https://musicbrainz.org/release/{releaseMbid}`. Requires `release.musicbrainzReleaseId` to be non-null.

### 5.16 `LibraryView.vue` — Owned Music Screen

Route: `/app/library`. Accessible to both roles. See Q7.12 for full "owned" definition, partial/missing screen split, aggregation strategy, codec pre-aggregation, and endpoint rationale.

**Two view modes (toggle in `GridControls`):**
- **Release-flat** (default): one card per release group with status treatment per below
- **Artist grouping**: one card per artist via `LATERAL` aggregation; clicking switches to release-flat filtered to that artist

**Data composable: `useLibraryReleases(filters, sort)`**

Calls `GET /api/v1/library/owned-releases` with cursor-based pagination. Appends cursor on scroll-to-end (`IntersectionObserver` sentinel at grid bottom). `totalCount` in header: *"142 albums"*. Re-fetches from cursor=null when any filter or sort changes.

---

**"Needs Attention" structured section (above the main grid):**

Two independent sections, each hidden when empty:

**A — "Complete your collection"** (shown when `partial` releases exist):
Horizontal scroll strip of up to 5 partial-release cards. Each card shows artwork, title, `matched/expected` count, and a single **"Request remaining N tracks"** CTA that opens `ReleaseDetailModal`. "+ N more" overflow scrolls to the partial-filtered main grid. The strip is not a separate page or modal — it's an inline actionable section above the grid.

**B — "Duplicates to review"** (shown when `duplicate` releases exist):
Collapsible list (not a grid). Collapsed by default; expand state in `localStorage`. Each row shows: release title, artist, duplicate file count, and a **"Review files"** link.

**"Review files" destination** — `{ name: 'settings-library-browser', query: { releaseGroupId: item.releaseGroupId } }` (Vue Router location). This navigates to Settings → Library Browser with the release group pre-selected. The Library Browser already supports `?releaseGroupId=` deep-linking via `normalizeMetadataRouteState(route.query)` — the release group opens immediately on arrival.

Do NOT link to `/app/activity/operations?releaseGroupId=<id>&reason=duplicate` — `OperationsView` handles operation run history (scan runs, organize runs), not file-level duplicate management. It does not accept or process `releaseGroupId` or `reason` query params. Sending users there creates a dead-end.

**Why Library Browser:** `MetadataView.vue` (at `settings-library-browser`) shows the local file tree for a release group: all tracked files, their paths, and reconciliation state. An operator can see exactly which duplicate files exist (two copies of `01 - Airbag.flac` from different import runs) and their on-disk paths. They then delete the unwanted copy via their file system and re-run a library scan to re-reconcile. This is the correct workflow for a v1 app that does not include a built-in file-delete operation.

**No "No operations found" message.** The previous spec referenced a fallback message in `OperationsView` — remove it. If the Library Browser shows a release group with duplicate files, that is the full workflow. No secondary fallback is needed.

---

**Card — `LibraryReleaseCard.vue`:**
- Full artwork with `ArtworkImage` lazy-loading
- Artist name + release title + year below art
- **Status treatment**:
  - `complete` — no badge (clean; the majority state)
  - `partial` — amber SVG arc overlay on artwork corner showing `matched/expected` fraction. Accessible tooltip: *"8 of 12 tracks"*. Card body shows two actions: **"Play"** (deferred, no playback v1 — shown disabled with tooltip *"Playback coming soon"*) and **"Request remaining"**
  - `duplicate` — small **Duplicate** chip bottom-left of art; links to filtered Operations. Hidden by "Hide Duplicates" toggle
- Clicking art or title opens `ReleaseDetailModal` (Q7.11)

---

**`GridControls` bar (all server-side params):**
- **Sort**: Artist Name (A→Z / Z→A), Release Year (newest / oldest), Date Acquired (newest first)
- **Filter**: Status (All / Complete / Partial / Duplicate), Artist (autocomplete from owned set), Format (FLAC / MP3 / Other — from `codec_summary`), Genre (dropdown from owned `raw_payload` tags), Year range (min/max)
- **Quick toggle**: "Hide Duplicates" — shortcut for `?status=complete,partial`
- All emitted state maps 1:1 to `?sort=`, `?order=`, `?status=`, `?format=`, `?genre=` query params — see Q7.14

---

**Empty states:**
- No library at all: "Your library is empty. Request some music to get started." + CTA to Missing screen
- Active filter returns zero: "No albums match your filters." + "Clear filters" button
- Artist grouping with all-partial artist: artist card shows amber partial indicator with album count

**Stale data note:** If `last_reconciled_at` of any visible release is > 7 days old, a muted inline note appears below the header: *"Library scan hasn't run recently. Some counts may be outdated."* Links to Settings → Library. Does not block the view.

### 5.17 Album Art Color Extraction — Server-Side Primary, OKLCH-Adaptive CSS

See Q7.13 for full rationale, CORS analysis, gap analysis, and worker design.

**Server-side (primary path):**

`artwork-ingestion-service.js` — `prepareArtworkAsset()` appends after sanitize:
```js
const stats = await sharp(buffer).stats(); // histogram-based, built into sharp
const { r, g, b } = stats.dominant;
const { l, c, h } = rgbToOklch(r, g, b); // src/server/artwork/color-utils.js
if (c >= 0.05) { // vibrancy gate: suppress near-grey
  asset.dominantHue = h;
  asset.dominantChroma = c;
  asset.dominantLightness = l;
}
```

Schema: `dominant_hue NUMERIC(6,2) NULL`, `dominant_chroma NUMERIC(6,4) NULL`, `dominant_lightness NUMERIC(6,4) NULL` on `artwork_assets`. Generated `dominant_hex VARCHAR(7)` for API compatibility (derived from stored OKLCH components).

API response: `dominantColor: { hue, chroma, lightness, hex } | null`.

**Client-side (secondary path — null `dominantColor` + same-origin only):**

`useArtworkColor(imgRef, { isSameOrigin, dominantColor, artworkAssetId })` composable:
- `dominantColor` non-null: apply immediately, no worker
- `isSameOrigin` false: return null, no worker
- Otherwise: `createImageBitmap(imgRef.value, { resizeWidth: 16, resizeHeight: 16, resizeQuality: 'pixelated' })` → transfer to singleton worker

Worker algorithm (upgraded from first-pass):
1. For each of 256 pixels: convert RGB → OKLCH, keep pixels with C ≥ 0.05 (vibrancy gate)
2. If no saturated pixels: return null (monochrome image)
3. Sort by hue, find largest cluster within ±30° of each hue, use its chroma-weighted centroid
4. Return `{ hue, chroma, lightness }` matching the server-side schema

Worker safety: try/catch wraps all operations; returns null result on error. Singleton client has 4s per-job timeout; on `worker.onerror` drains all pending with null and resets `worker = null`.

**Write-back (one-time persistence of client-extracted colors):**

After worker resolves non-null result, fire-and-forget:
```js
fetch(`/api/v1/artwork/assets/${artworkAssetId}/dominant-color`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
  body: JSON.stringify({ hue, chroma, lightness }),
}).catch(() => {});
```
Endpoint writes only `WHERE dominant_hue IS NULL` (never overwrites server-computed values). After first write-back, subsequent page loads use the stored value — worker never fires for this asset again.

**`ArtworkImage.vue`:** Add `defineExpose({ imgRef, activeSrc })`. No `crossOrigin` changes.

**CSS — OKLCH-adaptive, theme-aware:**

Card components set three custom properties:
```js
// computed in card
{ '--card-accent-h': dominantColor.hue,
  '--card-accent-c': dominantColor.chroma,
  '--card-accent-ref-l': dominantColor.lightness }
```

```css
/* Dark mode: lighten the hue to a visible mid-bright value */
.hx-release-card {
  border: 1px solid color-mix(
    in oklch,
    oklch(0.72 var(--card-accent-c, 0) var(--card-accent-h, 0)) 40%,
    transparent
  );
  transition: border-color 0.2s ease;
}
/* Light mode: darken the same hue for contrast on white */
[data-theme="light"] .hx-release-card {
  border-color: color-mix(
    in oklch,
    oklch(0.38 var(--card-accent-c, 0) var(--card-accent-h, 0)) 50%,
    transparent
  );
}
.hx-release-card:hover {
  border-color: oklch(0.72 var(--card-accent-c, 0) var(--card-accent-h, 0) / 0.85);
}
```

Fixed lightness values (`0.72` dark, `0.38` light) guarantee the border is always visible regardless of source artwork brightness. Hue and chroma are preserved exactly. When `--card-accent-c` is `0` (no accent), `oklch(L 0 H)` is achromatic — blends to invisible — and the element's base `--hx-border-default` shows through.

**`prefers-reduced-motion`:** Skip worker invocation. Server-side OKLCH props are still applied (static property, not animation).

### 5.18 Rich Empty States — `EmptyState.vue`

New shared component `EmptyState.vue`. Props: `title`, `body`, `ctaLabel`, `ctaTo` (router-link target). Used on: Discover (no seeds: "Start with an artist you love"), Missing (library complete: "Nothing missing. Library is up to date."), My Requests (no requests: "You haven't requested anything yet."), Library (empty library: "Your library is empty."), Activity feed (no events: "No recent activity."). Each instance is visually distinct via a slot-based icon, not generic. Replaces all bare `hx-empty` text strings.

### 5.19 Global Toast System — `useToast` + `<ToastStack>`

Composable `useToast()` exposes: `toast.success(message)`, `toast.error(message)`, `toast.info(message)`. `<ToastStack>` is mounted once in `AppShell.vue` — listens via a shared reactive queue, renders toasts as a fixed-position stack (bottom-right on desktop, bottom-center on mobile). Toasts auto-dismiss after 4 s. Errors persist until dismissed. All existing inline success/error state in individual views is replaced with `toast.*` calls. No global state store required — a module-level `ref` array is sufficient.

### 5.20 `<GridControls>` — Filter and Sort Bar

See Q7.14 for full rationale, per-view mode decision, gap analysis, and composable design.

**`GridFilterState` (forward-compatible with v1.1 multi-value):**

```ts
interface GridFilterState {
  sort: { field: string; order: 'asc' | 'desc' };
  filters: Record<string, string | string[]>; // v1: always string; v1.1: string[] for multi-select
}
```

URL encoding: `?sort=title&order=asc&format=flac`. Multi-value in v1.1: repeated params `?format=flac&format=mp3` — Vue Router 4 already returns these as `string[]` from `route.query`. No parser change between v1 and v1.1.

**`GridControls.vue` — stateless `v-model` component:**

Props: `modelValue: GridFilterState`, `sortOptions: { value, label }[]`, `filterGroups: { key, label, options: { value, label }[] }[]`, `isDefault: boolean`.
Emits: `update:modelValue: GridFilterState`.

Renders: sort dropdown (left) + active filter pills with per-pill clear × buttons (right). Active filter count badge on the "Filters" pill trigger. "Clear all" link rendered when `!isDefault`. On mobile: collapses to bottom-sheet trigger.

No internal state, no `localStorage`. All persistence is owned by `useGridState`.

**`useGridState(defaults, options)` composable** (`src/client/composables/useGridState.js`):

```ts
interface UseGridStateOptions {
  filterGroupKeys: string[];  // keys that belong to this view's filter namespace
  restoreKey?: string;        // if set, persists last non-default state to sessionStorage
}

interface UseGridStateReturn {
  filterState:     ComputedRef<GridFilterState>;
  isDefault:       ComputedRef<boolean>;
  updateState:     (patch: DeepPartial<GridFilterState>) => void;
  clearFilter:     (key: string) => void;
  clearAll:        () => void;
  toggleSortOrder: () => void;
}
```

Key behaviours:
- `filterState` is a `computed` over `route.query` — no write on mount except for the `restoreKey` restore path (see Gap 14)
- All writes use `router.replace` (not push) — filter changes do not create new history entries
- **URL param validation** (`parseAndValidateQuery`) runs inside `filterState` computed: unknown `sort` values fall back to default; unknown filter values are dropped. Attacker-crafted URLs produce clean defaults, not display corruption or server 400 errors
- Text search inputs debounce 300ms before calling `updateState`; discrete selections (pills, dropdowns) call `updateState` immediately
- `clearAll` removes all `sort`, `order`, and `filterGroupKeys` params from the URL, preserving any unrelated query params
- `clearFilter(key)` removes one param key from the URL
- `toggleSortOrder` flips `asc` ↔ `desc` in one call — no caller duplication
- `isDefault` is passed as a prop to `<GridControls>` for "Clear all" visibility

**`sessionStorage` restore (Library view only):**

Library view uses `useGridState(defaults, { restoreKey: 'library', filterGroupKeys })`. When the user returns to `/app/library` with no URL params (fresh sidebar navigation), `useGridState` restores the last non-default state from `sessionStorage` via a single `router.replace` on mount. Any view that uses no `restoreKey` behaves the standard way (no restore, defaults on fresh navigation).

**Filtering mode by view:**

| View | Mode | Consumer |
|---|---|---|
| Library view | Server-side | `useLibraryReleases(filterState)` — 300ms debounce + AbortController; `GET /api/v1/library/owned-releases` |
| Missing screen | Client-side | `computed(() => data.value.filter(...).sort(...))` over pre-fetched array |
| My Requests | Client-side | Same client-side `computed` pattern |
| Home Artist Grid | Client-side | Same client-side `computed` pattern |

**`useLibraryReleases(filterState)` — stale-while-revalidate server-side consumer:**

```ts
interface UseLibraryReleasesReturn {
  data:        Ref<Release[]>;        // current confirmed-good results
  staleData:   Ref<Release[]>;        // last successful results (non-null after first load)
  isLoading:   Ref<boolean>;
  isFirstLoad: Ref<boolean>;          // true until first successful response
  error:       Ref<Error | null>;
  isEmpty:     ComputedRef<boolean>;
  retry:       () => void;
}
```

Three rendering paths in the Library view template:
- `isFirstLoad && isLoading` → skeleton card grid (N placeholder cards)
- `!isFirstLoad && isLoading` → `staleData` at 60% opacity + spinner badge in GridControls bar
- `error && !isFirstLoad` → inline error callout above `staleData` (data remains visible) + retry button
- `error && isFirstLoad` → full-page error state with retry button
- `isEmpty && !isLoading` → empty state ("No releases match these filters" with clear-filters CTA)

**`useLibraryFilterOptions()` — background poll, stale-while-revalidate:**

Fetches `GET /api/v1/library/filter-options` on mount and re-fetches every 60 seconds in the background. Updates `options` reactively — no loading state shown on background polls. Codecs added by background reconciliation appear in the filter panel at the next 60s tick. Passed as `filterGroups` prop to `<GridControls>`.

**Display preferences** (grid vs list view mode, collapsed "Needs Attention" section state from Q7.12) remain in `localStorage` — these are UI preferences, not navigational state.

### 5.21 Dark / Light Theme

New CSS variable set at `[data-theme="light"]` in `design-system.css`, mapping all `--hx-*` props to light-mode equivalents. `AppShell.vue` reads `user_preferences.theme` (from the existing preferences JSONB column, Step 6.4) and sets `data-theme` on `<html>`. If no preference is set, defaults to `prefers-color-scheme` via a `matchMedia` listener. Manual override toggle in Settings → Account: "Appearance — Dark / System / Light" (three-way). Persisted via `PUT /api/v1/users/me/preferences`.

### 5.23 Settings Sub-Nav — Issue #4 Additions

**Current state (as-built before Issue #4):**

`SettingsWorkspaceView.vue` is the layout shell with a left-side sub-nav. Four sections are registered in `settingsSectionNavigationItems`:

| Section | Route | Description |
|---|---|---|
| General | `/app/settings` | Security posture, base URL, runtime defaults |
| Connections | `/app/settings/connections` | slskd connectivity, provider intake credentials |
| Media & storage | `/app/settings/media-storage` | Artwork policy, path mapping, validation health |
| Users & access | `/app/settings/users` | App users, Plex import, managed library folders |

Three additional routes exist but are **not in the sub-nav** (no pills): Account Security (`/app/settings/account`), Recovery (`/app/settings/recovery`), Library Browser (`/app/settings/library-browser`).

**Issue #4 changes to `settings-navigation.js`:**

Add these items to `settingsSectionNavigationItems` in order:

```js
{
  id: 'library',
  label: 'Library',
  description: 'Download scoring, discovery schedule, and reconciliation settings.',
  type: 'section',
},
{
  id: 'notifications',
  label: 'Notifications',
  description: 'Push notification preferences and active browser subscriptions.',
  type: 'section',
},
{
  id: 'library-browser',
  label: 'Library browser',
  description: 'Explore and search raw metadata, files, and reconciliation state.',
  type: 'section',
},
{
  id: 'recovery',
  label: 'Recovery',
  description: 'Emergency admin recovery tools.',
  type: 'section',
},
```

**Issue #4 router additions in `router.js`:**

```js
{ path: 'library',        name: 'settings-library',        component: SettingsLibraryView },
{ path: 'notifications',  name: 'settings-notifications',  component: SettingsNotificationsView },
```

`recovery` and `library-browser` are already registered as child routes — they only need the nav items above to become visible.

**`SettingsLibraryView.vue` — New component for `settings-library`:**

| Control | Description |
|---|---|
| **Scoring weights** | Sliders for each scorer (format tier, audio depth, release match, uploader trust, availability). Values stored in `app_settings`. Defaults shown; revert-to-default available per row. Applies on next search. |
| **Discovery schedule** | Toggle: auto-discover (run every `N` hours, configurable via slider). Manual trigger: "Run now" button (calls `POST /api/v1/library/discovery/run`). Shows last run time and status. |
| **Reconciliation schedule** | Same pattern as discovery. Manual trigger: "Reconcile now". |
| **Minimum quality floor (system default)** | Operator-configured fallback for requesters who haven't set a personal preference. Dropdown: Any / FLAC / MP3 320+ / MP3 V0+. Stored in `app_settings` JSONB. |

**`SettingsNotificationsView.vue` — New component for `settings-notifications`:**

Per-user view (reads/writes `app_users.preferences.notifications` via `GET/PUT /api/v1/users/me/preferences`). Content:

| Control | Description |
|---|---|
| **Subscribe this browser** | "Enable push notifications" toggle. Calls `PushManager.subscribe()` on enable; sends `POST /api/v1/notifications/subscriptions` with endpoint + keys. Unsubscribe sends `DELETE /api/v1/notifications/subscriptions/:endpoint`. Shows "Notifications active" / "Not subscribed" state. |
| **Request fulfilled** | Toggle — "Notify me when my requests complete." Default: on. |
| **New release from monitored artist** | Toggle — "Notify me when a monitored artist releases new music." Default: off. |
| **Download completed** | Toggle (operators only) — "Notify me when a download finishes." Default: off. |

Push permission is requested only on toggle-on (not on page load). If the browser blocks notifications, an inline notice replaces the toggle: "Notifications blocked in this browser — update your browser settings to allow." No notification is sent if `Notification.permission !== 'granted'`.

**Extensions to existing views:**

*`SettingsGeneralView.vue`* — Add a read-only info row: **"MusicBrainz User-Agent"** showing the computed string `Harmoniarr/<version> (<contact>)`. If `HARMONIARR_CONTACT_URL` and `HARMONIARR_CONTACT_EMAIL` are both unset, show a warning: "Set `HARMONIARR_CONTACT_URL` or `HARMONIARR_CONTACT_EMAIL` in your environment. MusicBrainz requires a contact identifier in every API request." This is informational only — no edit control.

*`AccountSecurityView.vue`* (already `settings-account`) — Add two new sections above the existing password-change section:
1. **Appearance** — Three-way toggle: Dark / System / Light. Writes `user_preferences.theme`. (Spec: Section 5.21)
2. **Music preferences** — Dropdown for preferred format (Any / FLAC / MP3 320+ / MP3 V0+) + optional minimum bitrate field. Writes `user_preferences.preferredFormat` and `user_preferences.minimumBitrate`. (Spec: Section 5.11)

### 5.24 Request Cancellation — Endpoint + Cascade Spec

The "cancel action" appears on `RequestCard` in `MyRequestsView.vue` and on the operator dashboard request queue (Step 6). This section specifies the server contract.

**Endpoint:** `PATCH /api/v1/library/media-requests/:id`

**Request body:** `{ "status": "cancelled" }`

Do NOT use `DELETE /api/v1/library/media-requests/:id` — physical deletion would null out all `linked_request_id` references via the `ON DELETE SET NULL` FK constraint, corrupting the dedup chain. Status transition is the only correct approach.

**Auth rules:**

| Actor | Can cancel | Guard |
|---|---|---|
| Requester | Own requests only | `requested_by_user_id = session.userId` OR `requested_for_user_id = session.userId` |
| Operator | Any request | `isOperator` check |

**Cancellable statuses:** `pending`, `queued`. Requests in `downloading`, `fulfilled`, or `failed` state return `409 Conflict` with code `request_not_cancellable`. Cancelling an already-cancelled request returns `409` with code `request_already_cancelled`.

**`cancelMediaRequest` store method:**

```js
async function cancelMediaRequest({ requestId, actorUserId, isOperator }) {
  const pool = getPoolFn();

  const result = await pool.query(
    `
    UPDATE media_requests
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = $1
      AND status IN ('pending', 'queued')
      AND ($2::boolean OR requested_by_user_id = $3 OR requested_for_user_id = $3)
    RETURNING id, status, linked_request_id
    `,
    [requestId, isOperator, actorUserId],
  );

  if (result.rowCount === 0) {
    // Check whether the row exists and what status it has, to give a precise error code
    const check = await pool.query(
      'SELECT status FROM media_requests WHERE id = $1', [requestId]
    );
    if (check.rowCount === 0) return { notFound: true };
    const { status } = check.rows[0];
    if (status === 'cancelled') return { alreadyCancelled: true };
    return { notCancellable: true, status };
  }

  return { cancelled: true, row: result.rows[0] };
}
```

**Cascade behaviour — fulfillment continues for linked users:**

When a primary request is cancelled (i.e. `linked_request_id IS NULL` on the cancelled row), other users may have followed requests pointing to it. The download MUST continue for those users. Fulfillment is always determined by `musicbrainz_release_id` (or artist+title fallback) match across all non-cancelled requests — NOT by traversing the `linked_request_id` chain. Specifically, when a download job completes:

```sql
UPDATE media_requests
SET status = 'fulfilled', updated_at = NOW()
WHERE status NOT IN ('cancelled', 'failed', 'fulfilled')
  AND (
    (musicbrainz_release_id IS NOT NULL AND musicbrainz_release_id = $1)
    OR (musicbrainz_release_id IS NULL
        AND lower(trim(artist_name)) = lower(trim($2))
        AND lower(trim(release_title)) = lower(trim($3)))
  );
```

This means cancelling the primary request does NOT cancel other users' requests. Their status stays `pending`/`queued`; a new primary is not needed. When the download completes, they get fulfilled regardless of whether their `linked_request_id` points to a cancelled row.

**Cancellation of a linked follower** (where `linked_request_id IS NOT NULL`): only that row is updated; no effect on the primary or other followers.

**`RequestCard` cancel button visibility:** Show only when `status IN ('pending', 'queued')`. Operators see it on all requests; requesters see it only on their own. Use `PATCH` with a loading state; on success update the local `status` field optimistically. On `409`, show a toast: "This request can no longer be cancelled."

---

### 5.25 Search Completion Wait — Dispatch Correctness Fix

**Problem:** `dispatchReadyDiscoveryRequests` calls `slskdService.startSearch()` and then immediately calls `importCandidateService.ingestSlskdSearchResponses()`. `startSearch` submits the query to the Soulseek network and returns as soon as slskd acknowledges it — `isComplete` on the returned object is `false`. slskd then spends up to `searchTimeoutMs` (default 15 s) collecting responses from peers. Fetching responses before the search is complete harvests only peers who replied within milliseconds — typically low-quality sharers or those with simple directory layouts. High-quality FLAC uploaders with large collections respond later in the window. This is confirmed by Soularr (the reference Lidarr/Soulseek integration), which explicitly adds a 5-second sleep followed by a polling loop before reading results.

slskd search states:
| `state` value | Meaning |
|---|---|
| `InProgress` | Collecting responses from peers |
| `Completed` | Timeout elapsed normally; responses ready |
| `TimedOut` | Internal timeout; responses ready |
| `Errored` | Search failed internally |
| `Cancelled` | Manually cancelled |

`isComplete` on `SlskdSearchState` is `true` for any state other than `InProgress`. Polling until `state !== 'InProgress'` (or equivalently `isComplete === true`) is the correct completion signal. `TimedOut` still yields usable results and must not be treated as an error.

**Fix — add `waitForSearchCompletion` to `slskdService`:**

```js
// slskd-service.js

async function waitForSearchCompletion({
  searchId,
  initialDelayMs = 2000,
  pollIntervalMs = 2000,
  timeoutMs = 25000,
}) {
  await delay(initialDelayMs); // allow slskd state to propagate before first poll

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await getSearchState({ searchId, includeResponses: false });
    if (state.isComplete) {
      return { timedOut: false, state };
    }
    await delay(pollIntervalMs);
  }

  // timeout: proceed with partial results rather than failing the dispatch
  return { timedOut: true, state: null };
}
```

`delay(ms)` is `new Promise(resolve => setTimeout(resolve, ms))`. The 2 s initial delay matches observed slskd behaviour: state often remains `InProgress` for 1–2 s immediately after a search is submitted. Polling at 2 s intervals is sufficient; 1 s would save at most one extra interval and adds unnecessary load. `timeoutMs = 25000` gives a 10 s buffer beyond the 15 s default `searchTimeoutMs`; both are independently configurable.

**Dispatch service update:**

```js
// library-discovery-dispatch-service.js

const search = await slskdService.startSearch({ query: searchQuery });
await slskdService.waitForSearchCompletion({ searchId: search.id });
const ingestionResult = await importCandidateService.ingestSlskdSearchResponses({
  actorUserId,
  requestOwnership,
  requestMetadata,
  searchId: search.id,
});
```

On `waitForSearchCompletion` timeout (`timedOut: true`): log a warning and continue to ingest — partial results are preferable to zero results. On `waitForSearchCompletion` throwing (slskd unreachable): propagate the error; it becomes a `discovery_dispatch_failed` failure already handled by the surrounding `try/catch`.

**Batch size adjustment:** With completion wait, each dispatch iteration can take up to `searchTimeoutMs + timeoutMs` = ~40 s. With `dispatchBatchSize = 5`, a full batch may take ~3.3 minutes. This is within acceptable bounds for a background job. No change to `dispatchBatchSize` is required, but operators can reduce it in settings if queue pressure is a concern.

**`slskdService` export:**

```js
return {
  enqueueDownloads,
  getConnectionStatus,
  getDownload,
  getDownloads,
  getSearchResponses,
  getSearchState,
  startSearch,
  waitForSearchCompletion,  // new
};
```

**No schema change required.** This is a pure service-layer fix.

---

### 5.26 Search Query Fallback Ladder

**Problem:** `buildDiscoverySearchQuery` produces a single string: `"Artist Title Year"`. When a search returns zero import candidates, the dispatch service records a success with `candidateCount: 0` and applies the 6-hour cooldown. After 6 hours, the same query is retried and usually produces the same zero result. This loop continues indefinitely, silently.

Common causes of zero-result first attempts:
- **Year token mismatch**: MusicBrainz `first_release_date` is the original release year. A peer sharing a 2019 remaster of a 1986 album may not tag it with `1986`. The year token on Soulseek is keyword-fuzzy (not a filter), but peers who don't include the year in folder names won't match it at all.
- **Diacritics**: `Sigur Rós`, `Björk`, `Motörhead` — normalization differences between MusicBrainz and peer folder names cause no match on exact string.
- **Punctuation**: `AC/DC`, `Guns N' Roses`, `!!!` — special characters cause mis-tokenization in Soulseek's keyword engine.
- **Artist name variation**: `The National` vs `National`, `Jay-Z` vs `Jay Z`, `Beyoncé` vs `Beyonce`.
- **Network availability**: All peers holding this release may be offline during the search window.

**Fix — multi-rung query ladder with per-attempt normalization:**

| `search_attempt_count` value when dispatching | Query built | Normalization applied | Cooldown after this attempt |
|---|---|---|---|
| `0` (first attempt) | `"Artist Title Year"` (year omitted if null) | Raw MusicBrainz strings | 6 h |
| `1` (second attempt) | `"Artist Title"` (year stripped) | Diacritic-stripped, punctuation-normalized | 2 h |
| `2` (third attempt) | `"Title"` only (artist stripped; only if title is ≥ 4 words or ≥ 20 chars) | Same as attempt 2 | 2 h |
| `≥ 3` | No dispatch; mark `discoveryState = 'exhausted'` | — | — |

**Diacritic + punctuation normalization** (applied on attempts 2+):
```js
function normalizeFallbackQuery(value) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')   // strip combining diacritic marks
    .replace(/[/:]/g, ' ')    // slash and colon → space
    .replace(/['.!?]/g, '')   // remove apostrophes, periods, punctuation
    .replace(/\s+/g, ' ')
    .trim();
}
```

**Revised `buildDiscoverySearchQuery`:**
```js
export function buildDiscoverySearchQuery({
  artistName,
  releaseDate,
  releaseGroupTitle,
  releaseTitle,
  searchAttemptCount = 0,
}) {
  const rawTitle = normalizeQueryPart(releaseTitle) ?? normalizeQueryPart(releaseGroupTitle);
  const rawArtist = normalizeQueryPart(artistName);

  if (searchAttemptCount >= 2) {
    // Attempt 3: title only. Guard: skip if title too short (avoids flood results)
    const titleLength = rawTitle?.length ?? 0;
    const wordCount = rawTitle?.split(/\s+/).length ?? 0;
    if (!rawTitle || (titleLength < 20 && wordCount < 4)) {
      return null; // escalate to 'exhausted' rather than a useless one-word search
    }
    return normalizeFallbackQuery(rawTitle);
  }

  if (searchAttemptCount === 1) {
    // Attempt 2: artist + title, no year, diacritics stripped
    const parts = [rawArtist, rawTitle].filter(Boolean);
    return parts.length > 0 ? normalizeFallbackQuery(parts.join(' ')) : null;
  }

  // Attempt 1 (default): original behaviour
  const year = getReleaseYear(releaseDate);
  return [rawArtist, rawTitle, year].filter(Boolean).join(' ') || null;
}
```

**Dispatch service changes:**

1. `claimNextReadyAutomaticDiscoveryRequest` must return `searchAttemptCount` from the row (add to the SELECT).
2. Pass `searchAttemptCount: claimedRequest.searchAttemptCount` to `buildDiscoverySearchQuery`.
3. On `candidateCount === 0` after a successful search, treat it as requiring a fallback — increment `searchAttemptCount` and schedule the next attempt with a reduced cooldown:

```js
// After successful search with zero candidates:
const nextCooldownMs = claimedRequest.searchAttemptCount >= 1
  ? 2 * 60 * 60 * 1000   // 2 h for attempts 2 and 3
  : automaticCooldownMs; // 6 h for attempt 1

await libraryDiscoveryRequestStore.recordDiscoverySearchSuccess({
  candidateCount: 0,
  fileCount: 0,
  metadataReleaseId: claimedRequest.metadataReleaseId,
  nextSearchAfter: new Date(Date.now() + nextCooldownMs).toISOString(),
  searchAttemptCount: (claimedRequest.searchAttemptCount ?? 0) + 1,
  searchId: search.id,
  searchQuery,
});
```

4. When `buildDiscoverySearchQuery` returns `null` due to `searchAttemptCount >= 3` (or title-too-short guard): call a new store method `markDiscoveryRequestExhausted({ metadataReleaseId })` which sets `discoveryState = 'exhausted'` and stops automatic retries. Emit a notification (Section 5.18 / notification system) with event type `discovery_request_exhausted` so the operator is alerted.

**Exhausted state recovery:** The operator can manually trigger a re-search from Settings → Library → Active Requests (resets `searchAttemptCount` to `0` and clears `exhausted` state). This is the same manual override surface as the reconciliation trigger.

**Schema change required:** Add `search_attempt_count INTEGER NOT NULL DEFAULT 0` to `library_discovery_requests`. See migration in Section 6. No index needed; this field is only read when the row is claimed.

---

### 5.27 Transfer Failure Recovery — Cascade-to-Next Candidate

**Problem:** When `enqueueDownloads` returns all-failed (`enqueuedCount === 0`) for a selected candidate, `import-candidate-execution-worker.js` calls `markImportCandidateDownloadFailed`. The candidate's status becomes `failed`. `buildMediaRequestFulfillmentStatus` sorts candidates by priority — `failed` has priority `190`, below `pending` (300) and `held` (290) — but if all candidates for that release-group are `failed`, the request status derives to `code: 'failed'` with no automatic next step. The request is permanently stuck.

This is confirmed as a systemic issue in slskd: GitHub issue [#1346 "Retry errored transfers more aggressively"](https://github.com/slskd/slskd/issues/1346) (marked Done in the slskd project, meaning slskd itself added some retry logic in v0.x) and [#959 "Automated retries of failed downloads"](https://github.com/slskd/slskd/issues/959). However, slskd's internal retry operates at the transfer level (re-enqueue a specific file). Harmoniarr's recovery operates at the candidate level (try a different peer's share).

**slskd transfer terminal states that indicate enqueue failure at the Harmoniarr layer:**
- `enqueueDownloads` returns all filenames in `failed[]` — this is the failure signal used by the execution worker. This occurs when slskd rejects the enqueue request entirely (peer offline, connection refused, API error).
- Individual file-level failures (slskd state `Completed, Errored`, `Completed, Cancelled`, `Completed, TimedOut`, `Completed, Rejected`, `Completed, Aborted`) are monitored separately via the transfer snapshot service; these represent mid-transfer failures after slskd accepted the enqueue.

**Two failure modes requiring separate recovery paths:**

**Mode A — Enqueue rejected (all-failed):** The peer was unreachable when Harmoniarr tried to enqueue. Recovery: immediately try the next-ranked candidate from the same search (`source_search_id` match or `metadata_release_id` match), without waiting for any transfer to complete.

**Mode B — Mid-transfer failure:** slskd accepted the files but the transfer failed mid-flight (peer went offline, transfer errored). Recovery: the transfer snapshot polling service detects the terminal state; candidate is marked `failed` and cascade proceeds as Mode A.

**Recovery cascade — execution worker changes:**

When `markImportCandidateDownloadFailed` is called (either mode):

```js
async function handleCandidateFailure({ failedCandidateId, operationRunId, sourceSearchId, metadataReleaseId }) {
  const failed = await getImportCandidate({ importCandidateId: failedCandidateId });
  const attemptCount = (failed?.downloadAttemptCount ?? 0) + 1;
  await updateCandidateDownloadAttemptCount({ importCandidateId: failedCandidateId, downloadAttemptCount: attemptCount });

  const MAX_CANDIDATE_ATTEMPTS = 3;

  // Find next available candidate for the same release
  const nextCandidate = await importCandidateStore.findNextCandidateForRecovery({
    excludeCandidateId: failedCandidateId,
    metadataReleaseId,
    sourceSearchId,
    // Exclude candidates that have already exceeded MAX_CANDIDATE_ATTEMPTS
    maxDownloadAttemptCount: MAX_CANDIDATE_ATTEMPTS - 1,
  });

  if (nextCandidate) {
    await promoteImportCandidateToSelected({ importCandidateId: nextCandidate.id });
    // Schedule a new execution run — the current run is completing for other candidates;
    // this triggers a follow-up run for this release only.
    await scheduleRecoveryExecutionRun({ importCandidateId: nextCandidate.id, triggeredByFailedCandidateId: failedCandidateId });
    return { recovered: true, nextCandidateId: nextCandidate.id };
  }

  // No more candidates available — trigger re-search if attempts < limit
  const MAX_RESEARCH_ATTEMPTS = 2;
  const researchCount = await libraryDiscoveryRequestStore.getResearchAttemptCount({ metadataReleaseId });

  if (researchCount < MAX_RESEARCH_ATTEMPTS) {
    await libraryDiscoveryRequestStore.scheduleRediscovery({
      metadataReleaseId,
      nextSearchAfter: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 h
      searchAttemptCount: 1, // use fallback query rung (no year, diacritics stripped)
    });
    return { recovered: false, scheduledRediscovery: true };
  }

  // All candidates tried, all re-searches exhausted — surface operator notification
  await notificationService.emit({
    eventType: 'download_recovery_exhausted',
    metadataReleaseId,
    detail: `All ${MAX_CANDIDATE_ATTEMPTS} candidates and ${MAX_RESEARCH_ATTEMPTS} re-searches failed for this release.`,
  });
  return { recovered: false, scheduledRediscovery: false };
}
```

**`findNextCandidateForRecovery` SQL:**

```sql
SELECT *
FROM import_candidates
WHERE source_search_id = $1         -- same search, OR:
   OR (metadata_release_id IS NOT NULL AND metadata_release_id = $2)
AND status IN ('pending', 'held')
AND id != $3                        -- not the failed candidate
AND download_attempt_count < $4     -- not already exhausted
ORDER BY
  -- prefer higher score if scoring is implemented; fall back to more files
  COALESCE(score, 0) DESC,
  file_count DESC,
  discovered_at ASC
LIMIT 1;
```

**Candidate promotion:** When a candidate is promoted to `selected` via recovery, set `selectedAt = NOW()`, `status = 'selected'`, `selectionReason = 'recovery_cascade'` (a new optional text column, nullable, for observability). No new execution planning run is needed if the current run is still active — the worker checks for newly-selected candidates before completing. If the current run has already finished, a lightweight follow-up run is triggered immediately.

**`download_attempt_count` tracking:** Persisted on `import_candidates`. Ensures the same peer is not infinitely re-enqueued. The cap is `MAX_CANDIDATE_ATTEMPTS = 3` per candidate, matching Soularr's `MAX_FILE_RETRIES = 4` philosophy (fail fast, move on, don't loop forever). The counter is never decremented — if a candidate fails 3 times, it is permanently excluded from recovery.

**Mid-transfer failure detection (Mode B):** The existing `slskd-transfer-snapshot-service.js` reads transfer state per username. A new `monitorActiveDownloads` step in the import execution worker polls transfers for `downloading` candidates every 30 s. If a transfer reaches a terminal failure state (`Completed, Errored` / `Completed, Cancelled` / `Completed, TimedOut` / `Completed, Aborted`), call `handleCandidateFailure`. `Completed, Rejected` (peer queue full) uses the same path but schedules re-enqueue of the same candidate after a 10-minute delay before trying the cascade (peer may become available again).

**Schema changes required:**
- `download_attempt_count INTEGER NOT NULL DEFAULT 0` on `import_candidates`
- `selection_reason TEXT NULL` on `import_candidates` (optional; for operator observability in import review)
- `research_attempt_count INTEGER NOT NULL DEFAULT 0` on `library_discovery_requests` (tracks how many re-searches have been triggered by Mode A/B failures, separate from `search_attempt_count` which tracks query rung ladder)

See migrations in Section 6.

---

## 6. DB Migrations Required

> **Schema conventions:** All primary keys use `UUID DEFAULT harmoniarr_generate_uuid()`. All foreign keys to `app_users` reference the `UUID` PK on that table. `SERIAL`/`INTEGER` PKs and `INTEGER` FKs are never used. Filenames follow `YYYYMMDD_HHMMSS_description.sql`.

### 6.1 Similar-Artist Cache (Optional)

If the similar-artist proxy caches to DB rather than in-memory:

```
20260601_020000_create_artist_similarity_cache.sql
```

```sql
CREATE TABLE IF NOT EXISTS artist_similarity_cache (
  artist_mbid     TEXT        NOT NULL,
  similar_mbid    TEXT        NOT NULL,
  score           NUMERIC     NOT NULL DEFAULT 0,
  source          TEXT        NOT NULL, -- 'listenbrainz' | 'musicbrainz'
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (artist_mbid, similar_mbid, source)
);

CREATE INDEX IF NOT EXISTS artist_similarity_cache_artist_score_idx
  ON artist_similarity_cache (artist_mbid, score DESC);
```

In-memory cache (per-process, cleared on restart) is acceptable for v1 of the Discover feature. DB cache enables cross-session reuse and is preferred if the ListenBrainz API has rate limits that affect UX.

### 6.2 `musicbrainz_release_id` + `linked_request_id` on `media_requests`

Required for cross-user deduplication (Step 13). `musicbrainz_release_id` enables exact match; `linked_request_id` links duplicate requests to the same download job.

```
20260601_030000_add_musicbrainz_and_dedup_to_media_requests.sql
```

```sql
ALTER TABLE media_requests
  ADD COLUMN IF NOT EXISTS musicbrainz_release_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS linked_request_id      UUID NULL REFERENCES media_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS media_requests_musicbrainz_release_id_idx
  ON media_requests (musicbrainz_release_id)
  WHERE musicbrainz_release_id IS NOT NULL;
```

**Note on `on_behalf_of_user_id` / `requested_for_user_id`:** Decision 8 and Step 9 reference an `on_behalf_of_user_id` column. This column was already added — under the name `requested_for_user_id` — in migration `20260504_020000_media_request_target_user.sql`. All spec references to `on_behalf_of_user_id` mean `requested_for_user_id`. No additional migration is needed for this column.

### 6.3 `release_radar_cache` Table

Required for Release Radar (Step 11). Caches recent-release results per monitored artist to avoid querying MusicBrainz on every page load.

```
20260601_040000_create_release_radar_cache.sql
```

```sql
CREATE TABLE IF NOT EXISTS release_radar_cache (
  release_group_mbid  TEXT        NOT NULL PRIMARY KEY,
  artist_mbid         TEXT        NOT NULL,
  artist_name         TEXT        NOT NULL,
  title               TEXT        NOT NULL,
  first_release_date  DATE,
  primary_type        TEXT,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_radar_artist
  ON release_radar_cache (artist_mbid);

CREATE INDEX IF NOT EXISTS idx_release_radar_date
  ON release_radar_cache (first_release_date DESC)
  WHERE first_release_date IS NOT NULL;
```

### 6.4 `preferences` Column on `app_users`

Required for per-user format/quality preferences and theme settings (Steps 15, 25). Note: the table is `app_users`, not `users`.

```
20260601_050000_add_preferences_to_app_users.sql
```

```sql
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Default `{}` means "no preference — use system defaults." The `preferences` JSONB is a single nested object shared by all per-user preference features:

```json
{
  "preferredFormat": "flac",
  "minimumBitrate": null,
  "theme": "system",
  "notifications": {
    "request_fulfilled": { "enabled": true },
    "new_release":       { "enabled": false, "except_artist_mbids": [] },
    "download_completed":{ "enabled": false }
  }
}
```

Absent keys mean "use default." The schema is forward-compatible: new preference fields are added as new keys without a migration.

### 6.5 `user_push_subscriptions` + `notification_queue` Tables

Required for PWA push notifications (Step 17). Two tables in one migration — they are functionally coupled and the queue references the subscription.

```
20260601_060000_create_push_notification_tables.sql
```

```sql
-- Push subscription registry — one row per browser/device registration.
-- Soft-deleted on 410/412 (invalidated_at set, never hard-deleted immediately).
-- Pruned after 30 days via a background maintenance task.
CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  user_id         UUID        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint        TEXT        NOT NULL UNIQUE,
  p256dh          TEXT        NOT NULL,
  auth            TEXT        NOT NULL,
  user_agent      TEXT        NULL,
  invalidated_at  TIMESTAMPTZ NULL,   -- set on 410/412; NULL means active
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active-subscription lookup: used by the notification dispatch path.
CREATE INDEX IF NOT EXISTS user_push_subscriptions_active_idx
  ON user_push_subscriptions (user_id, invalidated_at)
  WHERE invalidated_at IS NULL;

-- Async notification delivery queue — decouples event emitters from webpush I/O.
-- Background worker polls pending rows and calls webpush.sendNotification().
CREATE TABLE IF NOT EXISTS notification_queue (
  id               UUID        PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  user_id          UUID        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  subscription_id  UUID        NULL REFERENCES user_push_subscriptions(id) ON DELETE CASCADE,
  event_type       TEXT        NOT NULL,
  coalesce_key     TEXT        NULL,   -- groups related events within the 2-min coalesce window
  payload          JSONB       NOT NULL,
  ttl_seconds      INTEGER     NOT NULL CHECK (ttl_seconds > 0),
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'sent', 'failed', 'expired')),
  attempts         INTEGER     NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at          TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary worker polling index: pending rows ordered by delivery time.
CREATE INDEX IF NOT EXISTS notification_queue_pending_delivery_idx
  ON notification_queue (next_attempt_at ASC)
  WHERE status = 'pending';

-- Coalescing check: find an unprocessed row matching the same (user, type, coalesce_key)
-- within the last 2 minutes to determine whether to insert or update.
CREATE INDEX IF NOT EXISTS notification_queue_coalesce_lookup_idx
  ON notification_queue (user_id, event_type, coalesce_key, created_at DESC)
  WHERE status = 'pending' AND coalesce_key IS NOT NULL;
```

**VAPID keys** are stored in `app_settings` / `encrypted_secrets` (existing infrastructure), not in this table. They are generated and persisted on first server boot. Re-generating VAPID keys invalidates all existing subscriptions — this operation is intentionally not automated.

### 6.6 `is_canonical` on `metadata_releases`

Required for `ReleaseDetailModal` canonical edition selection (Q7.11, Step 19). The migration only adds the column and index; the backfill runs server-side after deployment (see note below).

```
20260601_070000_add_canonical_to_metadata_releases.sql
```

```sql
ALTER TABLE metadata_releases
  ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT FALSE;

-- Enforces at most one canonical release per release group at the DB layer.
-- A partial index on a boolean column with WHERE is_canonical = TRUE is the
-- correct pattern: it only indexes TRUE rows, keeping index size minimal and
-- writes fast for the overwhelmingly-FALSE default.
CREATE UNIQUE INDEX IF NOT EXISTS metadata_releases_one_canonical_per_group_idx
  ON metadata_releases (metadata_release_group_id)
  WHERE is_canonical = TRUE;
```

**Post-migration server-side backfill (not part of the migration SQL):**

After this migration runs, all existing rows have `is_canonical = FALSE`. The server must call `markCanonicalRelease(releaseGroupId)` (already specced in Q7.11) for every release group that has at least one `metadata_releases` row but no canonical release.

**Startup insertion point:** `startup-runtime.js` runs in this order:
1. `bootstrapDatabaseSchemaFromSnapshot()` — initialize schema if empty
2. `assertNoPendingMigrations()` — confirm all migrations applied
3. `buildStartupValidationService().assertStartupReady()` — validate runtime prerequisites
4. **← backfill runs here** — after migrations confirmed, before the app module graph is built
5. `buildApp()` — construct Express app and all service modules
6. `app.listen()` — begin accepting HTTP requests

The backfill lives in `src/server/startup-tasks/backfill-canonical-releases.js`:

```js
// src/server/startup-tasks/backfill-canonical-releases.js
import { getPool } from '../db.js';
import { markCanonicalRelease } from '../metadata/canonical-release-service.js';

export async function backfillCanonicalReleases({ getPoolFn = getPool } = {}) {
  const pool = await getPoolFn();

  // Detect release groups with no canonical selection.
  const { rows } = await pool.query(`
    SELECT DISTINCT mr.metadata_release_group_id
    FROM metadata_releases mr
    WHERE NOT EXISTS (
      SELECT 1 FROM metadata_releases mr2
      WHERE mr2.metadata_release_group_id = mr.metadata_release_group_id
        AND mr2.is_canonical = TRUE
    )
  `);

  if (rows.length === 0) return;  // Nothing to backfill — fast path on steady-state startups.

  for (const { metadata_release_group_id } of rows) {
    await markCanonicalRelease(metadata_release_group_id, { pool });
  }
}
```

Called in `startup-runtime.js`:

```js
await backfillCanonicalReleases({ getPoolFn: resolvePool });
```

**Idempotency:** The detection query only returns groups with `is_canonical = FALSE` across all releases. Steady-state startups (post-backfill, no new groups) hit the fast path and return immediately. The partial-completion case (startup interrupted mid-backfill) re-runs safely because `markCanonicalRelease` is already idempotent — it clears the previous canonical before setting the new one.

**`markCanonicalRelease` signature:** `markCanonicalRelease(releaseGroupId: UUID, { pool } = {}) → Promise<void>`. Does not throw if the release group has no releases (empty set of candidates → no-op). Runs the 5-step canonical selection algorithm defined in Q7.11 and executes two `UPDATE` statements in sequence. The partial unique index enforces the one-canonical invariant at the DB layer — concurrent calls for the same group will serialize on the index constraint.

Until the task finishes, any `ReleaseDetailModal` open returns a null canonical (empty tracklist). The modal must handle this gracefully with a retry prompt. For a typical household library (< 5 000 release groups), the backfill completes in under two seconds; the server being temporarily unavailable is not a user-visible issue.

### 6.7 `first_matched_at` + `codec_summary` on `library_release_reconciliations`

Required for "Date acquired" sort and format filter in Library view (Q7.12, Step 20). Both columns are `NULL`-initial — backfill happens via the normal reconciliation job, not this migration.

```
20260601_080000_add_library_reconciliation_aggregates.sql
```

```sql
-- Added NULL (not DEFAULT NOW()) so that un-backfilled rows are identifiable.
-- The reconciliation job backfills WHERE first_matched_at IS NULL LIMIT 500 per tick.
-- The "Date acquired" sort falls back to last_reconciled_at while NULL rows remain.
ALTER TABLE library_release_reconciliations
  ADD COLUMN IF NOT EXISTS first_matched_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS codec_summary     JSONB       NULL;

-- Supports "sort by date acquired" — covers the filter on first_matched_at.
CREATE INDEX IF NOT EXISTS library_release_reconciliations_first_matched_at_idx
  ON library_release_reconciliations (first_matched_at DESC)
  WHERE first_matched_at IS NOT NULL;
```

**`first_matched_at` backfill:** The reconciliation job's tick function adds this at the start of each run:

```sql
UPDATE library_release_reconciliations
SET first_matched_at = (
  SELECT COALESCE(MIN(lfm.matched_at), lrr.last_reconciled_at)
  FROM library_file_matches lfm
  WHERE lfm.metadata_release_id = library_release_reconciliations.metadata_release_id
    AND lfm.match_status = 'matched'
)
WHERE first_matched_at IS NULL
LIMIT 500
RETURNING id;
```

Repeat on each tick until the count of returned rows is zero. Then run a follow-up migration to add `NOT NULL` once confirmed fully backfilled:

```
20260601_081000_first_matched_at_not_null.sql   -- applied only after backfill is complete
ALTER TABLE library_release_reconciliations
  ALTER COLUMN first_matched_at SET NOT NULL,
  ALTER COLUMN first_matched_at SET DEFAULT NOW();
```

**`codec_summary` population:** The reconciliation job recomputes this on every run for rows it processes (not a one-time backfill). `codec_summary` stores the result of `SELECT audio_codec, COUNT(*) FROM library_file_matches ... GROUP BY audio_codec` serialized as `{"flac": 10, "mp3": 2}`. `NULL` means the row has not yet been re-reconciled since this column was added; those rows are treated as "unknown format" by the format filter (included when no format filter is active).

### 6.8 Dominant Color Columns on `artwork_assets`

Required for album art color extraction and theme-adaptive card borders (Q7.13, Step 21). Includes the `oklch_to_hex()` SQL function needed by the generated `dominant_hex` column.

```
20260601_090000_add_artwork_dominant_color.sql
```

```sql
-- OKLCH → linear sRGB → gamma-compressed sRGB → 6-character hex string.
-- IMMUTABLE STRICT: output depends only on inputs; returns NULL when any input is NULL.
-- PARALLEL SAFE: no shared state.
-- Used by the dominant_hex generated column below.
CREATE OR REPLACE FUNCTION oklch_to_hex(l_in NUMERIC, c_in NUMERIC, h_in NUMERIC)
RETURNS VARCHAR(7)
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
  WITH
  -- Step 1: OKLCH → Oklab (a, b components)
  ab AS (
    SELECT
      (c_in * cos(radians(h_in::double precision)))::numeric AS a_ok,
      (c_in * sin(radians(h_in::double precision)))::numeric AS b_ok
  ),
  -- Step 2: Oklab → LMS cube-roots (the Björn Ottosson matrix)
  lms_prime AS (
    SELECT
      l_in + 0.3963377774 * ab.a_ok + 0.2158037573 * ab.b_ok AS lp,
      l_in - 0.1055613458 * ab.a_ok - 0.0638541728 * ab.b_ok AS mp,
      l_in - 0.0894841775 * ab.a_ok - 1.2914855480 * ab.b_ok AS sp
    FROM ab
  ),
  -- Step 3: cube to get linear LMS
  lms AS (
    SELECT lp^3 AS l, mp^3 AS m, sp^3 AS s FROM lms_prime
  ),
  -- Step 4: linear LMS → linear sRGB, clamped to [0, 1] (handles out-of-gamut colors)
  lin AS (
    SELECT
      GREATEST(0.0::double precision, LEAST(1.0::double precision,
        ( 4.0767416621*l - 3.3077115913*m + 0.2309699292*s)::double precision)) AS r,
      GREATEST(0.0::double precision, LEAST(1.0::double precision,
        (-1.2684380046*l + 2.6097574011*m - 0.3413193965*s)::double precision)) AS g,
      GREATEST(0.0::double precision, LEAST(1.0::double precision,
        (-0.0041960863*l - 0.7034186147*m + 1.7076147010*s)::double precision)) AS b
    FROM lms
  ),
  -- Step 5: linear sRGB → gamma-compressed sRGB (IEC 61966-2-1 transfer function)
  srgb AS (
    SELECT
      CASE WHEN r <= 0.0031308 THEN 12.92 * r ELSE 1.055 * r^(1.0/2.4) - 0.055 END AS r8,
      CASE WHEN g <= 0.0031308 THEN 12.92 * g ELSE 1.055 * g^(1.0/2.4) - 0.055 END AS g8,
      CASE WHEN b <= 0.0031308 THEN 12.92 * b ELSE 1.055 * b^(1.0/2.4) - 0.055 END AS b8
    FROM lin
  )
  -- Step 6: scale to [0, 255], round, format as lowercase hex with leading-zero padding
  SELECT
    '#' ||
    lpad(to_hex(round(r8 * 255)::integer), 2, '0') ||
    lpad(to_hex(round(g8 * 255)::integer), 2, '0') ||
    lpad(to_hex(round(b8 * 255)::integer), 2, '0')
  FROM srgb;
$$;

-- Store hue angle, chroma, and reference lightness separately.
-- Lightness is NOT used for rendering — overridden at CSS time per active theme.
-- dominant_hex is a generated backward-compatibility alias for legacy API consumers.
ALTER TABLE artwork_assets
  ADD COLUMN IF NOT EXISTS dominant_hue       NUMERIC(6,2)  NULL, -- degrees 0–360
  ADD COLUMN IF NOT EXISTS dominant_chroma    NUMERIC(6,4)  NULL, -- OKLCH C, 0.0–0.4
  ADD COLUMN IF NOT EXISTS dominant_lightness NUMERIC(6,4)  NULL; -- OKLCH L, 0.0–1.0 (reference)

ALTER TABLE artwork_assets
  ADD COLUMN IF NOT EXISTS dominant_hex VARCHAR(7)
    GENERATED ALWAYS AS (oklch_to_hex(dominant_lightness, dominant_chroma, dominant_hue)) STORED;
```

**No backfill required.** Newly ingested artwork receives OKLCH values at ingest time via `sharp.stats()`. Pre-migration assets start with all four columns `NULL`. Client-side worker write-back (`PATCH /api/v1/artwork/assets/:id/dominant-color`, `WHERE dominant_hue IS NULL`) populates them on first Library view load, one asset at a time. After the first write-back for each asset, subsequent page loads use the stored value — the worker never fires for that asset again.

**`oklch_to_hex` update policy:** If the function body is corrected for a precision fix, redeploy with `CREATE OR REPLACE FUNCTION`. STORED generated column values are recomputed only when the row is next updated (i.e., when `dominant_hue`/`dominant_chroma`/`dominant_lightness` change). Existing stored `dominant_hex` values from the old function are not retroactively recomputed. For correctness-critical situations, run: `UPDATE artwork_assets SET updated_at = NOW() WHERE dominant_hue IS NOT NULL;` to trigger regeneration — the UPDATE touching any column causes the generated column to recompute.

### 6.9 `activity_events` Table

Required for the Activity Feed (Step 12). Provides the persistent log that `GET /api/v1/activity/feed` reads from. See Section 5.9 and Q7.7 for event types and attribution design.

```
20260601_100000_create_activity_events.sql
```

```sql
-- Append-only household activity log. Never updated; only inserted and (eventually)
-- pruned by a background task after a configurable retention window (default: 90 days).
CREATE TABLE IF NOT EXISTS activity_events (
  id           UUID        PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  event_type   TEXT        NOT NULL
               CHECK (event_type IN (
                 'request_created', 'download_completed',
                 'release_added', 'artist_monitored', 'request_fulfilled'
               )),
  actor_user_id    UUID    NULL REFERENCES app_users(id) ON DELETE SET NULL,
  entity_type      TEXT    NULL,   -- 'release', 'artist', 'media_request'
  entity_id        UUID    NULL,   -- FK to the entity; not enforced at DB level (polymorphic)
  entity_title     TEXT    NULL,   -- denormalized display name; survives entity deletion
  entity_artist    TEXT    NULL,   -- denormalized artist name for releases
  extra_payload    JSONB   NULL,   -- event-specific supplemental data (e.g., download speed)
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary feed read: most recent N events, optionally filtered by event_type.
CREATE INDEX IF NOT EXISTS activity_events_occurred_at_desc_idx
  ON activity_events (occurred_at DESC);

-- Per-user filtering on the operator Activity view.
CREATE INDEX IF NOT EXISTS activity_events_actor_occurred_at_idx
  ON activity_events (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

-- Event-type filtering with date range.
CREATE INDEX IF NOT EXISTS activity_events_type_occurred_at_idx
  ON activity_events (event_type, occurred_at DESC);
```

**Emitter contract:** Every event type has a designated emitter in the server service layer:

| Event | Emitter location |
|---|---|
| `request_created` | `media-request-service.js` — after successful `INSERT INTO media_requests` |
| `download_completed` | Soulseek download completion handler — after file is written to disk |
| `release_added` | Reconciliation job — after a release transitions to `complete` for the first time |
| `artist_monitored` | Artist monitoring service — after `updateMetadataArtistMonitoring` sets `monitored = true` |
| `request_fulfilled` | Import service — after a request's matched release reaches `complete` reconciliation status |

Each emitter calls a shared `recordActivityEvent({ eventType, actorUserId, entityType, entityId, entityTitle, entityArtist, extraPayload })` helper in `src/server/activity/activity-event-service.js`. This helper does a single `INSERT INTO activity_events` — fire-and-forget (no await in the emitter's call path; log errors but do not surface to caller).

**Retention and pruning:** A background maintenance task (same heartbeat pattern as library discovery) deletes rows where `occurred_at < NOW() - INTERVAL '90 days'` in batches of 1000. Retention window is configurable via `app_settings`. The feed endpoint never reads rows older than the retention window — no pagination gap.

**No per-user filtering at the DB layer:** `GET /api/v1/activity/feed` returns the full household stream. Scope (full-page vs. top-10 panel) is controlled at the client rendering layer as per Q7.7 — not by a server-side `WHERE actor_user_id = $currentUser` filter.

### 6.10 Search Attempt Tracking on `library_discovery_requests`

Required for the query fallback ladder (Section 5.26). Tracks which rung of the query ladder has been attempted and how many re-searches have been triggered by download failures (Section 5.27).

```
20260601_110000_add_search_attempt_tracking_to_library_discovery_requests.sql
```

```sql
-- search_attempt_count: which query rung has been tried (0 = never searched,
--   1 = first attempt complete, 2 = second attempt complete, etc.)
-- research_attempt_count: how many re-searches were triggered by download
--   failure recovery (Section 5.27); separate from query rung progression.
ALTER TABLE library_discovery_requests
  ADD COLUMN IF NOT EXISTS search_attempt_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS research_attempt_count INTEGER NOT NULL DEFAULT 0;
```

No index needed. Both columns are only read when a row is claimed by `claimNextReadyAutomaticDiscoveryRequest`; selectivity is already low at claim time (only `ready` rows are eligible).

### 6.11 Download Attempt Tracking on `import_candidates`

Required for transfer failure recovery (Section 5.27). Tracks how many enqueue/transfer attempts have been made for each candidate, and records why a candidate was promoted (observability for import review).

```
20260601_120000_add_download_attempt_tracking_to_import_candidates.sql
```

```sql
-- download_attempt_count: incremented each time this candidate is selected for
--   enqueue. Caps at MAX_CANDIDATE_ATTEMPTS (3) before candidate is excluded
--   from recovery cascade.
-- selection_reason: optional label for how this candidate entered 'selected'
--   state. Values: 'manual', 'auto_scored', 'recovery_cascade'. Nullable for
--   candidates that were selected before this column existed.
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS download_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selection_reason       TEXT    NULL;
```

No index needed. `download_attempt_count` is only read in `findNextCandidateForRecovery` which already filters by `source_search_id` or `metadata_release_id`; the attempt count check is a cheap secondary filter on the small result set.

### 6.12 Tag Extraction Change-Detection Stamps on `library_files`

Required for incremental tag re-extraction (Section 5.30). Tracks the filesystem metadata (size and mtime) observed at the time of the most recent successful tag extraction, enabling the scan worker to skip unchanged files.

```
20260601_130000_add_tag_extraction_stamps_to_library_files.sql
```

```sql
-- tag_extracted_size_bytes: the file's size_bytes at the time tags were last
--   successfully extracted. NULL means the file has never been extracted.
-- tag_extracted_modified_at: the file's modified_at timestamp at the time tags
--   were last successfully extracted. NULL means never extracted.
-- These two columns are always set together in writeLibraryFileTagSnapshot
--   (inside a single BEGIN/COMMIT block), so they are always both null or both
--   non-null. Partial writes cannot occur.
ALTER TABLE library_files
  ADD COLUMN IF NOT EXISTS tag_extracted_size_bytes  BIGINT      NULL,
  ADD COLUMN IF NOT EXISTS tag_extracted_modified_at TIMESTAMPTZ NULL;
```

No index needed. Both columns are only read during the scan worker's pre-extraction filter pass; this is a per-file equality check on a small in-memory result set already materialized by `recordLibraryFiles`. Existing rows will have `NULL` for both columns until their next scan, at which point the file will be extracted and stamped. No backfill query is required.

### 6.13 Compound Index on `operation_runs (operation_type, started_at DESC)`

Required for `getActiveRun()` and `getLatestRun()` lookups (Section 5.33). Both queries filter on `operation_type` (equality) and sort by `started_at DESC LIMIT 1`. Without this index both queries perform a full sequential scan on `operation_runs`, which grows unboundedly (one row per run, never pruned). The equality-prefix + DESC-sort index structure allows the planner to resolve a `LIMIT 1` lookup in a single index page read.

```
20260601_140000_add_operation_run_type_order_index.sql
```

```sql
-- operation_runs_type_started_idx: serves getActiveRun() and getLatestRun() in
--   operation-run-store.js. Both queries filter on operation_type = $1 (equality)
--   and order by started_at DESC LIMIT 1. The (operation_type, started_at DESC)
--   composite structure lets PostgreSQL seek directly to the operation_type prefix
--   and read the first row in index order without a sort step.
--
-- A partial index WHERE status IN ('pending','running') would produce a smaller
--   index but cannot serve getLatestRun() (no status predicate). A single
--   non-partial index covers both queries with one structure.
--
-- CREATE INDEX CONCURRENTLY is not used here because the migration runner wraps
--   every migration in BEGIN/COMMIT, which is incompatible with CONCURRENTLY.
--   Migrations run at startup before traffic is served, so the ShareLock is
--   acceptable.
CREATE INDEX IF NOT EXISTS operation_runs_type_started_idx
  ON operation_runs (operation_type, started_at DESC);
```

The existing `operation_runs_running_recovery_idx` (partial `WHERE status = 'running'` ordered `started_at ASC`) is preserved — it serves the stranded-run recovery query and does not overlap with this index. No data backfill or schema change to rows is required.

---

## 7. Open Questions

### 7.1 ~~What Is the Requests Screen?~~ — Resolved

The home page IS the request screen. "My Requests" (`RequestMusicView.vue`) is a read-only status view: artwork cards of submitted requests with fulfillment state and a cancel action. No intake form. Search and requesting happen on the home page.

### 7.2 ~~Should the Discover Graph Show Artwork for Suggestions?~~ — Resolved

**Decision: Styled initial avatars for unmonitored suggestion cards; CAA release cover art for monitored artist cards.**

Three options were evaluated:

1. **Styled initial avatars** — hash-derived background color + first letter. Zero extra API calls. Instant render.
2. **CAA release cover art** — fetch the artist's first release group MBID via MusicBrainz browse, then use CAA. Adds one extra API call per suggestion card; adds latency to the already-complex similarity graph traversal.
3. **TheAudioDB artist thumbnails** (actual portrait photos, same source Lidarr uses for artist detail pages) — requires a new server-side proxy and an additional external dependency.

**Why initial avatars for suggestions:** The Discover flow surfaces unimported/unmonitored artists. At that point we have the MBID and name from ListenBrainz — we do not have their release groups cached locally. Making a follow-up MusicBrainz browse call per suggestion card adds latency and complexity that is not warranted for a transient "should I monitor this artist?" card. The Lidarr precedent is also instructive: the "add artist" search in Lidarr shows minimal visual results, not album art — full artwork only appears after the artist is added to the library.

**Why CAA for monitored cards:** Once an artist is imported and monitored (via Discover or Search), their release groups are cached in the local metadata store. `ArtistCard.vue` on the Home page and the Discover "already monitored" state can use the most recent release group's CAA URL — the same `ArtworkImage.vue` infrastructure already in place. This is the Lidarr pattern: album covers are the visual identity for artists in the grid.

**Initial avatar implementation:** A `useArtistAvatar` utility derives a stable background color from a hash of the artist MBID (not name, since names can be ambiguous) and renders the uppercased first character of the display name. CSS handles the rest: circle or square, consistent size with `ArtistCard`. Color range is constrained to mid-saturation so both dark and light text are readable against any generated background.

**TheAudioDB for artist portraits:** Deferred to the Artist Detail page (Step 18), where the full artist portrait image has a meaningful place — the hero row. At that point a server-side TheAudioDB proxy is warranted. Not for Discover suggestion cards.

### 7.3 ~~Does "Discover" Replace the Existing Search Screen?~~ — Resolved

**Decision: They coexist. Discover and Search are distinct tools with distinct intents. Both appear in the requester nav.**

The closest analogy in the *arr ecosystem is the Sonarr split between **Add Series** (you're committing to track a show long-term) and **Manual Search / Episode Search** (you want a specific episode now). No one argues that adding a series should replace episode search. The same logic applies here:

| | **Discover** | **Search** |
|---|---|---|
| Intent | Grow my monitored artist roster | Find and request specific music now |
| Input | Artist name as a seed | Artist name or release title |
| Primary output | Artist suggestions → Monitor | Release cards → Request |
| Secondary output | Monitor action on results | Monitor toggle on artist results |
| Soulseek access | No | Yes (Network mode) |
| Analogy | Sonarr: Add Series | Sonarr: Manual Search |

The shipped nav — **Home, Discover, Search, My Requests** for requesters — is correct. Discover is exploration; Search is retrieval. They are not redundant: a requester who wants to monitor new artists they've never heard of uses Discover; a requester who wants a specific Radiohead album uses Search.

The artist Monitor toggle on Search results is kept deliberately. When a requester searches for an artist to request one of their releases, it is natural to also monitor that artist at that moment. The toggle is present but is a secondary affordance — the primary action on Search is requesting a release.

### 7.4 How Does the Cold-Start CTA Work for Returning Users? ✓ Resolved

**Decision: No auto-redirect, no dismissal. Full-page `EmptyState` is the correct cold-start treatment. It disappears naturally when any artist is monitored. Shipped behavior is correct; prior spec language (auto-redirect on mount) was wrong.**

**Why monitoring-is-global changes this question:** Because monitoring is system-global (no per-user scope — see Decision 8), the requester home page is empty only when the *entire household* has zero monitored artists. This is the new-install condition, not an individual user preference state. A search-only requester in a household where anyone else has monitored artists will see those artists on their home page. The chronic "my home is always empty because I prefer Search" scenario does not exist at the data layer.

**Why auto-redirect was wrong:** An `onMounted` redirect to Discover creates a navigation trap. If the user navigates back from Discover without picking anyone, they immediately redirect again. There is no way to reach Home while the library is empty. An EmptyState with a CTA respects user intent — the button is there; they are not forced.

**Why dismissal is the wrong framing:** The empty state is not an overlay, banner, or interstitial — it is the UI for a screen with no content. Dismissing it would produce a blank page, which is worse. There is no state to persist. The empty state disappears the moment `artists.length > 0`, which is the natural resolution. A "don't show Discover suggestions" preference would suppress accurate system feedback in exchange for saving a user one ignored CTA button — not worth the complexity.

**Two complementary Discover entry points, non-overlapping:**
- `artists.length === 0` → full-page `EmptyState` with "Discover artists" CTA (shipped, correct)
- `artists.length > 0` → "Find more artists" tail card in the grid (not yet shipped per Step 2 gap)

These two states never appear simultaneously. The tail card is the persistent, low-key growth prompt for established users. The EmptyState is the prominent first-run guide. Neither needs to be dismissible.

### 7.5 ListenBrainz Coverage for Niche Genres? ✓ Resolved

**Decision: ListenBrainz + MusicBrainz relationships is complete. Last.fm is not a planned fallback. No pre-implementation coverage validation is needed.**

**Why Last.fm doesn't fix the niche coverage problem:** Both ListenBrainz and Last.fm derive similarity from listening patterns (collaborative filtering). The fundamental constraint is user listening volume — not the platform. For a 1990s Scandinavian black metal band or an obscure regional folk act, Last.fm's larger user base raises the co-listening floor slightly but does not meaningfully fill the gap. The difference between "sparse" and "slightly less sparse" is not worth the cost of a third external dependency that requires an API key.

**Why MusicBrainz editorial relationships are the right niche supplement:** MB relationships (influenced-by, collaboration, member-of, similar) are *manually curated by fan communities*, not derived from listening volume. They exist even for artists with almost no recorded online listening. Crucially, the communities that care most about niche sub-genres — metal, jazz, regional folk — are exactly the communities that meticulously maintain MusicBrainz data. MB provides structural and historical connections ("influenced by", "member of") that neither LB nor Last.fm ever derive from listening patterns.

**Why sparse results are not a failure mode:** The Discover flow renders the suggestions it has. Three cards are useful; zero is the only genuinely empty state, and even then the seed search box always provides manual exploration. The Discover screen doesn't degrade on sparse data — it surfaces what's available and lets the user continue from there.

**Why no pre-implementation validation is needed:** The merge logic (LB + MB relationships, scored and deduplicated) is designed such that coverage gaps in one source are filled by the other. We implement it, ship it, and observe. If a use-case arises where both sources return nothing meaningful, we address it then. Speculative validation before implementation adds delay without changing the architecture.

**Last.fm as a future user-configured option:** If a user is a heavy Last.fm listener and wants Last.fm similarity data incorporated, that is a settings-level enhancement — operator provides API key, Last.fm results are merged in at the same scoring layer. This is not part of the core implementation plan.

### 7.6 Release Radar — How Far Back Is "Recent"? ✓ Resolved

**Decision: 30 days, measured from `first_release_date` (not from `monitoring_started_at`). Missing screen owns everything older. No configurable window.**

**The Radar and Missing are not redundant — they answer different questions.** Missing answers: "everything from artists I care about that I don't own yet, regardless of age." Radar answers: "what's new and worth my attention right now?" A release that dropped 45 days ago is not news; surfacing it in a strip labeled "New Releases" undermines the signal. Extending the window to 90 days to catch edge cases would dilute the Radar with old releases and make it indistinguishable from Missing.

**The "late monitor" case is handled correctly by the existing two-screen model.** A user who starts monitoring an artist 45 days after a release drops will see that release immediately in Missing and on the artist's detail page (Step 18). The Radar doesn't need to be the catch-all discovery surface. The combination of Missing + Radar + Artist Detail gives complete coverage without any one screen overreaching.

**The window is measured from `first_release_date`, not `monitoring_started_at`.** This is the meaningful refinement the spec was missing. If you start monitoring an artist today and their album came out 20 days ago, it appears in Radar — it's still new. If it came out 45 days ago, it goes to Missing — it's no longer news. The job query filter is: `first_release_date >= CURRENT_DATE - INTERVAL '30 days'` across all currently monitored artists, regardless of when monitoring started.

**`monitored_release_group_types` is the natural singles filter.** The monitoring record already stores which release group types the user cares about per artist (default `['album', 'ep']`). Singles appear in the Radar only for artists where the user has explicitly opted into single monitoring. This prevents prolific artists from flooding the strip with weekly single drops while still surfacing singles for users who want them.

### 7.7 Activity Feed — What Is the Right Scope for Requesters? ✓ Resolved

**Decision: Full shared feed with complete attribution by default. No per-user privacy setting. Delivery surface differs by role — operators get a full-page Activity view; requesters get a compact inline panel on their home page.**

**Why full attribution is correct:** The social signal is the point. "Alex just requested Funeral by Arcade Fire" makes the app feel like a shared household space. Hiding attribution reduces the feed to a noticeboard — present but inert. Overseerr, the closest comparable product, shows all users' requests with full attribution by default, and it's the right call there too. In a household context of 2–6 people who know each other and share infrastructure, there is no meaningful privacy concern around shared listening activity.

**Why per-user privacy controls are not warranted:** The "gift-buying" edge case (don't want partner to see you requested their birthday album) is real but rare, and it has a simpler solution: the operator submits the request on behalf of themselves rather than the partner (Decision 8), or uses a different account. Building a user-aware server-side feed filter, a privacy toggle in settings, and UI to communicate redacted vs. visible events adds meaningful complexity for a case with a working workaround.

**The scope difference between roles is about delivery surface, not content visibility.** Operators have Activity as a dedicated full-page nav item — the management-oriented view of the event stream. Requesters don't have that nav item. They receive the same event data as a compact "Recent Activity" panel inline on the requester home page, showing the last 10 household events. Same content; different surface and depth.

**Event type scope (same for all users):**

| Event | Visible to all users | Notes |
|---|---|---|
| `request_created` | Yes, with attribution | "Alex requested OK Computer" |
| `download_completed` | Yes | System event — relevant to anyone whose request may be in queue |
| `release_added` | Yes | Shared library event |
| `artist_monitored` | Yes | System-global state change |
| `request_fulfilled` | Yes | "Your request for [album] is ready" for the requester; shown as "[album] added to library" for others |

### 7.8 Download Result Scoring — Where Does Uploader Reputation Come From? ✓ Resolved

**Decision: Ship a full pluggable scorer pipeline using all signals already in the data model — no new schema required. Seven weighted scorers: format tier, audio depth, track count, duration-sum match, format consistency, peer delivery, and uploader reputation. Operator-configurable weights via Settings.**

**The data model is richer than the original question assumed.** Three categories of already-persisted data were being ignored:

1. **Per-file audio metadata** (`import_candidate_files`): `bitDepth`, `sampleRateHz`, `lengthSeconds` — sufficient to distinguish 24-bit/96kHz lossless from 16-bit/44.1kHz and to do duration-sum matching against MusicBrainz album length (a stronger identity signal than track count for live albums and compilations).
2. **Peer delivery signals** (`normalizedPayload`): `hasFreeUploadSlot`, `queueLength`, `uploadSpeed` — persisted at ingest. The best FLAC behind 500 queued transfers with no upload slot is a worse pick than a slightly lower-quality candidate that will actually start downloading.
3. **Format consistency** (`normalizedPayload.extensions`): A folder mixing `.flac` and `.mp3` is a red flag regardless of per-file bitrate.

**Why a pluggable pipeline, not a monolithic function:** Each scorer has different availability, precision, and household priority. `createCandidateScoringService({ scorers, weights })` makes each signal injectable, independently testable, and weight-configurable without code changes — the same design as Sonarr/Radarr custom format scoring. Operator-set weights are stored in settings and injected at runtime. See section 5.12 for the full scorer table and architecture code sketch.

**Uploader reputation:** Derived from `import_candidates` aggregated by `username` — no new table. 5-sample minimum floor before the score activates; below the floor the scorer returns 50 (neutral) to avoid penalizing unknowns. Automates what the Soularr community does manually via `ignored_users` blocklist.

**Upgrade-aware format boost:** If the library already holds a lower-quality version of this release, the format scorer adds +15 to candidates that would represent a quality upgrade. Requires `currentLibraryQuality` in `referenceData` at scoring time.

### 7.9 PWA Push — Which Events Send Notifications? ✓ Resolved

**Decision: Three event types in scope with different defaults and role gates. Async notification dispatch queue for reliability. Coalescing window to prevent floods. Per-event TTL so offline devices still receive. Foreground suppression via service worker client check. Soft-delete subscription expiry with client recovery path. `useNotificationPermission()` composable covering all browser permission states. Contextual permission request in `ConfirmRequestModal`.**

---

**Event matrix:**

| Event | Default | Who | TTL | Rationale |
|---|---|---|---|---|
| `request_fulfilled` | **ON** | All users | 86400s (24h) | The entire value proposition. "OK Computer is ready." High value, infrequent, personal. Not configurable off — if push is enabled at all, this fires. |
| `new_release_from_monitored_artist` | **OFF** | All users | 259200s (72h) | High-value pull-back for users who don't open proactively. Off by default — 30+ monitored artists could produce several per week from prolific artists. Frequency is naturally gated by `monitored_release_group_types`. Coalesced: 5 simultaneous releases → one "5 new releases from artists you follow" notification. |
| `download_completed` | **OFF** | Operators only | 3600s (1h) | Operators monitoring the queue. Requesters must not receive this — a download completing is not the same as the release being in their library (import still runs). `request_fulfilled` is the correct terminal event for requesters. Stale quickly; 1h TTL. |
| `artist_monitored` | Never | — | — | Activity feed content only. Household ambient state does not belong on lock screens. |

**Why `request_fulfilled` is not configurable off:** The premise of opting into push is "tell me when my request is ready." Disabling that event while keeping push active would leave users with a notification system that delivers nothing of personal relevance. If a user wants no push, the correct action is to revoke the browser permission.

---

**Architectural decision: Async notification dispatch queue (no inline delivery)**

Calling `webpush.sendNotification()` inline on the event path is fragile. A transient push service outage silently drops the notification with no retry. The event handler blocks on outbound network I/O. Fifty simultaneous request fulfillments hit 50×N subscription rows concurrently. The solution is a `notification_queue` table:

```
notification_queue: id, user_id, subscription_id, event_type, coalesce_key,
                    payload (JSONB), ttl_seconds, status (pending|sent|failed|expired),
                    attempts, next_attempt_at, sent_at, created_at
```

A background worker (same heartbeat pattern as library discovery) polls for `pending` rows where `next_attempt_at <= NOW()`. On `webpush.sendNotification()` failure:
- **HTTP 410/412**: mark `expired`, soft-delete the subscription (see below). Do not retry.
- **5xx / network error**: exponential backoff — retry after `2^attempts × 30s`, cap at 3 attempts then mark `failed`.
- **Success**: mark `sent`, record `sent_at`.

This is a significant refactoring: every event emitter changes from direct `webpush.sendNotification()` to a `enqueueNotification({ userId, eventType, payload, coalesceKey })` call. The payoff: delivery is decoupled from event processing, retries are automatic, and the queue is inspectable.

---

**Coalescing window to prevent notification floods**

Before inserting into `notification_queue`, check for an unprocessed row with the same `(user_id, event_type, coalesce_key_group)` where `created_at >= NOW() - INTERVAL '2 minutes'`. If found, update its payload to the merged form rather than inserting a second row. Coalesce key groups:
- `request_fulfilled`: per-request (no coalescing — each request fulfillment is personally distinct)
- `new_release_from_monitored_artist`: household-batch — all releases within the 2-minute window merge into "N new releases from artists you follow"
- `download_completed`: per-release (no coalescing — each download is an operator work item)

---

**Structured `tag` for OS-level deduplication across devices**

The push payload includes a `tag` field: `${eventType}:${entityId}`. For `request_fulfilled`, `entityId` is the `media_request_id`. This means:
- If the push service delivers to three devices and the user sees it on their phone first, the same notification on desktop replaces rather than duplicates it in the notification tray.
- `renotify: false` — don't re-alert if the tag is already visible.

---

**Foreground suppression — no duplicate OS notifications while the app is open**

The service worker `push` event handler must not call `showNotification()` unconditionally. Before showing, check for an open focused client:

```js
// sw.js
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: false }).then(clients => {
      const focused = clients.find(c => c.focused);
      if (focused) {
        // App is open — post to client for in-app toast instead
        focused.postMessage({ type: 'push-notification', data });
      } else {
        return self.registration.showNotification(data.title, {
          body: data.body, icon: data.icon, badge: data.badge,
          tag: data.tag, renotify: false,
          data: data.data, actions: data.actions,
        });
      }
    })
  );
});
```

The Vue app listens on `navigator.serviceWorker.addEventListener('message', ...)` and routes to the existing toast/notification system. This is the same pattern used by PWAs such as Twitter Lite and Spotify Web.

---

**`notificationclick` deep-link handler**

Without this, clicking a push notification opens the PWA at `start_url` (`/app`), not the relevant screen:

```js
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: false }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(targetUrl));
      return self.clients.openWindow(targetUrl);
    })
  );
});
```

This reuses an open window if one exists (focus + navigate) rather than opening a duplicate tab. `data.url` targets:
- `request_fulfilled` → `/app/my-requests`
- `new_release_from_monitored_artist` → `/app/release-radar`
- `download_completed` → `/app/activity/operations`

---

**Soft-delete subscription expiry + client recovery path**

Hard-deleting the subscription row on 410 is insufficient. The user's Settings → Notifications page still shows "Notifications: On" — their subscription silently vanished without their knowledge. The next event silently delivers nothing.

Add `invalidated_at TIMESTAMPTZ` to `user_push_subscriptions`. On 410/412, set `invalidated_at = NOW()` rather than deleting. `GET /api/v1/users/me/push-subscriptions` returns `{ active: boolean, invalidatedAt: string|null }`. If `invalidatedAt` is set, Settings → Notifications shows:

> *Your notification subscription has expired (device re-enrolled or browser data cleared). [Re-enable notifications]*

The re-enable CTA calls `PushManager.subscribe()` again and posts the new endpoint to the server, inserting a fresh row. The old invalidated row is archived for audit and pruned after 30 days.

---

**`useNotificationPermission()` composable — full permission state machine**

A single composable covers all states the browser can be in. Every surface that interacts with push consumes this rather than calling `Notification.permission` directly:

```
states: unknown | granted+subscribed | granted+expired | granted+unsubscribed
       | denied | unsupported | ios-needs-standalone
```

- `unknown`: show contextual offer (in `ConfirmRequestModal` post-confirm banner)
- `granted+subscribed`: subscription active, management UI only
- `granted+expired`: show "re-enable" CTA (subscription was invalidated)
- `granted+unsubscribed`: granted but no subscription registered — auto-resubscribe silently on next app load
- `denied`: show "Blocked in your browser. Open Site Settings → Notifications to re-enable." — a broken "Enable" button is worse than no button
- `unsupported`: `'PushManager' in window === false` — hide notification UI entirely
- `ios-needs-standalone`: iOS + Safari + not `window.matchMedia('(display-mode: standalone)').matches` — show "Add to Home Screen to enable notifications" with illustrated instructions

The composable is the authority on permission state. `ConfirmRequestModal`, Settings → Notifications, and any future notification surface import it.

---

**Permission request timing — contextual, not cold-start**

The browser permission prompt appears immediately after the user confirms a request in `ConfirmRequestModal`. Before the modal closes, an inline callout renders: *"Get notified when it's ready. [Enable notifications]"* — one button, dismissible. This is the highest-conviction timing: the user has just declared they care whether this completes. The callout only appears when `permissionState === 'unknown'`. Settings → Notifications is the management surface, not the acquisition surface.

---

**Future-proofed notification preferences schema**

Store `notification_settings` as a nested object from day one so per-artist toggles can be added without a schema migration:

```json
{
  "request_fulfilled": { "enabled": true },
  "new_release": { "enabled": false, "except_artist_mbids": [] },
  "download_completed": { "enabled": false }
}
```

Per-artist exclusions in v2: set `except_artist_mbids: ["...mbid..."]` to suppress `new_release` for specific artists without disabling the feature globally. Additive JSON, no migration.

---

**iOS Safari limitation**

Web Push on iOS requires standalone mode. iOS Safari browser cannot receive push notifications — `PushManager.subscribe()` throws or the subscription silently fails. The `useNotificationPermission()` composable detects this state and surfaces "Add to Home Screen" illustrated guidance rather than a broken permission flow. Do not attempt to call `requestPermission()` in this state.

### 7.10 Artist Detail — What Is the Right URL Shape for Non-MusicBrainz Artists? ✓ Resolved

**Decision: MBID is the canonical URL key. Route is `/app/artists/:mbid` with UUID regex constraint. Integer `id` is internal only. Artists without an MBID render a degraded local page via a separately ordered route. MB entity merges are handled by the metadata refresh job updating the stored MBID. Discography acquisition states are returned by a new aggregate server endpoint. Route state pre-seeding eliminates hero flash on navigation. `useArtistDetail` composable manages three independent async sections.**

---

**Why MBID, not integer `id`:**

The integer PK is a database implementation detail — it changes on a fresh install. MBIDs are permanent and are the key for every external call the view makes (similarity route, bio, CAA artwork). Using integer IDs as route params forces an extra lookup hop before every external call. MBIDs are 36-character UUIDs permanently assigned per MB spec; when entities are merged MB redirects the old MBID to the new one, so stored MBIDs remain valid.

**Why not slug:**

Slugs require collision handling, a rename-redirect history table, and non-ASCII normalization logic. For a private household app where no user types URLs manually, this overhead has no payoff. Slug aliases can be added post-v1 as a redirect layer without changing the MBID-canonical URL shape.

---

**Vue Router route ordering — UUID constraint prevents conflict:**

A naive `artists/:mbid` followed by `artists/local/:id` is a conflict: Vue Router matches `artists/local` as `{ mbid: 'local' }` because `:mbid` has no type constraint. The solution is a regex constraint that rejects anything that isn't a valid UUID:

```js
// router.js — order matters: local route FIRST, then constrained MBID route
{ path: 'artists/local/:id(\\d+)',   name: 'artist-detail-local', component: ArtistDetailView },
{ path: 'artists/:mbid([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
  name: 'artist-detail', component: ArtistDetailView },
```

The regex constraint on `:mbid` means any non-UUID segment (e.g. `local`, `garbage`, `42`) falls through to a 404 rather than mounting the component with bad input. The `local` route uses `\d+` to accept only integer IDs.

Both routes render the same `ArtistDetailView.vue`. The component infers mode from which param is present: `route.params.mbid` → full mode; `route.params.id` → local mode.

---

**Server route — use the existing MBID lookup endpoint:**

The existing route is `GET /api/v1/metadata/musicbrainz/artists/:artistId/local` — not `/api/v1/metadata/artists/:mbid`. The spec must use the actual codebase route. This endpoint returns `{ artist, aliases, monitoring, releaseGroups, releases }` but does **not** return per-release-group acquisition states. A new endpoint is needed:

```
GET /api/v1/metadata/musicbrainz/artists/:mbid/discography
```

Returns `{ releaseGroups: [{ ...releaseGroupFields, acquisitionState }] }` where `acquisitionState` is pre-computed server-side from a single SQL query joining:
- `metadata_release_groups` (core data)
- `library_wanted_releases.wanted_status` → `missing` / `coming_soon`
- `media_requests` with status `pending|active|downloading` → `requested`
- `library_file_matches` / completed import state → `owned`

Priority when multiple states apply: `owned` > `requested` > `missing` > `coming_soon` > `unmonitored`. The client renders exactly the returned `acquisitionState` string — no client-side join logic.

---

**MusicBrainz MBID merge handling:**

MB officially states: *"When an entity is merged into another, its MBIDs redirect to the other entity."* This means a MBID stored in `metadata_artists.musicbrainz_artist_id` can become stale if MB later merges that artist into a different entity (the new canonical MBID differs from the stored one).

The metadata refresh job already calls the MB API for monitored artists. After the refresh call, compare the MBID returned in the response with the stored `musicbrainz_artist_id`. If they differ:
1. Update `metadata_artists.musicbrainz_artist_id` to the new canonical MBID
2. Log a `mbid_redirect` event for observability
3. Any bookmarked URL with the old MBID will 404 on the next visit — the component's 404 handler shows "Artist not found. It may have been merged in MusicBrainz." with a search link to recover. This is the correct user-facing outcome: the bookmark is stale, not the app.

---

**Route state pre-seeding — instant hero render:**

When `ArtistCard` navigates to `artist-detail`, it already has `{ name, sortName, musicbrainzArtistId }` from the monitored artist list. Pass this as Vue Router `state`:

```js
router.push({
  name: 'artist-detail',
  params: { mbid: artist.musicbrainzArtistId },
  state: { artistName: artist.name, artistSortName: artist.sortName },
});
```

`ArtistDetailView` reads `history.state.artistName` and displays the name in the hero row immediately on mount, before any API call resolves. The skeleton hero shows the name; artwork and bio fill in asynchronously. No blank hero flash.

---

**`useArtistDetail(mbid)` composable — three independent async sections:**

The view's data comes from three independent sources that should load in parallel and fail independently:

```js
// useArtistDetail.js
export function useArtistDetail(mbid) {
  // Section 1: core artist + monitoring state (fast, local DB)
  const { data: artist, loading: artistLoading, error: artistError }
    = useFetch(() => `/api/v1/metadata/musicbrainz/artists/${mbid}/local`);

  // Section 2: discography with acquisition states (fast, local DB)
  const { data: discography, loading: discographyLoading, error: discographyError }
    = useFetch(() => `/api/v1/metadata/musicbrainz/artists/${mbid}/discography`);

  // Section 3: similar artists (slower — may call LB/MB externally)
  const { data: similar, loading: similarLoading, error: similarError }
    = useFetch(() => `/api/v1/metadata/artists/${mbid}/similar`);

  return { artist, artistLoading, artistError,
           discography, discographyLoading, discographyError,
           similar, similarLoading, similarError };
}
```

Sections 1 and 2 fail together if the artist 404s (both are local DB calls with the same MBID key). Section 3 failing does not affect sections 1/2 — the related artists strip simply stays hidden. This is the correct isolation: a slow or unavailable similarity service never blocks the discography from rendering.

**Loading skeleton:** The hero row renders immediately from route state (name). The discography section shows card-shaped skeleton tiles while `discographyLoading` is true. The similar artists strip shows a spinner only while `similarLoading` is true.

---

**Local→MBID upgrade path mechanism:**

When the user visits `/app/artists/local/:id`, the component calls `GET /api/v1/metadata/artists/local/:id`. The server looks up by integer `id` and returns `{ artist: { id, name, musicbrainzArtistId, ... } }`. If `musicbrainzArtistId` is now populated (the metadata job enriched it since the local route was bookmarked), the component replaces the current history entry:

```js
if (route.params.id && artist.value?.musicbrainzArtistId) {
  router.replace({ name: 'artist-detail', params: { mbid: artist.value.musicbrainzArtistId } });
}
```

This happens before the page fully renders. The URL silently upgrades from `/app/artists/local/42` to `/app/artists/3e3405e8-...` with no user-visible flash. No server-side redirect needed — the client handles it after receiving the artist data.

---

**ArtistCard navigation:**

- `musicbrainzArtistId` present → `{ name: 'artist-detail', params: { mbid }, state: { artistName, artistSortName } }`
- absent → `{ name: 'artist-detail-local', params: { id } }`

The card name is always a link — never a dead non-interactive label.

---

**"Open in MusicBrainz" link:**

`https://musicbrainz.org/artist/:mbid` on the hero row (full mode only). Zero cost. Invaluable for power users correcting metadata errors.

---

**Slug aliases — deferred, additive:**

A `slug` column derived from `sort_name` at ingest, with collision suffix on disambiguation. Route `/app/artists/:slug` resolves slug → MBID → client-redirect to canonical. One migration, zero breaking changes. Post-v1.

### 7.11 Release Detail Modal — Where Does Tracklist Data Come From? ✓ Resolved + Strengthened

**Decision: Tracklist data is stored locally — no live MusicBrainz call for imported release groups. Canonical selection is persisted as a DB column (`is_canonical`) set by the import/refresh job, not re-computed per request. A single unified endpoint handles both initial modal load and edition switching with an identical response shape, including request state and lazily-computed per-track ownership. MB fallback triggers an opportunistic background import. User-overrideable canonical preference via "Set as Default Edition".**

---

**The tentative's premise is wrong — tracklist data is already in the local DB:**

The schema has `metadata_tracks`, `metadata_media`, and `metadata_recordings` tables. `listMetadataTracksByReleaseId()` exists in `metadata-repository.js` and joins tracks + recordings. `buildReleasePayload()` in `metadata-read-service.js` already fetches media + tracks in `Promise.all`. The existing `GET /api/v1/metadata/releases/:releaseId` returns `{ media: [{ ...medium, tracks: [...] }] }` with full disc/track structure. There is **no** MusicBrainz call involved in this path for imported release groups.

The actual open questions are:
1. How does the modal go from a **release group MBID** (what the card knows) to a specific **release** with its tracklist?
2. Which **edition** to show when a release group has multiple releases?
3. Should the tracklist show **per-track owned indicators** (which tracks the user already has)?
4. What happens for **release groups not yet imported** (found via Discover/Search but not yet monitored)?

---

**Architectural gaps in the first-pass design (all six addressed below):**

1. **Canonical selection re-ran every modal open** — the algorithm operated on unindexed `metadata_releases` columns at request time with no result persistence. Repeated for every open.
2. **Edition switching silently dropped `isOwned` indicators** — the first-pass switcher fired `GET /api/v1/metadata/releases/:releaseId` (existing endpoint, different response shape). Per-track owned state was lost on any edition switch.
3. **Request state required a second fetch** — the action row (Request/Cancel/badge) couldn't render until a separate API call resolved, creating a visible pop-in.
4. **`isOwned` join ran unconditionally** — `library_release_reconciliations` already pre-computes `matched_track_count` per release. For releases with zero matched tracks, the per-track `library_file_matches` join was pure waste.
5. **MB fallback had no caching trigger** — every modal open for an unimported release group hit MusicBrainz live with no side-effect.
6. **No user-overrideable canonical** — the algorithm picks UK original; user always wants Deluxe. No "Set as Default Edition" persistence.

---

**Gap 1 — Persist canonical selection as a DB column:**

Add `is_canonical BOOLEAN NOT NULL DEFAULT FALSE` to `metadata_releases` with a partial unique index enforcing at most one canonical per release group:

```sql
ALTER TABLE metadata_releases ADD COLUMN is_canonical BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX metadata_releases_canonical_per_group_idx
  ON metadata_releases (metadata_release_group_id)
  WHERE is_canonical = TRUE;
```

The import/refresh job calls a new `markCanonicalRelease(releaseGroupId)` function after upserting releases. This function runs the selection algorithm once and does:

```sql
UPDATE metadata_releases SET is_canonical = FALSE
  WHERE metadata_release_group_id = $1 AND is_canonical = TRUE;

UPDATE metadata_releases SET is_canonical = TRUE
  WHERE id = $2;
```

The modal endpoint now does `WHERE is_canonical = TRUE` — a direct indexed lookup. No algorithm at request time.

**Canonical selection algorithm** (runs in `markCanonicalRelease`, not in the endpoint):
1. `status = 'Official'` — exclude Bootleg, Promotion, Pseudo-Release
2. Exclude `track_count > 1.5 × median_track_count` among official releases (filters most Deluxe Editions)
3. Prefer earliest `release_date`
4. If tied: `country = 'XW'` (worldwide digital) > `'GB'` > `'US'` > others
5. If still tied: lowest `created_at`

Deterministic and re-runnable. Called on import, on monitored artist refresh, and when the user explicitly overrides (Gap 6 below).

---

**Gap 2 — Unified endpoint for both initial load and edition switching:**

Single endpoint: `GET /api/v1/metadata/musicbrainz/release-groups/:rgMbid/tracklist`

Query parameters:
- `?preferReleaseId=<localUUID>` — select a specific local release by ID (edition switcher)
- `?preferReleaseMbid=<mbUUID>` — select by MB UUID (for callers like Artist Detail that know the specific release MBID)
- Neither present: serve the `is_canonical = TRUE` release

The response shape is **always identical** regardless of which edition is active:

```json
{
  "release": {
    "id": "<uuid>", "title": "OK Computer", "releaseDate": "1997-05-21",
    "country": "GB", "status": "Official", "trackCount": 12, "mediumCount": 1,
    "barcode": "724384532024", "disambiguation": "",
    "isCanonical": true, "isUserCanonical": false
  },
  "media": [
    {
      "position": 1, "title": null, "format": "CD", "trackCount": 12,
      "tracks": [
        {
          "position": 1, "numberText": "1", "title": "Airbag",
          "lengthMs": 284000, "artistCredit": null,
          "recordingMbid": "3afb6d2f-...", "isOwned": true
        }
      ]
    }
  ],
  "ownership": {
    "matchedTrackCount": 10, "expectedTrackCount": 12,
    "reconciliationStatus": "partial"
  },
  "allReleases": [
    { "id": "<uuid>", "title": "OK Computer", "releaseDate": "1997-05-21",
      "country": "GB", "trackCount": 12, "disambiguation": "",
      "isCanonical": true, "isUserCanonical": false },
    { "id": "<uuid>", "title": "OK Computer", "releaseDate": "1997-05-21",
      "country": "JP", "trackCount": 13, "disambiguation": "Japanese edition",
      "isCanonical": false, "isUserCanonical": false }
  ],
  "requestState": {
    "status": "pending", "requestId": "<uuid>", "requestedAt": "2026-05-01T..."
  },
  "source": "local"
}
```

`requestState` is `null` if no request exists for this release group from the current user. Edition switching POSTs to the same endpoint with `?preferReleaseId=` — full response shape returned including `isOwned`, `ownership`, and `requestState`. No shape mismatch possible between initial load and edition switch.

---

**Gap 3 — Request state included in the single response:**

The endpoint is a session-authenticated route — `session.appUserId` is available. The service layer queries:

```sql
SELECT id, status, created_at
FROM media_requests
WHERE app_user_id = $1
  AND matched_metadata_release_group_id = $2
  AND status NOT IN ('cancelled', 'rejected')
ORDER BY created_at DESC
LIMIT 1
```

Result is mapped to `requestState` in the response. The action row (Request/Cancel/badge) renders synchronously on modal open — no second fetch, no pop-in. The composable `useReleaseDetail` manages one `loading` state for the whole modal, not separate states per section.

---

**Gap 4 — Lazy per-track `isOwned` join using pre-computed ownership summary:**

`library_release_reconciliations` already stores `matched_track_count` and `expected_track_count` per release (pre-computed by the reconciliation job). The endpoint reads this first:

```sql
SELECT matched_track_count, expected_track_count, reconciliation_status
FROM library_release_reconciliations
WHERE metadata_release_id = $1
```

- If `matched_track_count = 0` or row is absent: all `isOwned = false`, skip `library_file_matches` join entirely. Fast path for unowned releases.
- If `matched_track_count > 0`: run the `library_file_matches` join to set per-track `isOwned`. This join only runs when there is something to show.

The `ownership` object in the response surface the pre-computed summary directly. The "You own N of M tracks" callout reads from `ownership`, not from summing the track-level flags.

---

**Gap 5 — Opportunistic metadata import on MB fallback:**

When the release group is not in the local DB (`source: "musicbrainz"`), the endpoint:
1. Calls `getMusicBrainzReleaseGroupReleases()` and constructs the response from MB data
2. Before returning, calls `enqueueMetadataImport({ releaseGroupMbid })` — a fire-and-forget that schedules `importMusicBrainzReleaseGroup` via the existing import queue (metadata only, no Soulseek download)
3. Returns the MB response immediately — does not wait for the import

Next modal open for the same release group uses local data with full `isOwned` support. The transition is transparent to the user. `source: "musicbrainz"` appears at most once per release group per user lifetime.

The import is not re-enqueued if a local record already exists — the fallback branch only fires when the `musicbrainz_release_group_id` lookup returns null.

---

**Gap 6 — User-overrideable canonical preference:**

The edition switcher adds a "Set as Default" action per non-canonical pill:

```
[OK Computer (1997, GB) ●]  [Japanese Ed. (1997, JP) ···]  [Deluxe (2009, XW) ···]
```

The `···` button (or long-press on mobile) on any non-canonical edition reveals: **"Set as default edition for this album"**.

New endpoint: `PATCH /api/v1/metadata/releases/:releaseId/canonical`

Server calls `markCanonicalRelease(releaseGroupId)` but with the user's chosen release pre-selected, bypassing the algorithm. Sets `is_canonical = TRUE` on the chosen release, `FALSE` on the previous canonical. The `isUserCanonical` flag in the response distinguishes algorithm-canonical from user-canonical (future: per-user preference table; v1: global to the instance).

The response from the PATCH is the full updated `allReleases` array. The edition switcher reflects the new canonical without a modal re-open.

---

**Multi-disc handling:**

The `media` array is already structured as disc → tracks. Single-disc releases suppress the "Disc 1" header. Multi-disc: each medium becomes a labelled section (`"Disc 1"` / `"Disc 2"` or the medium `title` if present, e.g. `"Live at Glastonbury"`). Track position resets per disc. Per-disc total duration shown for multi-disc releases.

---

**Hero instant render from card props:**

Props `releaseGroupMbid`, `releaseTitle`, `artistName`, `releaseYear`, `artworkUrl` are available at click time. Modal opens immediately with a fully-formed hero. The tracklist, ownership summary, and action row show skeleton rows while the single unified endpoint call resolves. For local DB responses (< 100ms on a hosted instance), the skeleton is barely perceptible.

---

**Significant refactoring callout:**

- **New migration**: `is_canonical BOOLEAN` on `metadata_releases`, partial unique index, and `PATCH /releases/:id/canonical` endpoint
- **Import/refresh job updated**: `markCanonicalRelease(releaseGroupId)` called after all releases are upserted. Without this the modal always falls through to the old algorithm
- **`buildReleaseTracklistPayload()`** — new function in `metadata-read-service.js` replacing `buildReleasePayload()` for the modal use case. Adds lazy-`isOwned` logic (check reconciliation first), `allReleases`, `ownership` summary, and `requestState`
- **Unified tracklist endpoint** replaces both `canonical-tracklist` (from the initial design) and edition-switching calls to `releases/:id`. The old `releases/:id` endpoint is kept for other consumers but the modal never uses it directly
- **`enqueueMetadataImport()`** — new lightweight wrapper around the existing `importMusicBrainzReleaseGroup` entry point, callable from the read path without blocking the response

### 7.12 Library View — What Defines "Owned"? ✓ Resolved + Strengthened

**Decision: "Owned" means any release with a `library_release_reconciliations` row. The Library view is the sole surface for `partial` releases — the Missing screen is restricted to `missing`-only (zero files). Format filter is feasible via `audio_codec` pre-aggregated into a `codec_summary JSONB` column on the reconciliation row. Artist grouping artwork uses a `LATERAL` subquery — no N+1. `first_matched_at` backfill uses a batched `UPDATE` with `WHERE first_matched_at IS NULL LIMIT 500`. "Needs Attention" is a structured summary section with per-type CTAs. Duplicate badge deep-links to `/app/activity/operations?releaseGroupId=<id>`.**

---

**Architectural gaps in the first-pass design (all six addressed below):**

1. **Partial state overlap between Library and Missing screens** — `library_wanted_releases` has `wanted_status = 'partial'` AND `library_release_reconciliations` has `reconciliation_status = 'partial'` for the same release simultaneously. The first-pass showed partial in both views, creating two competing action surfaces.
2. **Format filter dropped without resolution** — `library_files.audio_codec TEXT NULL` exists. The tentative mentioned format filter; the first-pass silently dropped it with no JOIN path specified.
3. **Artist grouping artwork requires N+1** — the aggregation query returned no artwork; "most recently acquired complete release's artwork" requires a second per-artist query.
4. **`first_matched_at` backfill is a table-lock risk** — raw `UPDATE ... SET first_matched_at = (SELECT MIN(...))` against a large `library_release_reconciliations` table is unsafe for running installs.
5. **"Needs Attention" is a vague banner** — partial and duplicate releases have different actions; one banner cannot serve both.
6. **`duplicate` deep-link points to unfiltered Operations** — no route filter param specified; clicking the badge dumps users into a full unrelated feed.

---

**Gap 1 — Resolve the partial state machine: Library owns partial, Missing is missing-only:**

`library_wanted_releases.wanted_status` has two values: `'missing'` (zero files) and `'partial'` (some files matched, still needs more). `library_release_reconciliations.reconciliation_status` has `'complete'`, `'partial'`, `'duplicate'`. For a release being actively acquired, both tables can have rows simultaneously:

| In `library_wanted_releases` | In `library_release_reconciliations` | Meaning |
|---|---|---|
| `missing` | absent | No files at all, system is searching |
| `partial` | `partial` | Some files arrived, system still searching for the rest |
| absent | `complete` | Fully owned, no longer wanted |
| absent | `duplicate` | Fully owned with redundant copies |

The **Missing screen** (`/app/missing`) must show ONLY releases with `wanted_status = 'missing'`. `partial`-status releases are NOT shown on Missing — they have at least some files and belong to Library.

The **Library view** (`/app/library`) shows ALL releases with a reconciliation row: `complete`, `partial`, `duplicate`.

This requires updating `GET /api/v1/library/wanted-releases` to default `wantedStatus = 'missing'` and explicitly document that `?status=partial` is not shown in the Missing screen UI (though the endpoint supports it for debugging). The current route handler already accepts `wantedStatus === 'partial'` as a valid filter — no code change needed, just screen-level default.

The Library view's `partial` cards show both: **"Play what you have"** and **"Request the rest"** as co-equal actions, since the user already owns some of the release and can interact with it.

---

**Gap 2 — Format filter via pre-aggregated `codec_summary` on the reconciliation row:**

Joining `library_release_reconciliations → library_file_matches → library_files.audio_codec` inline on every Library view query is too expensive for large libraries. Instead, the reconciliation job pre-aggregates codec distribution into a new column:

```sql
ALTER TABLE library_release_reconciliations
  ADD COLUMN codec_summary JSONB NULL;
-- Example stored value: {"flac": 10, "mp3": 2}
```

During reconciliation, after matching files, the job computes:
```sql
SELECT audio_codec, COUNT(*) AS cnt
FROM library_file_matches
JOIN library_files ON library_files.id = library_file_matches.library_file_id
WHERE library_file_matches.metadata_release_id = $1
  AND library_file_matches.match_status = 'matched'
GROUP BY audio_codec
```
And stores the result as `codec_summary`. Updated on every reconciliation run (not insert-only like `first_matched_at`).

The aggregation query for `GET /api/v1/library/owned-releases` aggregates per release group:
```sql
jsonb_object_agg_strict(codec_key, codec_count) -- simplified
```
Returning `codecs: { "flac": 22, "mp3": 2 }` per release group. The format filter param `?format=flac` applies a `WHERE (codec_summary->'flac')::int > 0` condition.

This pre-aggregation means the format filter is zero-cost at query time.

---

**Gap 3 — Artist grouping artwork via `LATERAL` subquery — no N+1:**

Artwork for each artist card ("most recently acquired complete release's artwork") is resolved in the same query using a `LATERAL` subquery:

```sql
SELECT
  ma.id AS artist_id,
  ma.name AS artist_name,
  ma.sort_name AS artist_sort_name,
  artist_stats.album_count,
  artist_stats.partial_count,
  artist_stats.duplicate_count,
  artist_stats.first_matched_at,
  latest_art.release_group_id AS art_source_release_group_id
FROM metadata_artists ma
JOIN LATERAL (
  SELECT
    COUNT(DISTINCT mrg.id) AS album_count,
    COUNT(*) FILTER (WHERE lrr.reconciliation_status = 'partial') AS partial_count,
    COUNT(*) FILTER (WHERE lrr.reconciliation_status = 'duplicate') AS duplicate_count,
    MIN(lrr.first_matched_at) AS first_matched_at
  FROM library_release_reconciliations lrr
  JOIN metadata_releases mr ON mr.id = lrr.metadata_release_id
  JOIN metadata_release_groups mrg ON mrg.id = mr.metadata_release_group_id
  WHERE mrg.metadata_artist_id = ma.id
) artist_stats ON TRUE
JOIN LATERAL (
  SELECT mrg.id AS release_group_id
  FROM library_release_reconciliations lrr
  JOIN metadata_releases mr ON mr.id = lrr.metadata_release_id
  JOIN metadata_release_groups mrg ON mrg.id = mr.metadata_release_group_id
  WHERE mrg.metadata_artist_id = ma.id
    AND lrr.reconciliation_status = 'complete'
  ORDER BY lrr.first_matched_at DESC
  LIMIT 1
) latest_art ON TRUE
WHERE artist_stats.album_count > 0
```

The `art_source_release_group_id` is used client-side to construct the artwork URL (`/artwork/release-group/<id>`) — no extra round trip.

Both `LATERAL` subqueries are covered by the `metadata_release_groups (metadata_artist_id)` index and the `library_release_reconciliations (metadata_artist_id)` index already defined in the migration.

---

**Gap 4 — Batched `first_matched_at` backfill migration:**

The column is added with `DEFAULT NULL` (not `DEFAULT NOW()` as in the first-pass), allowing identification of un-backfilled rows:

```sql
ALTER TABLE library_release_reconciliations
  ADD COLUMN first_matched_at TIMESTAMPTZ NULL;
```

The reconciliation job, on its first run after migration, backfills in batches:

```sql
UPDATE library_release_reconciliations
SET first_matched_at = (
  SELECT COALESCE(MIN(lfm.matched_at), lrr_inner.last_reconciled_at)
  FROM library_file_matches lfm
  WHERE lfm.metadata_release_id = library_release_reconciliations.metadata_release_id
    AND lfm.match_status = 'matched'
)
WHERE first_matched_at IS NULL
LIMIT 500
RETURNING id
```

This runs repeatedly (once per reconciliation job tick) until all rows are backfilled. No schema migration runs the backfill — it happens organically through normal job execution, avoiding migration-time table locks entirely. The `?sort=first_matched_at` endpoint falls back to `last_reconciled_at` for rows still `NULL` during the backfill window, with a deterministic tie-break on `release_group_id`.

Once the backfill is complete (no rows with `first_matched_at IS NULL`), the column gains a `NOT NULL` constraint via a follow-up migration.

---

**Gap 5 — "Needs Attention" is a structured section, not a banner:**

The Library view has two distinct attention categories with different actions:

**Section A — "Complete your collection" (partial releases):** Shown only when `partial` releases exist. Compact horizontal scroll strip at the top of the Library view (not a grid row — a dedicated strip above the main grid). Each card shows: artwork, title, `matched/expected` track count, and a single primary action **"Request remaining N tracks"** that opens `ReleaseDetailModal`. This is not just a banner — it's an actionable surface. Maximum 5 cards visible; overflow shows **"+ N more"** that scrolls to the partial filter in the main grid below.

**Section B — "Duplicates to review" (duplicate releases):** Shown only when `duplicate` releases exist. A collapsible list (not a grid) showing release title, artist, and duplicate file count. Each row links to `/app/activity/operations?releaseGroupId=<id>&reason=duplicate` (see Gap 6). Default collapsed — most users ignore duplicates most of the time. Expand state persisted in `localStorage`.

When both sections are empty (all releases are `complete`), no attention section appears at all — the grid fills the full viewport.

---

**Gap 6 — `duplicate` deep-link to filtered Operations:**

The current `/app/activity/operations` route shows all operations with no filtering. The `duplicate` badge must not dump users into an unfiltered feed.

New route query param: `/app/activity/operations?releaseGroupId=<uuid>&reason=duplicate`

The Operations view `useOperationsFilter` composable reads `releaseGroupId` and `reason` from `route.query` on mount and applies them as initial filter state. This shows only operations related to the specific release group marked as duplicate.

This requires:
- `activity/operations` route to accept and honour `releaseGroupId` + `reason` query params
- `GET /api/v1/library/discovery-runs` (or the activity feed endpoint) to accept `?releaseGroupId=` filter
- If no operations exist for the group (e.g., downloads were completed before the tracking feature existed), show an inline message: *"No operations found for this album. Use your file manager to review duplicate files."*

---

**The data model has three owned states, not two:**

`library_release_reconciliations.reconciliation_status` values: `'complete'` (all expected tracks matched), `'partial'` (some matched, some missing), `'duplicate'` (all tracks matched but with redundant file copies). The tentative only addressed `complete` and `partial`.

Releases with NO `library_release_reconciliations` row are not in the Library view, regardless of `library_file_matches` rows — orphaned file matches not yet reconciled are invisible until the reconciliation job runs.

---

**Release-group level display with best-status aggregation:**

`library_release_reconciliations` is keyed per release (`UNIQUE (metadata_release_id)`). The Library grid shows cards at the **release-group** level. A group with multiple reconciled releases uses the best status: `complete > duplicate > partial`. The card badge shows best status; the release detail modal (Q7.11) shows per-release ownership in the edition switcher.

Server-side aggregation query (release-flat mode):

```sql
SELECT
  mrg.id AS release_group_id,
  mrg.title,
  mrg.primary_type,
  ma.name AS artist_name,
  ma.sort_name AS artist_sort_name,
  MIN(lrr.first_matched_at) AS first_matched_at,
  CASE
    WHEN bool_or(lrr.reconciliation_status = 'complete') THEN 'complete'
    WHEN bool_or(lrr.reconciliation_status = 'duplicate') THEN 'duplicate'
    ELSE 'partial'
  END AS best_status,
  SUM(lrr.matched_track_count) AS matched_track_count,
  SUM(lrr.expected_track_count) AS expected_track_count,
  COUNT(lrr.id) AS reconciled_release_count,
  jsonb_merge_codec_summaries(array_agg(lrr.codec_summary)) AS codecs
FROM library_release_reconciliations lrr
JOIN metadata_releases mr ON mr.id = lrr.metadata_release_id
JOIN metadata_release_groups mrg ON mrg.id = mr.metadata_release_group_id
JOIN metadata_artists ma ON ma.id = mrg.metadata_artist_id
GROUP BY mrg.id, mrg.title, mrg.primary_type, ma.name, ma.sort_name
```

(`jsonb_merge_codec_summaries` is a small application-level aggregation — summing codec counts across releases in a group — handled in the service layer, not a custom DB function.)

---

**`first_matched_at` — honest acquisition date:**

See Gap 4 above for backfill strategy. `first_matched_at` represents the `MIN(library_file_matches.matched_at)` for matched files in the release, set on insert and never updated. Sort by `first_matched_at` is the "date acquired" sort. Falls back to `last_reconciled_at` while backfill is in progress (rows still NULL).

---

**Genre filter — `raw_payload` JSONB for v1:**

`metadata_release_groups.raw_payload` may contain `raw_payload->'genres'` (array of `{ name, count }`) or `raw_payload->'tags'`. Filter via `JSONB @>` operator. Releases without genre data are excluded from genre-filtered views with a muted note: *"N releases have no genre tag."* No schema change for v1. `metadata_tags` join table is a v1.1 additive.

---

**New endpoint: `GET /api/v1/library/owned-releases`**

Query params:
- `?sort=artist_name|release_year|first_matched_at` (default: `artist_name`)
- `?order=asc|desc` (default: `asc`)
- `?status=complete|partial|duplicate|all` (default: `all`)
- `?artistId=<uuid>` — filter to one artist (artist card click)
- `?format=flac|mp3|other` — `codec_summary` JSONB filter
- `?genre=<string>` — `raw_payload` JSONB tag filter
- `?cursor=<opaque>` — keyset on `(sort_value, release_group_id)`. For `artist_name` sort, cursor encodes `(artist_sort_name, title, release_group_id)` to handle artist-with-multiple-albums ties deterministically
- `?limit=<n>` — default 50, max 200

Response shape same as first-pass, with `codecs` field added to each release item.

---

**Interaction with Q7.14 (GridControls filtering):**

All filters and sort for Library view are server-side. `GridControls` emits structured state that maps 1:1 to these query params. This is the primary motivation for Q7.14's constraint that filter state must be structured to mirror future query params — Library view is the "future" that's already arrived.

---

**Significant refactoring callout:**

- **Missing screen default changed**: `GET /api/v1/library/wanted-releases` UI default changes from `all` to `missing`-only. `partial`-status releases are removed from the Missing screen entirely
- **New migration**: `first_matched_at TIMESTAMPTZ NULL` + `codec_summary JSONB NULL` on `library_release_reconciliations`; backfill runs via job, not migration script
- **Reconciliation job updated**: must compute and store `codec_summary` on every run; must set `first_matched_at` on insert (and batch-backfill NULLs)
- **Artist grouping uses `LATERAL` subquery** — different query path from release-flat, distinct function in the service layer
- **`/app/activity/operations`** must accept `?releaseGroupId` + `?reason` query params and pass them to the activity feed endpoint
- **`partial` Library card has two actions**: "Play what you have" (playback integration, v1 deferred) and "Request remaining N tracks" — both surfaced, not just the request action

### 7.13 Color Extraction — Performance Budget on Large Grids? ✓ Resolved + Strengthened

**Decision: Server-side extraction at artwork ingest time using `sharp.stats()` (histogram-based dominant color, not an averaging resize). OKLCH hue `H` and chroma `C` are stored on `artwork_assets`; lightness is NOT stored — it is derived at CSS time per the active theme. A vibrancy gate (`C ≥ 0.05`) suppresses near-grey extractions. The client-side worker secondary path persists its result back to the server via a fire-and-forget write-back endpoint, eliminating repeated re-extraction on subsequent page loads.**

---

**Five gaps in the first-pass design (all addressed below):**

1. **1×1 lanczos3 resize computes an area-weighted average, not the dominant color** — High-contrast album art (bright logo on black background, bold split-colour designs) produces a muddy grey from the area average. The actual dominant color — the most-represented distinct hue — is not the average. Sharp already ships a `stats()` method that returns `{ dominant: { r, g, b } }` computed via histogram analysis over the full image. This costs the same as the resize path and produces far more accurate results. The first-pass spec unknowingly discarded a built-in Sharp feature.

2. **Storing a single hex and applying it unconditionally breaks in light mode** — The design in 5.21 includes a full dark/light theme toggle. A dark purple `#1a0a2e` (extracted from a dark album cover) applied as a border tint on a light-mode card is near-invisible. A pale yellow extracted from a vintage artwork is near-invisible in dark mode. Storing hex is storing a lightness-locked value. The correct approach (validated by WCAG-aware OKLCH literature) is to store the hue angle `H` and chroma `C`, then derive lightness at CSS render time per theme. Hue is the dominant perceptual cue; even a ±30% lightness shift preserves color identity.

3. **No vibrancy gate — grey extractions pollute cards** — A significant fraction of album art is photographed against black, white, or concrete-grey backgrounds. `sharp.stats()` will return a near-achromatic RGB for these. Applying those as `--card-accent` tints produces no visible difference from the `--hx-border-default` fallback, but still writes a CSS custom property, wastes a worker job, and stores a useless value in the DB. A minimum chroma threshold prevents these from ever being applied.

4. **Client worker result is never persisted — re-extraction on every page load** — When the worker extracts a color for an asset that has `dominant_hex = NULL` (pre-migration backlog), the result is used in memory for that session only. Next page load: `dominant_hex` is still `NULL`, the card still triggers a worker job. For a library with 80 pre-migration albums, every Library view load fires 80 worker jobs. The fix is a write-back: after successful extraction, the card fires `PATCH /api/v1/artwork/assets/:assetId/dominant-color` with the extracted OKLCH components. On the next load, the server returns the stored value and no worker job fires.

5. **Worker code has no error handling or timeout — memory leak on failure** — If `createImageBitmap` rejects or `getImageData` throws inside the worker, the `pending` Map entry in `artwork-color-worker-client.js` is never resolved, the `activeCount` never decrements, and the queue permanently stalls at capacity. A pending artwork ID occupies a slot forever. Production workloads hit transient browser resource limits (memory pressure, rapid tab switching) that trigger these paths.

---

**Primary path — `sharp.stats()` with OKLCH conversion:**

Replace the 1×1 resize in `prepareArtworkAsset()` with:

```js
const stats = await sharp(buffer).stats();
const { r, g, b } = stats.dominant; // histogram-based dominant color

// Convert RGB → OKLCH for theme-adaptive storage
const oklch = rgbToOklch(r, g, b); // see below
const { l, c, h } = oklch;

// Vibrancy gate: suppress near-grey colors (chroma too low to be useful as a tint)
if (c >= 0.05) {
  asset.dominantHue = Math.round(h * 100) / 100;    // 0–360, stored as NUMERIC(6,2)
  asset.dominantChroma = Math.round(c * 10000) / 10000; // 0–0.4, stored as NUMERIC(6,4)
  asset.dominantLightness = Math.round(l * 10000) / 10000; // reference lightness, stored for write-back normalization
} else {
  asset.dominantHue = null;
  asset.dominantChroma = null;
  asset.dominantLightness = null;
}
```

`rgbToOklch(r, g, b)` is a small pure-JS function (no dependency) implementing the standard RGB→linear→XYZ→Oklab→OKLCH pipeline. ~30 lines, no external package. Invertible and deterministic.

Schema change on `artwork_assets`:
```sql
ALTER TABLE artwork_assets
  ADD COLUMN dominant_hue       NUMERIC(6,2)  NULL,  -- 0-360 degrees
  ADD COLUMN dominant_chroma    NUMERIC(6,4)  NULL,  -- 0.0-0.4 (OKLCH C)
  ADD COLUMN dominant_lightness NUMERIC(6,4)  NULL;  -- 0.0-1.0 (OKLCH L, reference)
-- Legacy column retained for API compatibility during migration:
  ADD COLUMN dominant_hex VARCHAR(7) NULL GENERATED ALWAYS AS (
    CASE WHEN dominant_hue IS NOT NULL
      THEN oklch_to_hex(dominant_lightness, dominant_chroma, dominant_hue)
      ELSE NULL
    END
  ) STORED;
```

(`dominant_hex` as a generated column means existing API consumers that read `dominant_hex` continue to work without changes during the migration. The `oklch_to_hex` function is a small SQL function wrapping the inverse pipeline.)

Returned in artwork API responses:
```json
{
  "artworkUrl": "...",
  "dominantColor": {
    "hue": 285.4,
    "chroma": 0.18,
    "lightness": 0.42,
    "hex": "#3a1c71"
  }
}
```

If chroma gate fails: `"dominantColor": null`.

---

**CSS — OKLCH-aware theme adaptation:**

Card components receive `dominantColor` and set three CSS custom properties on the card root:

```html
<div class="hx-release-card"
     :style="accentStyle"
>
```

```js
// in card component
const accentStyle = computed(() => {
  if (!props.dominantColor) return {};
  return {
    '--card-accent-h': props.dominantColor.hue,
    '--card-accent-c': props.dominantColor.chroma,
    '--card-accent-ref-l': props.dominantColor.lightness,
  };
});
```

Card CSS applies theme-adapted lightness via `color-mix` and OKLCH directly:

```css
/* Dark mode (default) — use a lightened expression of the hue */
.hx-release-card {
  --card-accent-l-dark: 0.72;
  --card-accent-l-light: 0.38;

  border: 1px solid color-mix(
    in oklch,
    oklch(
      var(--card-accent-l-dark, 0.72)
      var(--card-accent-c, 0)
      var(--card-accent-h, 0)
    ) 40%,
    transparent
  );
  transition: border-color 0.2s ease;
}

[data-theme="light"] .hx-release-card {
  border-color: color-mix(
    in oklch,
    oklch(
      var(--card-accent-l-light, 0.38)
      var(--card-accent-c, 0)
      var(--card-accent-h, 0)
    ) 50%,
    transparent
  );
}

.hx-release-card:hover {
  border-color: oklch(
    var(--card-accent-l-dark, 0.72)
    var(--card-accent-c, 0)
    var(--card-accent-h, 0)
    / 0.85
  );
}
```

The fixed lightness values (`0.72` dark, `0.38` light) ensure the border is always visible against the card background in both themes — regardless of the source album art's original lightness. Hue and chroma are preserved. This is the OKLCH hue-preservation pattern documented in the WCAG accessibility literature: `L` is adjusted to meet contrast, `H` and `C` remain as extracted.

When `--card-accent-c` is `0` (no accent set or fallback): `oklch(L 0 0)` is achromatic grey, which blends with the `transparent` endpoint to become invisible — the border falls through to the default `--hx-border-default` on the element.

---

**Client-side worker — upgraded algorithm + write-back:**

The worker's pixel selection algorithm is upgraded from "most saturated single pixel" (which picks noise pixels and anti-aliased edges) to a two-pass approach on the 16×16 sample:

```js
// color-worker.js
self.onmessage = ({ data: { id, bitmap } }) => {
  try {
    const canvas = new OffscreenCanvas(16, 16);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, 16, 16);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, 16, 16);

    // Pass 1: collect OKLCH for each pixel, filter low-chroma (grey) pixels
    const saturated = [];
    for (let i = 0; i < data.length; i += 4) {
      const oklch = rgbToOklch(data[i], data[i+1], data[i+2]);
      if (oklch.c >= 0.05) saturated.push(oklch);
    }

    if (saturated.length === 0) {
      // Image is essentially monochrome/grey — no useful accent
      self.postMessage({ id, hue: null, chroma: null, lightness: null });
      return;
    }

    // Pass 2: find median hue in the largest hue cluster (simple circular median)
    // Sort by hue, pick the cluster with the most pixels within ±30°, use its chroma-weighted centroid
    saturated.sort((a, b) => a.h - b.h);
    let bestCluster = null, bestCount = 0;
    for (let i = 0; i < saturated.length; i++) {
      const baseH = saturated[i].h;
      const cluster = saturated.filter(p => {
        const diff = Math.abs(p.h - baseH);
        return Math.min(diff, 360 - diff) <= 30;
      });
      if (cluster.length > bestCount) { bestCount = cluster.length; bestCluster = cluster; }
    }

    const avgH = bestCluster.reduce((s, p) => s + p.h, 0) / bestCluster.length;
    const avgC = bestCluster.reduce((s, p) => s + p.c, 0) / bestCluster.length;
    const avgL = bestCluster.reduce((s, p) => s + p.l, 0) / bestCluster.length;

    self.postMessage({ id, hue: avgH, chroma: avgC, lightness: avgL });
  } catch (err) {
    self.postMessage({ id, hue: null, chroma: null, lightness: null, error: err.message });
  }
};
```

**Write-back from card component:**

After `useArtworkColor` resolves a value from the worker (non-null), the card fires a fire-and-forget write-back:

```js
// in card component, after useArtworkColor resolves
if (resolved && props.artworkAssetId) {
  // fire-and-forget, no await, no error surfacing to user
  fetch(`/api/v1/artwork/assets/${props.artworkAssetId}/dominant-color`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
    body: JSON.stringify({ hue: resolved.hue, chroma: resolved.chroma, lightness: resolved.lightness }),
  }).catch(() => { /* ignore — next load retries */ });
}
```

New endpoint: `PATCH /api/v1/artwork/assets/:assetId/dominant-color`
- Requires session (any role)
- Body: `{ hue, chroma, lightness }` — validated as numeric in range
- Sets `dominant_hue`, `dominant_chroma`, `dominant_lightness` where they are `NULL`. **Never overwrites a server-side extracted value** (`WHERE dominant_hue IS NULL`). This prevents client noise from polluting server-computed values.

---

**Worker singleton — error handling and timeout:**

```js
// artwork-color-worker-client.js
const JOB_TIMEOUT_MS = 4000;

function drainQueue() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const { id, bitmap, resolve, timer } = queue.shift();
    pending.set(id, resolve);
    activeCount++;
    // Safety timeout: if worker doesn't respond in 4s, resolve null and unblock
    const timeout = setTimeout(() => {
      if (pending.has(id)) {
        pending.get(id)({ hue: null, chroma: null, lightness: null });
        pending.delete(id);
        activeCount--;
        drainQueue();
      }
    }, JOB_TIMEOUT_MS);
    pending.set(id, (result) => { clearTimeout(timeout); resolve(result); });
    getWorker().postMessage({ id, bitmap }, [bitmap]);
  }
}
```

Worker-level error: if the worker itself crashes (`worker.onerror`), drain all pending with null results and set `worker = null` so the next call re-instantiates. No worker crash permanently blocks the queue.

---

**CORS and `ArtworkImage.vue` — unchanged:**

Same as first-pass: no `crossOrigin` attribute added. `isSameOrigin` check on the URL string. CAA fallback images never reach the worker. `defineExpose({ imgRef, activeSrc })` added.

---

**Safari fallback — unchanged:**

Same as first-pass: `if (typeof OffscreenCanvas === 'undefined')` guard in worker returns null result immediately.

---

**Performance budget summary (updated):**

| Path | Main thread cost | Accuracy | Write-back |
|---|---|---|---|
| Stored OKLCH components | 0ms | High (histogram-based) | Already persisted |
| Client worker + write-back | <0.1ms (transfer) | Medium (16×16 cluster) | Fires once, persists |
| No extraction (cross-origin / grey gate / Safari <16.4) | 0ms | — | — |

After the write-back, every asset that has ever been seen by a client has its dominant color stored. The worker queue reaches steady-state emptiness within one or two Library view visits after the migration.

---

**Migration and backward compatibility:**

- New migration: `dominant_hue NUMERIC(6,2) NULL`, `dominant_chroma NUMERIC(6,4) NULL`, `dominant_lightness NUMERIC(6,4) NULL` on `artwork_assets`
- `dominant_hex VARCHAR(7)` is a generated column for API compatibility — computable from `(dominant_lightness, dominant_chroma, dominant_hue)` via the inverse OKLCH function. Existing clients reading `dominant_hex` continue to work
- No backfill script required: new ingests populate immediately; existing assets receive values via client write-back or next re-ingest
- `PATCH /api/v1/artwork/assets/:id/dominant-color` only writes where NULL (`WHERE dominant_hue IS NULL`)

---

**Significant refactoring callout (additions from first-pass):**

- `prepareArtworkAsset()` now calls `sharp(buffer).stats()` instead of `resize(1, 1)`. New `rgbToOklch()` pure-JS utility in `src/server/artwork/color-utils.js`
- Schema: three new columns (`dominant_hue`, `dominant_chroma`, `dominant_lightness`) + generated `dominant_hex`. New SQL function `oklch_to_hex(l, c, h)` for the generated column
- Artwork API response shape changes from `dominantColor: "#hex"` to `dominantColor: { hue, chroma, lightness, hex } | null`
- Card components set three CSS custom properties (`--card-accent-h`, `--card-accent-c`, `--card-accent-ref-l`) not one (`--card-accent`)
- Card CSS uses `oklch(fixed-L var(--card-accent-c) var(--card-accent-h))` — fixed lightness per theme, not source lightness
- Worker algorithm upgraded to hue-cluster median (not single most-saturated pixel). `rgbToOklch` ported to `color-worker.js`
- New `PATCH /api/v1/artwork/assets/:id/dominant-color` endpoint with CSRF protection
- Worker singleton gains per-job timeout + worker crash recovery
- Section 5.17 rewritten below

### 7.14 GridControls — Client-Side vs. Server-Side Filtering? ✓ Resolved + Strengthened

**Decision: Filtering mode is determined per-view by dataset boundedness — not as a blanket policy. `GridControls` is mode-agnostic: it accepts `modelValue: GridFilterState` via `v-model` and emits the same shape regardless of whether the consumer applies it locally (client-side `computed`) or as server query params (API call). Filter/sort state is stored in URL query params, not `localStorage`. The URL is the single source of truth for filter state because filter state is navigational — it must be shareable, bookmarkable, and restored by the back button and tab duplication.**

---

**Why the tentative is now directly contradicted:**

The tentative says "client-side in v1." Q7.12 already decided that Library view uses server-side cursor-based filtering for an unbounded dataset. Library is the most visible grid view and the one most likely to grow to hundreds or thousands of rows. The tentative's "most libraries are small" premise does not hold as a blanket rule and cannot be used to justify a design that would require component API changes when the library grows. The resolution must be per-view.

---

**Per-view filtering mode:**

| View | Mode | Dataset bound | Rationale |
|---|---|---|---|
| Library view | Server-side | Unbounded (cursor-paginated) | Q7.12; `codec_summary` pre-aggregated; full-library filter impossible client-side |
| Missing screen | Client-side | ~200 items max | `wanted_status = 'missing'` only; pre-fetched in one request |
| My Requests | Client-side | Per-user, bounded | Typically <50 active requests per user |
| Home Artist Grid | Client-side | ~20–30 recently active | Small pre-fetched set; no pagination |

---

**Seven gaps in the tentative design (all addressed below):**

**Gap 1 — `localStorage` is the wrong backing store for filter/sort state**

Section 5.20 says "State is stored in `localStorage` per view key." This breaks three use cases simultaneously:
- A URL shared with another user (or duplicated to a new tab) loses filter context — the recipient sees an unfiltered default view
- The browser back button does not restore the previous filter state — the URL was never updated
- A bookmarked URL always returns the unfiltered default regardless of what the user was looking at when they bookmarked it

Filter and sort state is navigational. It describes what the user is currently looking at, not a persistent user preference. URL query params are the correct medium: Vue Router's `route.query` is reactive, and `watch(() => route.query.x, ...)` is the idiomatic Vue 3 pattern for reacting to URL state changes (confirmed by the official Vue Router Composition API docs).

**Correct split**:
- Filter/sort state → URL query params
- Display preferences (grid vs list view mode, Q7.12 "Needs Attention" section collapsed state) → `localStorage`

**Gap 2 — `router.push` vs `router.replace` — history stack spam**

Changing a filter is a refinement of the current view, not navigation to a new destination. If `router.push` is used for each filter change, a user who cycles through three format options (FLAC → MP3 → All) creates three back-button steps before exiting the Library page. This is disorienting and contrary to the browser's navigation model.

**Decision**: `router.replace` for all filter/sort changes. The URL always reflects the current state; the back button exits the view entirely. Exception: text-search inputs write to the URL with a **300ms trailing debounce** to avoid mid-keystroke URL churn. Discrete selections (dropdown selection, pill toggle) write immediately with `router.replace` — no debounce.

**Gap 3 — Server-side consumers need AbortController — race condition on rapid filter changes**

When a user changes filters quickly (FLAC → MP3 → All in rapid succession), three `GET /api/v1/library/owned-releases` requests fire concurrently. Network responses can arrive out of order. Without abort handling, the third request may resolve first showing "All" results, then the first request resolves and overwrites with FLAC results — but the URL shows "All." Displayed data and URL state diverge silently.

`useLibraryReleases(filterState)` maintains a `currentController` ref:
```js
currentController.value?.abort();
currentController.value = new AbortController();
const result = await fetch(url, { signal: currentController.value.signal });
```
On `AbortError`: silently discard the response (this is an intentional cancel, not a network error). The display remains stable until the in-flight request completes.

**Gap 4 — Debounce budget belongs in the consumer, not in `GridControls`**

`GridControls` emits state immediately on every user interaction. The debounce lives in the consumer composable, sized to the cost of the downstream operation:
- Client-side consumers: `computed(() => data.value.filter(...).sort(...))` is synchronous — no debounce needed for discrete selections; text search can debounce 150ms
- Server-side consumers: 300ms trailing debounce + AbortController before firing the API call

Embedding debounce in `GridControls` would couple the component to the cost of server API calls, which is the wrong responsibility boundary.

**Gap 5 — Available filter options for Library view are dynamic, not hardcoded**

Section 5.20 implies `filterGroups` is a static prop with pre-known options. For the Library view, the available format options are the codecs that actually exist in this user's library — stored in `codec_summary JSONB` per reconciliation row (Q7.12). Hardcoding `['FLAC', 'MP3', 'AAC']` would show options that produce zero results for most users.

Fix: new lightweight endpoint `GET /api/v1/library/filter-options` returns:
```json
{ "formats": ["flac", "mp3"], "genres": ["rock", "jazz"] }
```
Aggregated in a single JSON aggregate query over `codec_summary` across the user's `library_release_reconciliations` rows. Called once on Library view mount; result passed as the dynamic `filterGroups` prop to `<GridControls>`. For client-side views (Missing, My Requests), filter options are derived from the pre-fetched data — no extra endpoint needed.

**Gap 6 — `GridFilterState` shape was never precisely defined**

The tentative says "emits filter/sort state objects structured to mirror future query params" without a concrete shape. Define it precisely:

```ts
interface GridFilterState {
  sort: { field: string; order: 'asc' | 'desc' };
  filters: Record<string, string>; // single-value per key in v1
}
```

URL query param mapping:
- `sort` and `order` as two flat params (`?sort=title&order=asc`)
- Each filter key maps to one param (`?format=flac&genre=jazz`)

Parsing from `route.query`: absent params fall back to view-level defaults. Multi-value filters (filter by FLAC AND MP3 simultaneously) are deferred to v1.1 — single-value per key keeps the URL shape unambiguous and the server query straightforward.

**Gap 7 — `GridControls` must NOT write defaults to URL on mount**

When a user navigates to `/app/library` with no query params, `GridControls` should render with default values — but it must not call `router.replace` on mount to write those defaults into the URL. Writing defaults on mount would:
- Pollute every page entry with redundant params (`?sort=added&order=desc`)
- Create a spurious history entry that interferes with the back button
- Cause infinite reactivity loops if the URL write triggers a computed re-evaluation

**Decision**: Absent params mean "using defaults." Defaults are encoded in the URL only when the user explicitly changes from the default. The `useGridState(defaults)` composable exposes a `filterState` computed from `route.query` with fallback to defaults — no write-on-mount.

---

**`useGridState(defaults)` composable — shared by all views:**

```js
// src/client/composables/useGridState.js
export function useGridState(defaults = {}) {
  const route = useRoute();
  const router = useRouter();

  // Reactive read from URL — no write-on-mount
  const filterState = computed(() => ({
    sort: {
      field: route.query.sort ?? defaults.sort?.field ?? 'added',
      order: route.query.order ?? defaults.sort?.order ?? 'desc',
    },
    filters: Object.fromEntries(
      Object.keys(defaults.filters ?? {}).map((key) => [
        key,
        route.query[key] ?? defaults.filters[key] ?? undefined,
      ]).filter(([, v]) => v !== undefined)
    ),
  }));

  // Write filter state back to URL via replace (not push)
  function updateState(patch) {
    const next = { ...filterState.value, ...patch,
      sort: { ...filterState.value.sort, ...(patch.sort ?? {}) },
      filters: { ...filterState.value.filters, ...(patch.filters ?? {}) },
    };
    router.replace({
      query: {
        ...route.query,
        sort: next.sort.field,
        order: next.sort.order,
        ...next.filters,
      },
    });
  }

  return { filterState, updateState };
}
```

Server-side consumers (`useLibraryReleases`) watch `filterState` with a 300ms debounce and fire API calls with AbortController. Client-side consumers use `filterState` directly in a `computed` to derive the filtered/sorted display array.

---

**`GridControls.vue` — stateless `v-model` component:**

```html
<GridControls
  v-model="filterState"
  :sort-options="sortOptions"
  :filter-groups="filterGroups"
/>
```

Props:
- `modelValue: GridFilterState` — current filter/sort state
- `sortOptions: Array<{ value: string, label: string }>` — sort field choices
- `filterGroups: Array<{ key: string, label: string, options: Array<{ value: string, label: string }> }>` — filter dimensions

Emits:
- `update:modelValue: GridFilterState` — full new state on any change

The component has no internal state and no `localStorage` interaction. All persistence is owned by `useGridState` via the URL.

---

**Render and interaction details:**

- Toolbar row: sort dropdown (left), active filter pills with per-pill clear buttons (right), "Filters" pill that opens the full filter panel
- Active filter count badge on the filter pill trigger
- "Clear all" link appears when any filter differs from the view default
- On mobile: collapses to "Sort & Filter" bottom sheet trigger
- Screen reader: each pill has `aria-pressed` for toggle state; dropdown uses native `<select>` or `role="listbox"` with `aria-activedescendant`

---

**Significant refactoring callout (first-pass):**

- Section 5.20 spec rewrite: switch from `sort-change`/`filter-change` events + `localStorage` to `v-model: GridFilterState` backed by URL query params
- New `src/client/composables/useGridState.js` composable
- `GridControls.vue`: remove all internal `localStorage` reads/writes; become a pure `v-model` component
- Library view: `useGridState(libraryDefaults)` + `useLibraryReleases(filterState)` with 300ms debounce + AbortController; `GET /api/v1/library/filter-options` on mount for dynamic `filterGroups`
- New `GET /api/v1/library/filter-options` endpoint (aggregates `codec_summary` + genres)
- Missing screen: `useGridState(missingDefaults)` + client-side `computed` over pre-fetched array
- My Requests: same pattern as Missing screen
- Home Artist Grid: same pattern; filter options derived from the fetched artist list
- All views that previously wrote filter state to `localStorage` under view-key keys: those writes are removed; URL owns that state
- Display preferences that genuinely belong in `localStorage` (grid vs list mode, Q7.12 "Needs Attention" collapsed state): remain in `localStorage` unchanged
- Section 5.20 rewritten below

---

**Seven additional gaps in the first-pass design (all addressed below):**

**Gap 8 — `useLibraryReleases` exposes no loading, error, or stale-data state — view has no way to render feedback**

The first-pass composable sets `data.value` when the request completes but returns nothing about the in-flight state. The Library view renders an empty grid during the first load and replaces it on completion — no skeleton, no spinner. On a filter change, the grid immediately goes blank while the new request is in-flight. Confirmed issue from the InfoQ stale-while-revalidate analysis: blank intermediary states degrade perceived performance even when actual latency is low.

The stale-while-revalidate pattern is the correct fix: keep displaying the previous results at reduced opacity while the new request is in-flight, and replace when the response arrives. If the request fails, show an error callout above the stale results — the user still sees their data and can retry.

`useLibraryReleases` must expose:
```js
return {
  data,           // Ref<Release[]> — current confirmed-good results
  staleData,      // Ref<Release[]> — last successful results (non-null after first load)
  isLoading,      // Ref<boolean> — true while any request is in-flight
  isFirstLoad,    // Ref<boolean> — true until the first successful response
  error,          // Ref<Error | null> — last request error; cleared on next success
  isEmpty,        // ComputedRef<boolean> — true if data is empty after first load
  retry,          // () => void — re-fires the last query manually
};
```

Grid rendering logic:
- `isFirstLoad && isLoading` → show skeleton card grid (N placeholder cards)
- `!isFirstLoad && isLoading` → show `staleData` at 60% opacity with a spinner badge in the GridControls bar
- `error && !isFirstLoad` → show error callout above `staleData` (data remains visible)
- `error && isFirstLoad` → show full-page error state with retry button
- `isEmpty && !isLoading` → show empty state ("No releases match these filters")

**Gap 9 — `route.query` values are never validated against the allowed option set — security and correctness gap**

`route.query` is attacker-controlled. A URL crafted as `/app/library?sort=%3Cscript%3Ealert%281%29%3C%2Fscript%3E&format=all_of_them` passes the sort value and format value directly into `filterState` as strings.

While Vue templates do not evaluate HTML from reactive refs (no `innerHTML` path here), there are still two concrete failure modes:
1. **Client-side display corruption**: A `sort` value not in `sortOptions` causes the sort dropdown to show no selection, and client-side sorted views return results in an undefined order.
2. **Server-side request pollution**: For Library view, the unknown `sort` and `format` values are forwarded as query params to `GET /api/v1/library/owned-releases`. The server validates and rejects with a 400, but the Library view receives an error state on mount — a confused first impression caused by a crafted URL.

Fix: `parseAndValidateQuery(query, { sortOptions, filterGroups })` in `useGridState`. Any `sort` value not in `sortOptions[].value` falls back to the default. Any filter value not in the corresponding `filterGroups[x].options[].value` is omitted from `filterState.filters`. Validated `filterState` is always structurally clean.

```js
function parseAndValidateQuery(query, { sortOptions, filterGroups, defaults }) {
  const validSortFields = new Set(sortOptions.map((o) => o.value));
  const sortField = validSortFields.has(query.sort) ? query.sort : defaults.sort.field;
  const sortOrder = query.order === 'asc' || query.order === 'desc' ? query.order : defaults.sort.order;

  const filters = {};
  for (const group of filterGroups) {
    const raw = query[group.key];
    // single-value in v1: string; multi-value in v1.1: array
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const valid = group.options.map((o) => o.value);
    const accepted = values.filter((v) => valid.includes(v));
    if (accepted.length === 1) filters[group.key] = accepted[0];   // v1: single string
    if (accepted.length > 1)  filters[group.key] = accepted;       // v1.1: array (safe)
  }

  return { sort: { field: sortField, order: sortOrder }, filters };
}
```

This function is called inside the `filterState` computed, so validation runs on every URL change.

**Gap 10 — Multi-value filter URL encoding is undefined — v1.1 migration path is a breaking change without forward-planning**

The first-pass defers multi-value filters to v1.1 with `filters: Record<string, string>` but never defines what v1.1 looks like. If v1.1 changes the URL encoding (e.g., from `?format=flac` to `?format=flac,mp3`), it requires changing the server query-string parser, the `GridFilterState` type, the `useGridState` reader, and the `GridControls` renderer — four separate coordinated changes with a real risk of breaking existing bookmarks.

Defining the encoding now makes the migration purely additive:
- URL encoding: **repeated params** — `?format=flac&format=mp3`. Vue Router 4 already parses repeated params as `string[]` in `route.query`. No extra parsing needed.
- `GridFilterState.filters`: change type from `Record<string, string>` to `Record<string, string | string[]>` now. In v1, the validation function (`parseAndValidateQuery`) only ever produces single-string values because `GridControls` is single-select. In v1.1, multi-select GridControls produces arrays.
- Server endpoints: `req.query.format` in Express is already `string | string[]`. The handler already needs to handle both (it will receive a string in v1). No server-side change needed between v1 and v1.1.
- `GridControls`: in v1, filter pills are single-select (selecting a new value deselects the previous). In v1.1, pills become multi-select. The `update:modelValue` shape is identical; the renderer just changes pill behaviour.

Net result: v1.1 multi-value filters require one change — making `GridControls` pills multi-select. Everything else is already in place.

**Gap 11 — Filter options (`GET /api/v1/library/filter-options`) go stale after background reconciliation**

The first-pass fetches filter options once on mount. Harmoniarr runs background reconciliation continuously (per Q7.12 library-wanted-reconciliation-baseline). A new album ingested during the session adds a new codec (`opus`, for example) to `codec_summary`. The filter options panel never shows "Opus" during this session, even though Opus albums now exist in the library.

Fix: `useLibraryFilterOptions()` composable uses stale-while-revalidate with a 60-second background refresh interval:

```js
export function useLibraryFilterOptions() {
  const options = ref(null);
  const fetchOptions = async () => {
    const result = await fetch('/api/v1/library/filter-options').then((r) => r.json());
    options.value = result; // reactive update — GridControls re-renders with new options
  };

  onMounted(fetchOptions);
  // Background refresh: non-blocking, no loading state shown
  const interval = setInterval(fetchOptions, 60_000);
  onUnmounted(() => clearInterval(interval));

  return { options }; // null until first load; grid renders with options = null initially
}
```

When `options` updates from a background poll, `GridControls` re-renders with the new `filterGroups`. If the user has an active filter for a codec that no longer appears (e.g., they filtered FLAC but re-indexing removed all FLAC tracks — unlikely but possible), `parseAndValidateQuery` will drop that filter value on the next `filterState` recompute. A subtle UI footnote: the active pill disappears the next time the URL is read. Acceptable for v1.

**Gap 12 — `isDefault` and `clearAll` / `clearFilter` are not exposed from `useGridState` — `GridControls` cannot compute "Clear all" visibility without duplicating defaults**

`GridControls` receives `modelValue` (the current state) and is expected to show a "Clear all" link when any filter differs from the view default. But the component has no `defaults` prop — it cannot compare against defaults it doesn't know. The parent view knows the defaults (passed to `useGridState(defaults)`) and the current state, but the condition for "Clear all" is scattered across the parent and the component.

Fix: expose from `useGridState`:
```js
const isDefault = computed(() =>
  filterState.value.sort.field === defaults.sort?.field ?? 'added' &&
  filterState.value.sort.order === defaults.sort?.order ?? 'desc' &&
  Object.keys(filterState.value.filters).length === 0
);

function clearAll() {
  router.replace({
    query: {
      // Remove all filter/sort keys; keep any unrelated query params
      ...Object.fromEntries(
        Object.entries(route.query).filter(
          ([k]) => k !== 'sort' && k !== 'order' && !filterGroupKeys.includes(k)
        )
      ),
    },
  });
}

function clearFilter(key) {
  const { [key]: _, ...rest } = route.query;
  router.replace({ query: rest });
}

return { filterState, isDefault, updateState, clearAll, clearFilter };
```

`GridControls` receives `isDefault` as a prop and uses it directly. "Clear all" visibility is a one-liner in the template: `v-if="!isDefault"`.

**Gap 13 — Sort direction toggle is not a first-class API — every consumer re-implements the flip logic**

Toggling sort direction (ascending → descending → ascending) by clicking the active sort column header is standard behaviour in every data grid UI. The current `updateState(patch)` API requires the caller to read the current `order`, flip it, and write it back:

```js
// Every consumer would write this:
updateState({ sort: { order: filterState.value.sort.order === 'asc' ? 'desc' : 'asc' } });
```

This is exactly the kind of logic that duplicates across Library, Missing, My Requests, and Home if left to callers. Expose it as a first-class function:

```js
function toggleSortOrder() {
  updateState({ sort: { order: filterState.value.sort.order === 'asc' ? 'desc' : 'asc' } });
}
```

`GridControls` calls `emit('update:modelValue', { ...modelValue, sort: { ...modelValue.sort, order: ... } })` — but the composable exposing `toggleSortOrder` means the sort direction button in the toolbar can be wired directly.

**Gap 14 — No "return to last Library state" when navigating away and back via the sidebar**

URL query params persist while the user stays within a route or uses the back button. But if the user navigates sidebar → Settings → Library, the URL for `/app/library` starts fresh with no params. Their previous FLAC + by-artist sort filter is lost.

This is the classic "master → detail → back" problem cited in the MudBlazor and Kendo discussions. Two viable strategies:

1. **Vue Router `meta.savePosition`** — Vue Router's `scrollBehavior` can restore scroll; similarly, a navigation guard on `/app/library` can push the last known query params from `sessionStorage` before the route resolves. Invasive.

2. **`sessionStorage` for last-known filter params** — When `useGridState`'s `filterState` changes (and it's non-default), write the serialized state to `sessionStorage` under a view key. When `useGridState` initialises with no query params in the URL (i.e., the user navigated fresh to the route), check `sessionStorage` and restore by calling `router.replace` once on mount — the sole exception to the no-write-on-mount rule.

Decision: strategy 2, scoped to Library view only. Rationale: Library view is the only unbounded dataset where the user builds a meaningful filter context worth preserving. Missing, My Requests, and Artist Grid are small/short-lived — restoring their filter state on return would be surprising, not helpful.

```js
// In useGridState, add sessionStorage restore on Library view only
// Controlled by an opt-in flag: useGridState(defaults, { restoreKey: 'library' })
onMounted(() => {
  const hasUrlParams = Object.keys(route.query).some(
    (k) => k === 'sort' || k === 'order' || filterGroupKeys.includes(k)
  );
  if (!hasUrlParams && restoreKey) {
    const saved = sessionStorage.getItem(`grid-state-${restoreKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        router.replace({ query: { ...route.query, ...parsed } });
      } catch {}
    }
  }
});

// Watch filterState, write to sessionStorage when non-default
watch(filterState, (state) => {
  if (restoreKey && !isDefault.value) {
    sessionStorage.setItem(`grid-state-${restoreKey}`, JSON.stringify(
      { sort: state.sort.field, order: state.sort.order, ...state.filters }
    ));
  }
});
```

On mount, this fires `router.replace` only if: (a) there are no query params in the URL already (fresh navigation), AND (b) a saved state exists in `sessionStorage`. This is the single legitimate write-on-mount case.

---

**Updated `useGridState` full return type:**

```ts
interface UseGridStateReturn {
  filterState: ComputedRef<GridFilterState>;
  isDefault:   ComputedRef<boolean>;
  updateState: (patch: DeepPartial<GridFilterState>) => void;
  clearFilter: (key: string) => void;
  clearAll:    () => void;
  toggleSortOrder: () => void;
}
```

**Updated `useLibraryReleases` full return type:**

```ts
interface UseLibraryReleasesReturn {
  data:        Ref<Release[]>;       // current confirmed-good results
  staleData:   Ref<Release[]>;       // last successful results (for SWR display)
  isLoading:   Ref<boolean>;
  isFirstLoad: Ref<boolean>;
  error:       Ref<Error | null>;
  isEmpty:     ComputedRef<boolean>;
  retry:       () => void;
}
```

---

**Updated `GridFilterState` type (forward-compatible with v1.1 multi-value):**

```ts
interface GridFilterState {
  sort: { field: string; order: 'asc' | 'desc' };
  filters: Record<string, string | string[]>; // v1: always string; v1.1: string[] for multi-select
}
```

---

**Significant refactoring callout (additions from first-pass):**

- `useGridState` gains: `isDefault`, `clearFilter`, `clearAll`, `toggleSortOrder`, `parseAndValidateQuery` (internal), and optional `restoreKey` for `sessionStorage` restore
- `useGridState` options arg: `useGridState(defaults, { restoreKey?: string, filterGroupKeys: string[] })`
- `GridControls.vue` gains: `isDefault` prop (for "Clear all" visibility); removes all internal default-tracking logic
- `useLibraryReleases` returns full `{ data, staleData, isLoading, isFirstLoad, error, isEmpty, retry }` — replaces the bare `data.value` pattern
- Library view template: three distinct rendering paths (`isFirstLoad`, stale + loading, error callout over stale) with spinner in GridControls bar during filter transitions
- `useLibraryFilterOptions()` composable with 60s background poll; passed dynamically to `filterGroups` prop
- `GridFilterState.filters` type widens to `Record<string, string | string[]>` — affects all server route handlers that read filter query params (must handle both `string` and `string[]` per the Express type)
- Library view uses `useGridState(defaults, { restoreKey: 'library', filterGroupKeys: filterGroupKeys })` — sessionStorage restore on mount
- `parseAndValidateQuery` runs inside `filterState` computed — URL injection falls back to defaults
- Section 5.20 rewritten below

---

## Post-Download Pipeline: Three High-Value Improvements

The following three items address the pipeline that runs after slskd completes a download: apply → scan → tag extraction → file matching → reconciliation → fulfillment. Together they close the largest gaps in end-to-end automation, matching quality, and scan performance for realistic library sizes.

---

### 5.28 Post-Apply Auto-Scan Trigger

**Current gap:** `import-candidate-apply-worker.js` calls `markRunCompleted` after all candidates are processed but has no `scheduleLibraryScan` dependency. After files land on disk, no scan is started automatically. The operator must manually navigate to Library → Scan. Until that manual scan runs, `library_files` has no rows for the newly applied audio, `library_file_matches` has no match results, `library_release_reconciliations` shows no progress, and `library-media-request-fulfillment-service.js` cannot advance any request from `downloading`/`selected` to a fulfilled state. The gap between "files on disk" and "request satisfied" is entirely manual.

**Why this is the highest priority:** Every single import apply operation requires a follow-on manual action that is invisible to the operator unless they know the scan must be triggered. New installs and less-technical operators will see requests stuck in non-fulfilled states indefinitely. Lidarr, Radarr, and Sonarr all trigger a media file scan automatically after a download completes — this is industry-standard behavior for a *arr-class media manager.

**Design decision — trigger a scan after every successful apply run, not per-candidate:** The apply worker iterates multiple candidates in one run. Triggering one scan per candidate creates concurrency problems (the second scan starts before the first finishes). Instead: collect the set of applied candidate IDs during the run, and after `markRunCompleted`, trigger one library scan. The scan will cover all applied files in a single pass.

**Design decision — guard against 409 and unconfigured library root:** The library scan service already throws a 409 if a scan is active. The auto-trigger must catch and ignore that error — a concurrent scan is the desired outcome. If no library root is configured, the scan service throws a different error that should also be suppressed (the scan would fail immediately anyway for the same reason; surfacing it here adds noise without helping).

**Code location:** `src/server/import-candidates/import-candidate-apply-worker.js`. Add `scheduleLibraryScan` to the dependency object (defaulting to `null` so existing tests do not require changes). After `markRunCompleted`:

```js
export function createImportCandidateApplyWorker({
  // ... existing deps
  scheduleLibraryScan = null,       // NEW: async () => { accepted: boolean, run: { id } }
} = {}) {
  // ...
  async function runApply({ ... }) {
    // ... existing logic ...
    await markRunCompleted({ runId, summary: { ... } });

    // Auto-trigger library scan if at least one candidate was successfully applied.
    if (scheduleLibraryScan && (counts.applied + counts.appliedWithWarnings) > 0) {
      try {
        await scheduleLibraryScan({ triggeredByRunId: runId });
      } catch {
        // 409 (scan already active) and configuration errors are intentionally swallowed.
        // The scan that is already running will pick up the applied files.
      }
    }
  }
}
```

**`scheduleLibraryScan` implementation:** Wraps `createLibraryScanService().startLibraryScanRun({ triggeredByUserId: null })`, which already handles the 409 guard and records an audit event. Inject the concrete implementation in `library-module.js` where the apply worker is instantiated.

**Edge cases:**

| Scenario | Expected behavior |
|---|---|
| All candidates failed (`counts.applied === 0`) | No scan triggered — nothing on disk changed |
| Scan already active when apply completes | `scheduleLibraryScan` receives the 409 response and swallows it — the existing scan will process the newly applied files when it runs its `walkDirectory` pass (as long as apply finished before the existing scan reaches the relevant directory) |
| Library root not configured | `startLibraryScanRun` throws its readiness error; swallowed; no scan scheduled |
| Apply cancelled mid-run | `markRunCancelled` is called instead of `markRunCompleted` — auto-scan not triggered |
| Multiple apply runs overlap (rare) | Each run's `scheduleLibraryScan` call races at the library scan service; the first succeeds, the rest receive 409 and are swallowed; single scan covers all applied files from both runs |
| Apply run completes during an active library scan | Newly applied files may not be present in the current scan's walked set. The auto-trigger fires; library scan service returns 409. These files will not be picked up until the next manual or scheduled scan. A future enhancement could queue a follow-on scan when one is already running (deferred). |

**No schema changes required.** The apply worker already tracks `counts.applied` and `counts.appliedWithWarnings`. The library scan service and its run creation are unchanged.

**Testing contract:**
- `scheduleLibraryScan` is called exactly once when `counts.applied > 0`
- `scheduleLibraryScan` is NOT called when all candidates failed
- Any error thrown by `scheduleLibraryScan` does not cause the apply worker to fail or re-throw
- `scheduleLibraryScan` is NOT called after `markRunCancelled` or `markRunFailed`

---

### 5.29 Conventional-Tag File Matching Strategy

**Current gap:** `library-file-matcher-service.js` has two strategies, both of which require MusicBrainz IDs embedded in the audio file's tags:

1. `matchByRecordingId` — requires `tags.musicBrainz.recordingId` to match exactly one `metadata_recordings` row
2. `matchByReleaseTitleAndTrackPosition` — requires `tags.musicBrainz.releaseId` + `track.number` + normalized title

Soulseek peers do not tag files with MusicBrainz IDs. They use conventional ID3/Vorbis tags: artist, album, title, track number. These tags are consistently present in well-tagged Soulseek files, but both matcher strategies exit early when `tags.musicBrainz.*` fields are null. The result: every Soulseek-sourced file lands in `unmatched` state regardless of how accurately tagged it is. `unmatched` files contribute nothing to `library_release_reconciliations`, so no release moves from `partial` to `complete`, and `library-media-request-fulfillment-service.js` never advances the request.

**Why this is the second-highest priority:** This is the universal failure mode for Soulseek-sourced content — the primary source this application is designed to manage. The existing MBID-only strategies were designed for files imported from MusicBrainz-aware taggers (MusicBrainz Picard, beets). Those files are the minority in a Soulseek household. Beets itself falls back to conventional tag matching with weighted distance scoring when MBID strategies fail — this is acknowledged as a mandatory fallback in the music library management literature.

**Strategy design — `matchByConventionalTags`:**

Required inputs (from `normalizedTags`):
- `title` — normalized track title (NFKD, diacritic-stripped, non-alphanumeric replaced with space, lowercase) — **mandatory**
- `track.number` — integer track position — **mandatory**; `null` is not accepted (prevents false positives on untitled or position-less tracks)

Contextual inputs (used when available):
- `albumArtist ?? artist` — normalized artist name
- `album` — normalized album title (used to narrow candidates when artist is ambiguous)

**Matching algorithm — release-scoped then global fallback:**

The strategy runs in two passes:

**Pass 1 — Release-scoped match (when `metadata_release_id` context is available):**

The scan worker has access to `catalogResult.files`. For files that were applied via an import candidate, the file's relative path begins with the candidate's destination folder. The import candidate record carries a `metadata_release_id` link (via `source_search_id → library_discovery_requests.metadata_release_id`). If this association can be threaded through to the scan worker's file list (see "threading" below), the matcher receives a `scopeMetadataReleaseId` parameter and filters `candidates` to only that release's tracks before applying the title+position test. This dramatically reduces false-positive risk: within a single release, track positions are unique, and normalized title matches are almost always correct.

**Pass 2 — Global match (no scope, or scope match failed):**

Without a scope, filter `candidates` to those whose normalized `releaseArtistName` matches the file's `albumArtist ?? artist` (at least one token overlap after normalization — see below). Within this artist-filtered set, require an exact `trackPosition` match AND an exact normalized `trackTitle` match. If exactly one candidate survives, return a `medium` confidence match. If zero candidates survive, return `unmatched`. If more than one candidate survives, return `ambiguous`.

**Normalization for artist matching — token-overlap, not exact:**

Artist names differ between tag sources ("The Beatles" vs "Beatles", "Radiohead" vs "RADIOHEAD"). Use a token-overlap test: split both normalized strings on whitespace into token sets, then check that the token sets share at least one non-trivial token (length ≥ 3). This handles "The" prefix stripping and casing without requiring exact string equality.

```js
function tokensOf(value) {
  const normalized = normalizeText(value);
  if (!normalized) return new Set();
  return new Set(normalized.split(' ').filter((t) => t.length >= 3));
}

function artistTokensOverlap(tagArtist, candidateArtist) {
  const tagTokens = tokensOf(tagArtist);
  const candidateTokens = tokensOf(candidateArtist);
  for (const token of tagTokens) {
    if (candidateTokens.has(token)) return true;
  }
  return false;
}
```

**Title normalization — strip feat./remaster suffixes before comparison:**

Soulseek files frequently embed track titles with credit and edition suffixes that the MusicBrainz canonical title does not contain. Apply a normalizer pass before comparing:

```js
function stripTitleSuffixes(value) {
  // Remove everything after: " (feat.", " [feat.", " - feat.", " (remaster",
  // " (live", " (remix", " (bonus", " (acoustic", " (demo", " (radio"
  return value.replace(
    /\s*[\(\[](feat\.|ft\.|live|remaster|remix|bonus|acoustic|demo|radio)[^\)\]]*[\)\]].*/i,
    '',
  ).replace(/\s*-\s*(feat\.|ft\.).*$/i, '').trim();
}
```

`stripTitleSuffixes` is applied before `normalizeText` in the conventional strategy only — not in the existing strategies (no behavior change to existing paths).

**Confidence level:** `'medium'` — lower than MBID strategies (`'high'`). The evidence block records the strategy name and which signals were used:

```js
buildMatchedResult(candidate, {
  matchedArtist: normalizedArtist,
  matchedTitle: normalizedTitle,
  matchedTrackPosition: trackPosition,
  scopeReleaseId: scopeMetadataReleaseId ?? null,
  strategy: 'conventional_tags',
});
```

**Threading `scopeMetadataReleaseId` through to the matcher:**

The scan worker calls `matchLibraryFiles({ files: catalogResult.files })`. Today `files` carry only filesystem-level fields (`id`, `canonicalPath`, `fileState`, `tagPayload`). To provide a release scope hint without a DB join inside the matcher, add an optional `scopeMetadataReleaseId` field to the file object when the catalog records it.

In `library-module.js`, the apply worker completion path creates import candidates that each carry a `metadata_release_id` (from the discovery request). When the scan worker is invoked post-apply (Section 5.28), it can be provided with a `releaseHints: Map<canonicalPath, metadataReleaseId>` that the scan worker merges into the `catalogResult.files` before calling `matchLibraryFiles`. The matcher receives this as an optional `scopeMetadataReleaseId` per file.

When not called post-apply (i.e., manual scan), `releaseHints` is absent and all files go through Pass 2 only. No behavior change for existing scan paths.

**Updated strategy chain:**

```js
const strategies = [
  matchByRecordingId,
  matchByReleaseTitleAndTrackPosition,
  matchByConventionalTags,          // NEW: third strategy
];
```

`matchByConventionalTags` returns `null` (skip to next) only if both `normalizedTitle` and `trackPosition` are missing — these are the hard prerequisites. If the file has no title tag at all, fall through to `unmatched` as today.

**Edge cases:**

| Scenario | Behavior |
|---|---|
| Track position present but title absent | `matchByConventionalTags` returns `null`; file goes `unmatched` |
| Title present but track position null | `matchByConventionalTags` returns `null`; file goes `unmatched` — position is required to prevent false matches on compilation albums with repeated track titles across releases |
| Multiple releases with same artist + track position + title | Return `ambiguous` (>1 candidate survives after all filters) — this correctly signals that the file cannot be uniquely attributed without more context |
| Release scope provided and exactly one match | `matched` with `confidence: 'high'` (release-scoped is treated as equivalent to MBID confidence — scope is a strong signal) |
| Release scope provided but no match in that release; global pass finds one | Return global match with `confidence: 'medium'` |
| Very common track titles (e.g., "Intro", "Outro", track position 1) without release scope | High ambiguity; likely returns `ambiguous`. Operator can re-tag with MBID to resolve. This is correct — we must not silently misattribute common titles. |
| Artist name mismatch (e.g., "Various Artists" on a compilation) | Token overlap test fails; file goes `unmatched`. Compilations are intentionally out of scope — no reliable conventional-tag matching strategy exists for VA releases without per-track artist matching, which is left for a future enhancement. |
| Non-integer track position (e.g., "A1" on vinyl) | `tags.track.number` is `null` after `music-metadata` parsing; strategy returns `null`; file goes `unmatched`. Vinyl-rip releases are a known limitation. |

**No schema changes required.** The `normalizedTags` object already contains all needed fields (`title`, `track.number`, `artist`, `albumArtist`, `album`). The `loadTrackLookupRows` SQL already fetches `release_artist_name`, `track_position`, `track_title` — everything needed for Pass 2. Pass 1 uses the same `candidates` array filtered by `metadataReleaseId`.

**Testing contract:**
- File with only `title` + `track.number` + `albumArtist` tags (no MBID) → `matched` if unique candidate in Pass 2
- File with scope hint → matched against that release's tracks only in Pass 1
- Title with `(feat. ...)` suffix → suffix stripped before comparison; file matches
- Two releases with same artist + position + title → `ambiguous`
- File with no title tag → passes through to `unmatched` (unchanged existing behavior)
- File with MBID tags → still matched by strategy 1 or 2 first; strategy 3 never called (unchanged)

---

### 5.30 Incremental Tag Re-Extraction (Skip Unchanged Files)

**Current gap:** On every library scan, `extractLibraryFileTags` calls `parseFile(file.canonicalPath)` (via `music-metadata`) for every `observed` file regardless of whether the file has changed since it was last extracted. For a library of 500 albums (≈6000 files), this means 6000 disk reads per scan, even for a scan triggered by a single newly applied album. Each `parseFile` call opens the file, reads its headers, parses tag frames, and closes it — sequential I/O that dominates scan duration on spinning-disk NAS deployments.

The tag extraction service already writes `audio_codec`, `bitrate_kbps`, `bit_depth`, `channels`, `duration_ms`, `tag_payload`, and `sample_rate_hz` into `library_files` on each extraction. These values will not change unless the file itself is replaced or retagged. A file is changed if and only if its `modifiedAt` timestamp or `sizeBytes` has changed since the last extraction.

**Why this is the third-highest priority:** This becomes acutely important once Section 5.28 (auto-scan after every apply run) is implemented. Without incremental extraction, every successful import apply triggers a full re-extraction of the entire library — effectively penalizing the operator for having a large library. The I/O cost scales with library size, not with the amount of new content.

**Design — stamp the extraction on `library_files`:**

Add two new nullable columns to `library_files`:
- `tag_extracted_size_bytes BIGINT NULL` — the `sizeBytes` observed during the most recent successful tag extraction
- `tag_extracted_modified_at TIMESTAMPTZ NULL` — the `modifiedAt` timestamp observed during the most recent successful tag extraction

These are written alongside the existing tag fields in `writeLibraryFileTagSnapshot`. When the scan worker filters files for `extractLibraryFileTags`, it compares:

```
file.sizeBytes === file.tagExtractedSizeBytes
  && file.modifiedAt === file.tagExtractedModifiedAt
  && file.tagPayload !== null
```

If all three conditions hold, the file's tags are unchanged — skip extraction. The existing `tagPayload` (normalized tags) and `audio_codec` etc. remain valid.

**Where the comparison happens — scan worker, not the extraction service:**

The skip decision belongs in `library-scan-worker.js`, not inside `extractLibraryFileTags`. This preserves the extraction service as a pure "extract this set of files" operation. The scan worker already filters files before passing them to each downstream step (e.g., `fileState === 'observed'`):

```js
if (extractLibraryFileTags && catalogResult?.files?.length) {
  const filesToExtract = catalogResult.files.filter((file) => {
    if (file.fileState !== 'observed') return false;
    // Skip re-extraction if the file has not changed since last extraction.
    if (
      file.tagPayload !== null
      && file.tagExtractedSizeBytes !== null
      && file.tagExtractedModifiedAt !== null
      && file.sizeBytes === file.tagExtractedSizeBytes
      && file.modifiedAt === file.tagExtractedModifiedAt
    ) {
      return false;
    }
    return true;
  });
  await extractLibraryFileTags({ files: filesToExtract });
}
```

`catalogResult.files` is returned by `recordLibraryFiles` from `library-catalog-store.js`. The store must return `tagExtractedSizeBytes` and `tagExtractedModifiedAt` alongside the existing returned fields.

**`writeLibraryFileTagSnapshot` update — stamp on successful extraction:**

In `library-tag-snapshot-store.js`, update the `library_files` UPDATE to include the new columns:

```js
await client.query(
  `
    UPDATE library_files
      SET audio_codec                = $2,
          bitrate_kbps               = $3,
          sample_rate_hz             = $4,
          bit_depth                  = $5,
          channels                   = $6,
          duration_ms                = $7,
          tag_payload                = $8::jsonb,
          tag_extracted_size_bytes   = $9,    -- NEW
          tag_extracted_modified_at  = $10,   -- NEW
          file_state                 = 'observed',
          updated_at                 = NOW()
    WHERE id = $1
  `,
  [
    libraryFileId,
    audioCodec,
    toNullableInteger(bitrateKbps),
    toNullableInteger(sampleRateHz),
    toNullableInteger(bitDepth),
    toNullableInteger(channels),
    toNullableInteger(durationMs),
    normalizedTags ? JSON.stringify(normalizedTags) : null,
    sourceSizeBytes ?? null,     // NEW: passed by caller
    sourceModifiedAt ?? null,    // NEW: passed by caller
  ],
);
```

`sourceSizeBytes` and `sourceModifiedAt` are added to `extractLibraryFileTags`'s per-file data (from the catalogResult file object).

**`recordLibraryFiles` update — return the new columns:**

The `RETURNING` clause in the `library_files` upsert must include the new columns:

```sql
RETURNING id, canonical_path, relative_path, filename, extension,
          file_state, tag_payload,
          size_bytes, modified_at,
          tag_extracted_size_bytes, tag_extracted_modified_at   -- NEW
```

The returned object adds:

```js
{
  // ... existing fields ...
  sizeBytes: result.rows[0].size_bytes,
  modifiedAt: result.rows[0].modified_at,
  tagExtractedSizeBytes: result.rows[0].tag_extracted_size_bytes ?? null,
  tagExtractedModifiedAt: result.rows[0].tag_extracted_modified_at ?? null,
}
```

**Important: `ON CONFLICT DO UPDATE` always sets `size_bytes` and `modified_at` to the current scan values.** So after `recordLibraryFiles`, `file.sizeBytes` and `file.modifiedAt` are always the current-scan observed values. The skip condition compares current against the `tagExtracted*` stamp — if they match, extraction is safely skipped.

**Failure mode — extraction fails for a file:**

If `parseFile` throws, `writeLibraryFileTagSnapshot` writes `status: 'error'` and does NOT set `tag_extracted_size_bytes` / `tag_extracted_modified_at`. On the next scan, the failure condition (`file.tagPayload === null`) re-triggers extraction, giving the file another chance. This is correct: a transient I/O failure should not permanently skip a file.

**Skip also gates re-matching:** Once a file's tags are stable (skip condition true), its match result is also stable — the matcher operates on `tagPayload`, which hasn't changed. Add the same skip gate before `matchLibraryFiles`:

```js
if (matchLibraryFiles && catalogResult?.files?.length) {
  const filesToMatch = catalogResult.files.filter((file) => {
    if (file.fileState !== 'observed') return false;
    // Only re-match if the file was just extracted (newly changed or newly added).
    return filesToExtract.includes(file);   // filesToExtract from the extraction step above
  });
  await matchLibraryFiles({ files: filesToMatch });
}
```

This means unchanged-and-already-matched files are not re-matched on every scan. The existing match rows in `library_file_matches` remain valid. `reconcileLibraryReleases` still runs unconditionally after every scan (it is fast and its inputs — `library_file_matches` — only changed for files in `filesToMatch`), so reconciliation is always up to date.

**Invariant:** `tagExtractedSizeBytes` and `tagExtractedModifiedAt` are always both null or both non-null. A partial write is prevented by the transaction in `writeLibraryFileTagSnapshot` (both columns are set in the same `UPDATE` statement inside the same `BEGIN/COMMIT` block).

**Edge cases:**

| Scenario | Behavior |
|---|---|
| New file added to library (never extracted) | `tagExtractedSizeBytes === null` → included in `filesToExtract` |
| File replaced on disk (same path, different content, newer `modifiedAt`) | `modifiedAt` differs → included in `filesToExtract`; extraction runs; stamps updated |
| File re-tagged in-place without touching `modifiedAt` (rare, editor writes without changing mtime) | Skip condition falsely matches; file is not re-extracted. This is a known limitation of mtime-based change detection; it is the same trade-off made by every major media scanner (Plex, Jellyfin, Lidarr). Operator can force a re-scan by touching the file. |
| File deleted from disk | `recordLibraryFiles` sets `deleted_at` for the missing path; the file is excluded from `catalogResult.files` by `fileState`; extraction skip is never evaluated |
| Library freshly initialized (no prior scan, all files have `tagExtractedSizeBytes = NULL`) | All files are extracted on first scan — correct behavior |
| Backfill on existing installs | `tag_extracted_size_bytes` and `tag_extracted_modified_at` are `NULL` on all existing rows until their next scan. The skip condition requires non-null stamps → all files are re-extracted on the first scan after the migration (one-time full scan cost). After that, incremental behavior activates. No backfill query needed; the next scan handles it. |

**Performance characteristics:**

| Library size | Before (every scan) | After (post-first incremental scan) |
|---|---|---|
| 100 albums (~1200 files) | 1200 `parseFile` calls | ~0 calls (only changed files) |
| 500 albums (~6000 files) | 6000 `parseFile` calls | ~0 calls (only changed files) |
| Post-apply scan (1 new album, 12 files) | Full library `parseFile` calls | 12 `parseFile` calls + skip for all others |

On a 7200 RPM HDD NAS (~80ms per file read for a 30MB FLAC), a 6000-file library currently takes ~480 seconds of extraction time. With incremental extraction, a post-apply scan for one new album takes ~1 second of extraction time.

**Migration 6.12** — see Section 6.12 below.

---

### 5.31 UNNEST Batch Upsert in `recordLibraryFiles`

**Current gap:** `recordLibraryFiles` in `library-catalog-store.js` iterates `normalizedFiles` and for each file executes one `INSERT INTO library_files ... ON CONFLICT (canonical_path) DO UPDATE ... RETURNING` statement inside a single `BEGIN/COMMIT` transaction. For a 6,000-file library this is 6,000 individual SQL round-trips. Per Cybertec's PostgreSQL bulk-load benchmark, N individual INSERTs within a single transaction are approximately 16× slower than a batched multi-row insert at equivalent scale. The per-statement cost (query parsing, plan cache lookup, execution setup, and one client→server→client round-trip even over a local Unix socket) accumulates linearly with N regardless of how fast each individual statement is.

**Why this is high priority:** `recordLibraryFiles` is the first step of every library scan. It must complete before tag extraction, matching, reconciliation, and fulfillment can run. For a 6,000-file library, the per-file INSERT loop is the dominant CPU and latency cost of the scan pass even before any audio I/O. After Section 5.28 lands (auto-scan on apply), this path is also hit on every successful import apply run. On a remote PostgreSQL instance with 2 ms RTT, 6,000 individual statements add 12 seconds of pure round-trip latency with zero DB work counted.

**Design: single UNNEST batch upsert**

Replace the `for...of` loop with a single `INSERT ... SELECT ... FROM UNNEST(...)` statement. Each column is passed as a typed PostgreSQL array; the server unnests all arrays in lockstep, producing one row per element. `ON CONFLICT (canonical_path) DO UPDATE` applies the same upsert semantics as the current per-row approach. The `RETURNING` clause returns the same columns as before.

The soft-delete `UPDATE` at the end of the function already uses `ANY($2::text[])` — no change needed there.

**Defensive deduplication:** If two input files share the same `canonical_path` (essentially impossible given `realpath()` in the scan executor, but possible through a caller bug), PostgreSQL raises `ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time`. Guard against this by deduplicating `normalizedFiles` by `canonicalPath` (last-wins) before building the arrays:

```js
// Deduplicate by canonicalPath — defensive measure; duplicates are theoretically
// impossible from the scan executor but may occur in tests or future callers.
const fileMap = new Map(normalizedFiles.map((f) => [f.canonicalPath, f]));
const dedupedFiles = [...fileMap.values()];
```

**Code location:** `src/server/library/library-catalog-store.js`, function `recordLibraryFiles`. Replace the per-file `client.query` loop with:

```js
// Build parallel arrays for UNNEST
const canonicalPaths  = dedupedFiles.map((f) => f.canonicalPath);
const relativePaths   = dedupedFiles.map((f) => f.relativePath);
const filenames       = dedupedFiles.map((f) => f.filename);
const extensions      = dedupedFiles.map((f) => f.extension);
const sizesBytes      = dedupedFiles.map((f) => f.sizeBytes);
const modifiedAts     = dedupedFiles.map((f) => f.modifiedAt ?? null);
const fileStates      = dedupedFiles.map((f) => f.fileState);

let persistedFiles = [];

if (dedupedFiles.length > 0) {
  const batchResult = await client.query(
    `
      INSERT INTO library_files (
        library_root_id, canonical_path, relative_path, filename,
        extension, size_bytes, modified_at, file_state, updated_at, deleted_at
      )
      SELECT
        $1::uuid,
        t.canonical_path, t.relative_path, t.filename, t.extension,
        t.size_bytes::bigint, t.modified_at::timestamptz, t.file_state,
        NOW(), NULL
      FROM UNNEST($2::text[], $3::text[], $4::text[], $5::text[],
                  $6::bigint[], $7::timestamptz[], $8::text[])
        AS t(canonical_path, relative_path, filename, extension,
             size_bytes, modified_at, file_state)
      ON CONFLICT (canonical_path) DO UPDATE
      SET library_root_id = EXCLUDED.library_root_id,
          relative_path   = EXCLUDED.relative_path,
          filename        = EXCLUDED.filename,
          extension       = EXCLUDED.extension,
          size_bytes      = EXCLUDED.size_bytes,
          modified_at     = EXCLUDED.modified_at,
          file_state      = EXCLUDED.file_state,
          updated_at      = NOW(),
          deleted_at      = NULL
      RETURNING id, canonical_path, relative_path, filename, extension, file_state, tag_payload
    `,
    [libraryRootId, canonicalPaths, relativePaths, filenames,
     extensions, sizesBytes, modifiedAts, fileStates],
  );

  persistedFiles = batchResult.rows.map((row) => ({
    canonicalPath: row.canonical_path,
    extension:     row.extension,
    fileState:     row.file_state,
    filename:      row.filename,
    id:            row.id,
    relativePath:  row.relative_path,
    tagPayload:    row.tag_payload,
  }));
}
```

**Chunking for very large libraries:** Research recommends chunking UNNEST batches above 10,000 rows to bound server-side memory allocation. At a practical maximum of ~50,000 audio files per library root, add application-side chunking at 5,000 files per batch (all chunks run inside the same transaction). For Harmoniarr's typical library size (500–6,000 files), a single batch is the normal path.

**Section 5.30 compatibility:** When migration 6.12 lands, add `size_bytes, modified_at, tag_extracted_size_bytes, tag_extracted_modified_at` to the RETURNING clause. The UNNEST query is structurally compatible with any RETURNING extension.

**Edge cases:**

| Scenario | Behavior |
|---|---|
| `normalizedFiles` is empty | Dedup map has no entries; `dedupedFiles` is empty; INSERT is skipped entirely. Soft-delete UPDATE marks all existing files as deleted (correct: no files observed = all removed). |
| Two input files with the same `canonical_path` | Deduplicated before UNNEST; last value wins (same as current per-file loop where the last iteration wins on the conflict update). |
| `modifiedAt` is `null` | The `timestamptz[]` array contains a null element; PostgreSQL unnests it as SQL `NULL`. Compatible with the `modified_at TIMESTAMPTZ NULL` column definition. |
| Library root not yet present in `library_roots` | Root upsert runs before the file batch in the same transaction; root ID is available. Unchanged behavior. |
| N > 5,000 files | Chunked into batches of 5,000; each chunk is a separate UNNEST INSERT within the same transaction. RETURNING rows are accumulated across chunks. |

**No schema changes required.** The table structure, UNIQUE constraint on `canonical_path`, and all indexes are unchanged.

**Testing contract:**
- `recordLibraryFiles` with N files executes exactly 3 SQL statements (root upsert, one UNNEST INSERT, one soft-delete UPDATE) for any N ≤ 5,000; adds one additional UNNEST INSERT per 5,000-file chunk above that threshold.
- RETURNING output is structurally identical to the current per-file output (same field names, same row count).
- Empty input: no UNNEST INSERT issued; all existing files for the root are soft-deleted.
- Duplicate canonical_path in input: deduplicated before UNNEST; one row in the output.

---

### 5.32 UNNEST Batch Flush in `matchLibraryFiles`

**Current gap:** `matchLibraryFiles` in `library-file-matcher-service.js` iterates all files in an in-memory loop, resolves each file's match result, and immediately calls `libraryFileMatchStore.writeLibraryFileMatch(...)` for every file. Each call to `writeLibraryFileMatch` checks out a pool connection, executes a single `INSERT INTO library_file_matches ... ON CONFLICT (library_file_id) DO UPDATE`, and releases the connection. For 6,000 files this is 6,000 pool checkout/query/release cycles — all sequential and serialized by `await`. The match computation itself is in-memory and fast; only the write loop is expensive.

**Why this is high priority:** `matchLibraryFiles` runs inside `library-scan-worker.js` on every scan, after tag extraction. On a library of 6,000 files with a co-located PostgreSQL instance, 6,000 sequential `pool.query` calls add seconds of overhead from pool checkout latency and per-statement round-trips even before any DB execution time is counted. On a remote PostgreSQL instance, the overhead grows proportionally with RTT. Unlike the extraction step (which Section 5.30 gates with a skip guard), the match write loop has no incremental optimization before this fix.

Note: Section 5.30 adds a skip gate before `matchLibraryFiles` so that unchanged files are not re-matched. After 5.30 lands, a post-apply scan for a new album only matches the small set of newly extracted files. However, the first scan after a fresh install, the first scan after the 5.30 migration (all files lack extraction stamps), and any full rescan still run the write loop for all N files. This section provides the needed fix for those paths.

**Design: accumulate in-memory, flush with a single UNNEST INSERT**

Modify `matchLibraryFiles` to push each resolved `{ libraryFileId, ...result }` object into a local array during the loop, then call a new `writeLibraryFileMatchBatch` function once after the loop. The batch function uses `INSERT INTO library_file_matches (...) SELECT ... FROM UNNEST(...)` with `ON CONFLICT (library_file_id) DO UPDATE`.

Since `library_file_matches` has UNIQUE on `library_file_id`, and each file appears at most once in the scan's file list, there are no intra-batch key conflicts. The `ON CONFLICT DO UPDATE` clause only arbitrates between an incoming row and an existing table row (a previous scan's result), never between two rows within the same batch insert. No deduplication of input is required.

Null FK values (for `unmatched` results where `metadataArtistId` etc. are absent) are handled correctly: `$1::uuid[]` with a null element in the JavaScript array becomes SQL NULL in the UNNEST output, which is correct for the nullable FK columns.

**Code changes:**

1. In `library-file-match-store.js`: add `writeLibraryFileMatchBatch({ matches })` alongside the existing `writeLibraryFileMatch`. The existing single-file function is retained for standalone use in tests and future on-demand matching scenarios.

2. In `library-file-matcher-service.js`: collect results into a `matchResults` array during the loop; call `libraryFileMatchStore.writeLibraryFileMatchBatch({ matches: matchResults })` after the loop completes.

```js
// library-file-match-store.js — new batch write function
async function writeLibraryFileMatchBatch({ matches }) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return;
  }

  const pool = getPoolFn();
  await pool.query(
    `
      INSERT INTO library_file_matches (
        library_file_id,
        metadata_artist_id, metadata_release_group_id, metadata_release_id,
        metadata_medium_id, metadata_track_id, metadata_recording_id,
        match_status, confidence, matched_by, evidence,
        matched_at, updated_at
      )
      SELECT
        t.library_file_id::uuid,
        t.metadata_artist_id::uuid,
        t.metadata_release_group_id::uuid,
        t.metadata_release_id::uuid,
        t.metadata_medium_id::uuid,
        t.metadata_track_id::uuid,
        t.metadata_recording_id::uuid,
        t.match_status,
        t.confidence,
        t.matched_by,
        t.evidence::jsonb,
        NOW(),
        NOW()
      FROM UNNEST(
        $1::uuid[],  $2::uuid[], $3::uuid[], $4::uuid[],
        $5::uuid[],  $6::uuid[], $7::uuid[],
        $8::text[], $9::text[], $10::text[], $11::text[]
      ) AS t(
        library_file_id,
        metadata_artist_id, metadata_release_group_id, metadata_release_id,
        metadata_medium_id, metadata_track_id, metadata_recording_id,
        match_status, confidence, matched_by, evidence
      )
      ON CONFLICT (library_file_id) DO UPDATE
      SET metadata_artist_id        = EXCLUDED.metadata_artist_id,
          metadata_release_group_id = EXCLUDED.metadata_release_group_id,
          metadata_release_id       = EXCLUDED.metadata_release_id,
          metadata_medium_id        = EXCLUDED.metadata_medium_id,
          metadata_track_id         = EXCLUDED.metadata_track_id,
          metadata_recording_id     = EXCLUDED.metadata_recording_id,
          match_status              = EXCLUDED.match_status,
          confidence                = EXCLUDED.confidence,
          matched_by                = EXCLUDED.matched_by,
          evidence                  = EXCLUDED.evidence,
          matched_at                = NOW(),
          updated_at                = NOW()
    `,
    [
      matches.map((m) => m.libraryFileId),
      matches.map((m) => m.metadataArtistId        ?? null),
      matches.map((m) => m.metadataReleaseGroupId  ?? null),
      matches.map((m) => m.metadataReleaseId        ?? null),
      matches.map((m) => m.metadataMediumId         ?? null),
      matches.map((m) => m.metadataTrackId          ?? null),
      matches.map((m) => m.metadataRecordingId      ?? null),
      matches.map((m) => m.matchStatus),
      matches.map((m) => m.confidence),
      matches.map((m) => m.matchedBy),
      matches.map((m) => m.evidence ? JSON.stringify(m.evidence) : null),
    ],
  );
}
```

```js
// library-file-matcher-service.js — modified matchLibraryFiles
async function matchLibraryFiles({ files }) {
  const candidates = await loadTrackLookupRows();
  const matchResults = [];                        // NEW: accumulator

  for (const file of files) {
    if (file.fileState !== 'observed') {
      continue;
    }

    const normalizedTags = file.tagPayload ?? null;
    if (!normalizedTags) {
      matchResults.push({                         // accumulate instead of await write
        confidence: 'low',
        evidence: { reason: 'missing_tag_payload' },
        libraryFileId: file.id,
        matchStatus: 'unmatched',
        matchedBy: 'missing_tag_payload',
      });
      continue;
    }

    const result = resolveMatchResult({ candidates, normalizedTags });
    matchResults.push({ ...result, libraryFileId: file.id }); // accumulate
  }

  await libraryFileMatchStore.writeLibraryFileMatchBatch({ matches: matchResults }); // ONE write
}
```

**Edge cases:**

| Scenario | Behavior |
|---|---|
| `files` is empty | `matchResults` is empty; `writeLibraryFileMatchBatch` receives an empty array and returns immediately without issuing any SQL. |
| All files have `fileState = 'ignored'` | No entries pushed to `matchResults`; batch write skipped. |
| File has no `tagPayload` | An `unmatched` result with `matchedBy: 'missing_tag_payload'` is pushed to the accumulator with all FK fields null. Included in the batch write. |
| `metadataArtistId` is null (unmatched / ambiguous result) | Null values in the `uuid[]` arrays are correctly mapped to SQL NULL by PostgreSQL's UNNEST. All FK columns are nullable in the schema. |
| 6,000 files | One UNNEST INSERT with 6,000 rows. At ~200 bytes per match record, ~1.2 MB total — well within safe UNNEST limits before chunking is needed. |
| Section 5.30 skip gate active | `matchLibraryFiles` only receives files that failed the skip gate. The accumulator may have far fewer entries; batch write handles any size including 1 row. |
| Section 5.29 conventional-tag strategy added | Additional matches are included in `matchResults` with `confidence: 'medium'`. Identical batch write path; no change to `writeLibraryFileMatchBatch`. |

**No schema changes required.** `library_file_matches` is unchanged.

**Testing contract:**
- `matchLibraryFiles` with N files executes exactly 2 SQL statements regardless of N: `loadTrackLookupRows` SELECT + one `writeLibraryFileMatchBatch` INSERT (or 1 statement if all files are ignored / empty list).
- Match results written to the DB are semantically identical to the current per-file write path.
- `writeLibraryFileMatch` (single-file function) is retained and continues to work independently.
- Empty file list → `writeLibraryFileMatchBatch` is called with an empty array → no SQL executed.
- Null FK values in unmatched results → NULL values in the corresponding `library_file_matches` columns.

---

### 5.33 Missing Compound Index on `operation_runs` for Active and Latest Run Lookups

**Current gap:** `operation_runs` has one index today: `operation_runs_running_recovery_idx` (migration `20260501_000017`), a partial index `WHERE status = 'running'` ordered `(started_at ASC, created_at ASC)`. This index was added to support `operation-stranded-run-recovery-service.js`, which scans for old running jobs. Two entirely separate hot query paths in `operation-run-store.js` are not served by this index:

- `getActiveRun()`: `WHERE operation_type = $1 AND status IN ('pending', 'running') ORDER BY started_at DESC LIMIT 1`
- `getLatestRun()`: `WHERE operation_type = $1 ORDER BY started_at DESC LIMIT 1`

The recovery index fails both queries on three grounds: it has no `operation_type` column (so the planner cannot use it for the equality prefix), it uses ascending sort (these queries need descending), and for `getActiveRun()` it misses `status = 'pending'`. Both queries perform a full sequential scan on `operation_runs` on every execution.

**Why this is high priority:** These two functions are called in multiple hot paths simultaneously:

- Every HTTP GET to any `operations/*/active` or `operations/*/latest` endpoint — used by the frontend to render live run state (polled on a 3–5 second interval in the UI).
- Every worker startup, which calls `getActiveRun()` to detect a concurrent run before acquiring its job lease.
- Every background-job health-service poll (runs continuously while the server is up).
- Every cancel-request endpoint, which calls `getActiveRun()` to resolve the target run ID.

The `operation_runs` table is never pruned — every completed, failed, and cancelled run persists forever. At 10 run cycles per day across 7+ operation types, the table accumulates thousands of rows per month. The `operation_type = $1` filter is highly selective (1–5 rows typically match `'pending'` or `'running'` per type), but without an index the planner reads every row to apply the filter.

**Design: single non-partial index `(operation_type, started_at DESC)`**

Per PostgreSQL documentation §11.8 and independent benchmarks (Cybertec, QueryPlane), the optimal index for a `WHERE col = $1 ORDER BY ts DESC LIMIT 1` query is `(col, ts DESC)` — equality predicate first, then the sort column in the query's sort direction. This structure allows the planner to seek directly to the `operation_type` prefix and read at most one row for `LIMIT 1` queries without a sort step.

A partial index `WHERE status IN ('pending','running')` would produce a slightly smaller index (excluding completed/failed rows) and could be matched by `getActiveRun()` since the query text uses literal status values (`status IN ('pending', 'running')` as constants, not bind parameters). However, a partial index cannot serve `getLatestRun()`, which has no status predicate. Creating two indexes — one partial for active, one non-partial for latest — adds maintenance overhead for no practical gain at Harmoniarr's row counts. A single non-partial `(operation_type, started_at DESC)` index serves both queries correctly with one structure.

**Important note on partial index planning:** Per PostgreSQL documentation §11.8, partial index predicates are only matched when the query's WHERE clause implies the predicate at planning time, using literal constant values. Parameterized clauses (`WHERE status = $2`) are never matched. Both `getActiveRun()` and `getLatestRun()` pass `operation_type` as a bind parameter ($1) — this is fine and does not affect whether the partial predicate is matched, because the partial predicate would be on `status`, which is a literal in `getActiveRun()`.

**Code location:** No application code changes required. This is a migration-only change.

**Migration 6.13** — see Section 6.13 below.

**Edge cases:**

| Scenario | Behavior |
|---|---|
| Multiple `'pending'` or `'running'` runs for the same type | `getActiveRun()` returns the newest by `started_at DESC`. This is already the intended behavior (the lease mechanism prevents true concurrent runs; pending runs are enqueued). |
| `operation_runs` has 0 rows for a given type | Index scan returns immediately with 0 rows; no table scan. Correct behavior for workers checking if a run exists before starting. |
| New operation types added in future | The non-partial index covers all `operation_type` values automatically; no index update required. |
| `started_at` tie (two runs share the same microsecond timestamp) | The query's secondary sort `created_at DESC` acts as tiebreaker. The index does not cover `created_at`, so the planner may emit a minor sort step for ties. Ties are functionally impossible (microsecond timestamps + separate INSERT statements); the behavior is a no-op in practice. |
| `CREATE INDEX` lock during migration | Plain `CREATE INDEX` takes a ShareLock (blocks concurrent writes for the build duration). The migration runner applies migrations at startup before traffic is served, making the lock acceptable. `CREATE INDEX CONCURRENTLY` cannot be used because the migration runner wraps every migration in a `BEGIN/COMMIT` transaction, which is incompatible with `CONCURRENTLY`. |
| Existing recovery index untouched | `operation_runs_running_recovery_idx` (`WHERE status = 'running'` ordered by `started_at ASC`) serves the stranded-run recovery query and is preserved unchanged. The two indexes serve different access patterns with no redundancy. |

**Testing contract:**
- After migration, `EXPLAIN (ANALYZE)` on both `getActiveRun()` and `getLatestRun()` queries shows `Index Scan using operation_runs_type_started_idx` (not `Seq Scan`).
- `getActiveRun()` continues to return the most recent pending/running row for the given type, or null if none exists.
- `getLatestRun()` continues to return the most recent row for the given type regardless of status, or null if none exists.
- Existing recovery index is present and unchanged after migration.

