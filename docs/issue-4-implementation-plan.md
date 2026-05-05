# Issue #4 — Full App Re-scope: Harmoniarr as a Media Consumption App

## Status: Not Started

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

**Step 1 — Not Started:** Navigation & shell — redesign `AppShell.vue` with two distinct nav configurations. Requester nav: Home, Discover, My Requests, Account. Operator nav: Home, Discover, Missing, Activity, Settings (Settings absorbs all operator sub-items). Remove the placeholder global search input from the topbar or wire it to real search.

**Step 2 — Not Started:** Home page — artwork-first artist card grid. Monitored artists displayed as cards with cover art (local first, MusicBrainz CAA fallback). Click an artist card → expands or navigates to their missing releases. Cold-start state (no monitored artists) surfaces the Discover CTA prominently.

**Step 3 — Not Started:** Taste-seeding wizard — new `DiscoverView.vue`. Open-ended graph flow: user types or picks a seed artist → related artists surface as cards (MusicBrainz relationships + Last.fm/ListenBrainz) → user picks from related → more related surfaces, narrowing toward their taste → user clicks "Done" to exit. Each pick = monitoring that artist. Re-enterable from "Discover" nav item at any time. First-run: auto-shown after onboarding completes if no artists are monitored.

**Step 4 — Not Started:** External similarity service integration — investigate Last.fm and ListenBrainz artist similarity APIs. Add a server-side route that proxies similar-artist lookups (to avoid CORS and allow caching). Decide which service to use based on rate limits, data quality, and auth requirements.

**Step 5 — Not Started:** Artwork infrastructure — wire MusicBrainz Cover Art Archive (CAA) as a fallback artwork source for artist and release cards. Local stored artwork takes precedence. Add a shared `<ArtworkImage>` component that handles load → fallback → placeholder progression.

**Step 6 — Not Started:** "My Requests" screen — request history and fulfillment status. The home page IS where you request music (search → card → request). `RequestMusicView.vue` becomes a read-only status view: artwork cards of what you've requested, current fulfillment state (Pending, Downloading, Fulfilled, Failed), with a cancel action where applicable. No request intake form here.

**Step 7 — Not Started:** Search screen — update `SearchView.vue` to artwork-first card results for both artist and release search. Replace the current text-list output with album art cards and artist cards consistent with the rest of the redesign.

**Step 8 — Not Started:** Missing/Wanted screen — update `MissingView.vue` to visual card grid instead of table. Group by artist or by release type. Each card shows artwork + missing release info + request action.

**Step 9 — Not Started:** Multi-user awareness pass — request attribution (who requested what) shown on request cards throughout. `ActivityUsersView.vue` updated to surface per-user request activity. Operator home page shows all-users activity summary.

**Step 10 — Not Started:** Responsive & mobile — card grids collapse to single-column on narrow viewports. Sidebar collapses to a bottom nav or hamburger on mobile. All touch targets meet minimum size requirements.

**Step 11 — Not Started:** Release Radar — "New this week from artists you monitor." Server-side job scans MusicBrainz for recent releases (last 30 days) from all monitored artists. Surfaces as a dedicated section on the home page above the full artist grid: horizontal scroll strip or top-of-grid section. Each card has a one-click Request button. Requires a scheduled job and a new server route.

**Step 12 — Not Started:** Activity feed — household-level stream of recent events: requests submitted, downloads completed, new releases added to the library. Visible to all users. Shows who did what. Makes the app feel like a shared space rather than an isolated tool. New `ActivityFeedView.vue` or inline panel on the home page.

**Step 13 — Not Started:** Cross-user deduplication — if two users request the same release, one Soulseek search and download serves both. The server detects duplicate requests (by `musicbrainz_release_id` or artist+title match) and links them to the same download job. Both users see the request as fulfilled when the download completes. Requires schema change on `media_requests`.

**Step 14 — Not Started:** "Coming Soon" watchlist — MusicBrainz has announced release dates for upcoming albums. When monitoring an artist, the app checks for releases with a future date and surfaces them as "Coming Soon" cards. User can pre-request; the request stays pending until the release date passes. Requires a scheduled MusicBrainz check per monitored artist.

**Step 15 — Not Started:** Per-user format/quality preferences — each user can set a preferred format (FLAC, MP3 320, MP3 V0, any) and minimum quality floor. Soulseek search filters and ranks results accordingly per requester. Stored in user settings. Operator can set a system-wide default.

**Step 16 — Not Started:** Download result scoring — rank Soulseek search results automatically before queuing: format, bitrate, completeness (track count vs. expected), uploader reputation (past success rate). Reduce the frequency of manual import review by surfacing the best candidate first. Requires scoring logic in the search/queue pipeline.

**Step 17 — Not Started:** PWA — Progressive Web App manifest + service worker. Add to home screen on mobile, push notifications ("Your request for [album] is ready"). No app store, no native code. Requires a `manifest.webmanifest`, icons, and a notification delivery mechanism (Web Push API + server-side push subscription management).

**Step 18 — Not Started:** Artist detail page — new `ArtistDetailView.vue` at `/app/artists/:id`. Full discography card grid (grouped by type: Albums, EPs, Singles, Other). Each release card shows its acquisition state: Owned, Missing, Requested, Coming Soon. Bio excerpt from MusicBrainz. Related artists strip (from the similarity route). Monitoring toggle. All actions available from the home page card are also available here, in richer context.

**Step 19 — Not Started:** Release detail modal — before requesting a release, show a modal with tracklist (from MusicBrainz), label, year, format, and any existing request state. A "Request" button inside the modal confirms. Same pattern as Overseerr's content detail overlay. Replaces the current inline request action for any search/card context where the user might want to confirm before requesting.

**Step 20 — Not Started:** Library view — new `LibraryView.vue` at `/app/library`. Artwork-first grid of fully acquired artists and releases. Celebrates what you have, not just what you're missing. Sourced from the existing metadata + library state. Toggle between artist view (grouped) and release view (flat grid). Filter by format, year, genre.

**Step 21 — Not Started:** Album art color extraction — extract the dominant color from each card's artwork and apply it as a subtle CSS variable (`--card-accent`) on that specific card. Used as a card border tint or inner glow. Runs client-side via `canvas.getContext('2d')` after `ArtworkImage.vue` loads. Makes each card visually distinct and the grid feel alive rather than uniform.

**Step 22 — Not Started:** Rich empty states — design intentional, on-brand empty state components for: Discover (no seeds yet), Missing (library is complete), My Requests (no requests yet), Library (empty library). Each has a headline, a brief explanation of what should be here, and a contextual CTA. No screen should show a blank or a bare "No items found" message.

**Step 23 — Not Started:** Global toast/snackbar system — a single `<ToastStack>` component mounted in `AppShell.vue`, driven by a composable (`useToast`). Every action in the app — monitor, request, cancel, error — calls `toast.success()` or `toast.error()` rather than setting inline state. Consistent feedback across all screens without per-component state management.

**Step 24 — Not Started:** Filter and sort controls on card grids — a `<GridControls>` component reused on the home page, Missing screen, Library view, and My Requests. Sort options: name (A–Z), missing count, date monitored, release date. Filter options: type (Albums, EPs, Singles), format (FLAC only, any), monitored status. State persisted to `localStorage` per view.

**Step 25 — Not Started:** System-aware dark/light theme — the design system already uses CSS custom properties. Add a light theme variable set (`[data-theme="light"]`). Default to `prefers-color-scheme`. Add a manual override toggle in Settings → Account (stored in `user_preferences` JSONB). No third-party theme library needed.

---

### Current State Snapshot (Existing Infrastructure)

The current app is an operator control plane. Every screen — dashboard, activity, missing, search, settings — is oriented around system administration, not the act of enjoying or requesting music. The requester experience is a single isolated page (`RequestMusicView.vue`) bolted onto a nav designed for admins.

The following foundations already exist and will carry forward into the redesign:

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

**Recommendation: ListenBrainz.** Uses MusicBrainz IDs natively, no API key required, actively maintained, and architecturally consistent with the rest of the metadata stack. Last.fm is a viable fallback if ListenBrainz coverage proves insufficient for niche genres.

Required server route: `GET /api/v1/metadata/artists/:id/similar` — proxies ListenBrainz (or Last.fm), caches response per artist ID, returns `[{ id, name, score }]`.

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

### Decision 4: ListenBrainz for Similarity, MusicBrainz Relationships as Supplement

ListenBrainz uses MusicBrainz IDs natively, requires no API key, and is maintained by the same MetaBrainz foundation — architecturally consistent with the rest of the metadata stack. MusicBrainz artist relationships (influenced-by, member-of, collaboration) supplement ListenBrainz with structural connections ListenBrainz may not surface. The server proxy (`/api/v1/metadata/artists/:id/similar`) merges both sources, deduplicates, and ranks by combined signal.

### Decision 5: Artwork Source — Local First, MusicBrainz CAA Fallback

`ArtworkImage.vue` attempts local stored artwork first (served from the metadata store via a dedicated API route). If absent, it fetches from the MusicBrainz Cover Art Archive using the release group MBID. If CAA returns 404 or fails, a placeholder SVG is shown. The placeholder is styled to match the card grid proportions so layout never breaks.

### Decision 6: Operator Items Move Into Settings, Not Behind a Role Toggle

All operator-facing controls (library scan, reconciliation, discovery runs, artwork maintenance, import review, job queue, user management, recovery) live under `/app/settings` sub-routes. The top-level "Activity" nav item becomes an operator-only entry point for monitoring the system state — it is not hidden from operators, it is just no longer the default destination. Requesters never see it.

### Decision 7: Requester Home Page = Their Monitored Artists

The home page for a requester is their own monitored artist card grid. It answers: "what artists do I care about, and what am I still missing?" The operator home page adds a system-state summary below the card grid. The card grid is identical between roles — everyone sees the same music-first view.

---

## 5. Proposed Changes by Screen

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

### 5.2 `DashboardView.vue` — Artwork-First Home Page

Layout (top to bottom):
1. **Monitored artist card grid** — `fetchMonitoredArtists()` or `searchLocalMetadataArtists({ monitored: true })`. Each card: `ArtworkImage` + artist name + missing-release count badge. Click → expands inline to show missing releases for that artist as release cards.
2. **Cold-start state** (v-if no monitored artists) — full-width card with CTA: "Discover artists to monitor → [Start Discover]". Routes to `discover`.
3. **Onboarding panel** (v-if issues exist) — `OnboardingSummaryPanel`, below the card grid.
4. **Stats row** (operator only, v-if operator role) — request counts, download status.
5. **Active downloads strip** (operator only) — top 5 in-progress downloads.

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
3. Suggestions render as artwork cards. Each card: artist art + name + "Monitor" button (or "Monitored" badge)
4. Pick from suggestions → same loop: monitor + add to seeds + re-fetch similar for new pick + merge
5. "Done" button at any point → navigate to `dashboard`
6. Suggestions narrow toward the intersection of all seeds' similar-artist sets

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

API keys: ListenBrainz requires no key for read-only endpoints. Last.fm requires an API key if used as fallback (stored in server environment config, not exposed to client).

### 5.6 `MissingView.vue` — Card Grid

Replace the `hx-table` with an `hx-artwork-grid` card layout. Each release card: `ArtworkImage` + artist name + release title + year + Request button (if not already requested). Group by artist with collapsible artist headers. Preserve existing `useLibraryWantedReleases` composable as the data source.

### 5.7 `SearchView.vue` — Artwork-First Results

Replace text-list results with `hx-artwork-grid`. Artist search results: artist cards (no release art, just a generated initial/placeholder). Release search results: release cards with CAA artwork. Keep the mode toggle (Artist / Release). Each card carries the same Monitor/Request action as the home page and Discover screen.

### 5.8 Release Radar — Server Job + Home Page Section

New scheduled job (`releaseRadarJob`) runs daily. For each monitored artist, queries MusicBrainz for release groups with `first-release-date` within the last 30 days. Stores results in `release_radar_cache` table. New server route: `GET /api/v1/library/release-radar` → returns recent releases across all monitored artists, sorted by release date descending.

Home page: renders a "New Releases" horizontal strip above the main artist grid when `releaseRadar.length > 0`. Each card: `ArtworkImage` + artist name + release title + release date + Request button (cross-referenced against existing requests). Strip is hidden if no recent releases exist.

### 5.9 Activity Feed

New `ActivityFeedView.vue` or inline panel. Sourced from a new server route `GET /api/v1/activity/feed` that returns a unified event stream: `request_created`, `download_completed`, `release_added`, `artist_monitored`. Each event has `userId`, `userName`, `entityType`, `entityTitle`, `timestamp`. Client polls at 30 s. Events render as a compact list: avatar/icon + description + relative timestamp. Operators see all events; requesters see their own plus download completions.

### 5.10 Cross-User Deduplication

On `POST /api/v1/library/media-requests`, the server checks for an existing active request matching the same `musicbrainz_release_id` (if present) or `artistName + releaseTitle`. If found, the new request is linked to the existing download job (`linked_request_id` FK on `media_requests`). The download serves both. Both users see fulfillment when the single download completes. Requires `linked_request_id` column and `musicbrainz_release_id` on `media_requests`.

### 5.11 Per-User Format/Quality Preferences

New `user_preferences` table (or JSON column on `users`). Fields: `preferredFormat` (enum: `flac`, `mp3-320`, `mp3-v0`, `any`), `minimumBitrate` (integer, nullable). Exposed via `GET/PUT /api/v1/users/me/preferences`. In Settings → Account, a preferences panel lets the user set their floor. Soulseek search queries attach the requesting user's preferences as filter constraints.

### 5.12 Download Result Scoring

Scoring function applied to Soulseek search results before queuing. Inputs: format (FLAC > MP3 320 > MP3 V0 > other), bitrate (higher = better up to format ceiling), track count match (result track count vs. MusicBrainz expected count), file size plausibility, uploader prior success rate (ratio of completed imports from this user). Returns a score 0–100. Results sorted by score descending; top result auto-queued, others surfaced in import review.

### 5.13 PWA

Add `public/manifest.webmanifest` with app name, icons (192px + 512px), `start_url: /app`, `display: standalone`, `theme_color`. Register a service worker (`/sw.js`) for offline shell caching. Implement Web Push: server generates VAPID keys, stores push subscriptions (`user_push_subscriptions` table), sends push notifications on `download_completed` and `request_fulfilled` events via the Web Push API. Client: `Notification.requestPermission()` prompt in Settings → Account after login.

### 5.14 `ArtistDetailView.vue` — New Screen

New view at `/app/artists/:id`. Layout (top to bottom): hero row (large artist artwork + name + monitoring toggle + related-artists strip), then a discography card grid (grouped by type: Albums, EPs, Singles, Other). Each release card shows acquisition state via a pill: Owned, Missing, Requested, or Coming Soon. Release cards are clickable (→ release detail modal, Step 5.15). A "Related Artists" strip at the bottom of the page uses the similarity route data. Route is accessible to both requesters and operators. Nav breadcrumb: `Home → Artist Name`.

### 5.15 Release Detail Modal — `ReleaseDetailModal.vue`

Modal component used wherever a release card appears in the app (home page, Missing screen, Search, Library). Props: `releaseGroupMbid`, `releaseTitle`, `artistName`. On open: fetches tracklist and release metadata from MusicBrainz (`/api/v1/metadata/releases/:mbid`). Displays: large artwork, title, artist, year, label, track count, runtime, tracklist table, current request state. Action button: Request (if not requested), Cancel Request (if pending), or status badge (Downloading, Owned). Dispatches the same `createMediaRequest` flow as the inline button.

### 5.16 `LibraryView.vue` — Owned Music Screen

New view at `/app/library`. Artwork-first grid of fully acquired releases (status = `owned`/`complete` from the library model). Toggle between artist grouping (card-per-artist with album count) and release-flat (card-per-release). Sort: by artist name, by date acquired, by release year. Filter: by format (FLAC, MP3, other), by year range, by genre (if available from metadata). Empty state: "Your library is empty. Request some music to get started." Accessible to both roles.

### 5.17 Album Art Color Extraction — `useArtworkColor` Composable

Composable `useArtworkColor(imgElement)` — takes a loaded `<img>` DOM element reference, draws it to an offscreen canvas, samples the center region for dominant color, returns a CSS hex string. `ArtworkImage.vue` exposes the loaded `imgElement` via a ref. Each card component calls `useArtworkColor` after art loads and sets `--card-accent: <hex>` as an inline CSS variable on the card root. Card CSS uses `--card-accent` for a 1px inset border glow or a subtle radial gradient behind the artwork. Falls back to `--hx-accent-strong` if extraction fails.

### 5.18 Rich Empty States — `EmptyState.vue`

New shared component `EmptyState.vue`. Props: `title`, `body`, `ctaLabel`, `ctaTo` (router-link target). Used on: Discover (no seeds: "Start with an artist you love"), Missing (library complete: "Nothing missing. Library is up to date."), My Requests (no requests: "You haven't requested anything yet."), Library (empty library: "Your library is empty."), Activity feed (no events: "No recent activity."). Each instance is visually distinct via a slot-based icon, not generic. Replaces all bare `hx-empty` text strings.

### 5.19 Global Toast System — `useToast` + `<ToastStack>`

Composable `useToast()` exposes: `toast.success(message)`, `toast.error(message)`, `toast.info(message)`. `<ToastStack>` is mounted once in `AppShell.vue` — listens via a shared reactive queue, renders toasts as a fixed-position stack (bottom-right on desktop, bottom-center on mobile). Toasts auto-dismiss after 4 s. Errors persist until dismissed. All existing inline success/error state in individual views is replaced with `toast.*` calls. No global state store required — a module-level `ref` array is sufficient.

### 5.20 `<GridControls>` — Filter and Sort Bar

Reusable component `GridControls.vue`. Props: `sortOptions` (array of `{ value, label }`), `filterGroups` (array of `{ key, label, options[] }`). Emits: `sort-change`, `filter-change`. Used on: home page artist grid, Missing screen, Library view, My Requests. Renders as a single toolbar row above the card grid — sort dropdown on the left, filter pills on the right. On mobile, collapses to a "Filter & Sort" button that opens a bottom sheet. State is stored in `localStorage` per view key. No server-side filtering needed in v1 — filter/sort operates on the already-fetched data.

### 5.21 Dark / Light Theme

New CSS variable set at `[data-theme="light"]` in `design-system.css`, mapping all `--hx-*` props to light-mode equivalents. `AppShell.vue` reads `user_preferences.theme` (from the existing preferences JSONB column, Step 6.4) and sets `data-theme` on `<html>`. If no preference is set, defaults to `prefers-color-scheme` via a `matchMedia` listener. Manual override toggle in Settings → Account: "Appearance — Dark / System / Light" (three-way). Persisted via `PUT /api/v1/users/me/preferences`.

---

## 6. DB Migrations Required

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
```

In-memory cache (per-process, cleared on restart) is acceptable for v1 of the Discover feature. DB cache enables cross-session reuse and is preferred if the ListenBrainz API has rate limits that affect UX.

### 6.2 `musicbrainz_release_id` + `linked_request_id` on `media_requests`

Required for cross-user deduplication (Step 13). `musicbrainz_release_id` enables exact match; `linked_request_id` links duplicate requests to the same download job.

```
20260601_030000_add_musicbrainz_and_dedup_to_media_requests.sql
```

```sql
ALTER TABLE media_requests
  ADD COLUMN IF NOT EXISTS musicbrainz_release_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_request_id      INTEGER REFERENCES media_requests(id);
```

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
  ON release_radar_cache(artist_mbid);

CREATE INDEX IF NOT EXISTS idx_release_radar_date
  ON release_radar_cache(first_release_date DESC);
```

### 6.4 `user_preferences` Column on `users`

Required for per-user format/quality preferences (Step 15).

```
20260601_050000_add_preferences_to_users.sql
```

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Default `{}` means "no preference" — system default applies. Schema: `{ preferredFormat: 'flac' | 'mp3-320' | 'mp3-v0' | 'any', minimumBitrate: number | null }`.

### 6.5 `user_push_subscriptions` Table

Required for PWA push notifications (Step 17).

```
20260601_060000_create_user_push_subscriptions.sql
```

```sql
CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id          SERIAL      PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 7. Open Questions

### 7.1 ~~What Is the Requests Screen?~~ — Resolved

The home page IS the request screen. "My Requests" (`RequestMusicView.vue`) is a read-only status view: artwork cards of submitted requests with fulfillment state and a cancel action. No intake form. Search and requesting happen on the home page.

### 7.2 Should the Discover Graph Show Artwork for Suggestions?

Artist artwork would significantly increase the visual quality of the Discover flow but requires CAA lookups for each suggestion card. The CAA does not reliably have artist images (it's primarily for release cover art). An alternative is a generated initial-based placeholder styled per-artist (like GitHub's identicons). Or: use MusicBrainz artist images where available, placeholder otherwise.

### 7.3 Does "Discover" Replace the Existing Search Screen?

They serve different intents: Discover is taste-graph traversal (I want to find new artists similar to ones I love). Search is lookup (I know what I want, I'm finding it to request it). They should coexist. "Discover" is exploration. "Search" or the home page intake box is retrieval.

### 7.4 How Does the Cold-Start CTA Work for Returning Users?

If a user deletes all monitored artists, the cold-start CTA would re-appear. This is probably correct behavior. But if a user has no monitored artists and doesn't want to use Discover (maybe they only use the search intake), the CTA should be dismissible.

### 7.5 ListenBrainz Coverage for Niche Genres?

ListenBrainz similarity is derived from listening patterns of its user base. For very niche genres (black metal sub-genres, obscure jazz, regional folk), the similarity data may be sparse. MusicBrainz relationship data (influenced-by, collaboration) will fill some gaps, but coverage needs to be validated before committing to ListenBrainz-only. Plan: implement ListenBrainz first, add a Last.fm fallback path if coverage is inadequate.

### 7.6 Release Radar — How Far Back Is "Recent"?

30 days is the proposed window. But an artist who releases infrequently (once every 3 years) might have a release that the user monitors 45 days after it drops — they'd miss it in the Radar. Options: extend to 90 days, or surface any release the user doesn't yet have regardless of age (which is closer to the Missing screen). Tentative: 30 days for the Radar strip, link to Missing for the full backlog.

### 7.7 Activity Feed — What Is the Right Scope for Requesters?

Requesters seeing each other's requests in the feed could feel intrusive in a household context ("my partner can see everything I'm requesting"). Options: (a) requesters only see their own events + system events (downloads completed), (b) all household members see everything, (c) per-user privacy setting. Tentative: default to shared (it's a household app), with an operator-controlled option to restrict to own-only.

### 7.8 Download Result Scoring — Where Does Uploader Reputation Come From?

"Uploader prior success rate" requires tracking per-uploader import outcomes over time. This data doesn't exist yet. Short-term: score only on format, bitrate, and track completeness. Long-term: accumulate uploader history in a `slskd_uploader_history` table. Tentative: ship v1 scoring without uploader reputation; add reputation in a follow-up.

### 7.9 PWA Push — Which Events Send Notifications?

Too many notifications will cause users to disable them immediately. Candidates: `request_fulfilled` (high value, infrequent), `download_completed` (medium value), `new_release_from_monitored_artist` (medium value, potentially frequent for prolific artists). Tentative: only `request_fulfilled` for v1. Expand in settings later.

### 7.10 Artist Detail — What Is the Right URL Shape for Non-MusicBrainz Artists?

`/app/artists/:id` assumes the artist has a MusicBrainz ID. Artists that were added before MusicBrainz import (manual entries, legacy data) may only have a local DB integer ID. The route needs to handle both ID formats, or artist detail should be restricted to artists with a confirmed MBID. Tentative: require MBID; surface a "No detail available" state for legacy-only artists.

### 7.11 Release Detail Modal — Where Does Tracklist Data Come From?

MusicBrainz has tracklist data, but the local metadata store may not cache it. Fetching on modal open introduces latency. Options: (a) fetch from MusicBrainz on open (simplest, adds ~300ms), (b) pre-fetch and cache tracklist data for all monitored artist releases (heavy), (c) show modal immediately with available data (title, art, year) and lazy-load tracklist below the fold. Tentative: option (c) — progressive disclosure.

### 7.12 Library View — What Defines "Owned"?

The library model tracks files on disk, but "owned" state for a release may be partial (some tracks downloaded, not all). Does the Library view show releases that are fully complete, or any release with at least one track? Tentative: show releases with acquisition state `complete` or `partial`, with a visual distinction (complete = full art, partial = art with a progress overlay).

### 7.13 Color Extraction — Performance Budget on Large Grids?

Canvas-based color extraction on 50+ card images simultaneously on page load could cause jank. Options: (a) extract only on intersection (IntersectionObserver — images already use lazy loading so this aligns), (b) extract one at a time via a microtask queue, (c) skip on mobile. Tentative: run extraction inside the `@load` handler of `ArtworkImage.vue` only after the image enters the viewport. Already aligned with `loading="lazy"`.

### 7.14 GridControls — Client-Side vs. Server-Side Filtering?

For large libraries (1000+ releases), filtering and sorting entirely on the client means fetching all records upfront. This is acceptable for v1 where most libraries are small. But filter/sort should be designed so server-side query params can be added later without changing the component API. Tentative: client-side in v1; `GridControls` emits filter/sort state objects structured to mirror future query params.

