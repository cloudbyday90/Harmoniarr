# Issue #4 — Full App Re-scope: Harmoniarr as a Media Consumption App

## Status: Not Started

### Core Design Shifts

- **Operator tool → media consumption app.** Every user-facing screen is redesigned around the act of finding, requesting, and tracking music — not administering a system.
- **Requesters as the primary persona.** The home page, discovery flow, and request experience are designed for the person who wants music, not the person running the server.
- **Artwork-first UI.** Tables become card grids. Text results become artwork cards. The visual identity of albums and artists drives the interface.
- **Multi-user aware throughout.** Requests carry attribution. Activity surfaces whose requests are whose. The experience is explicitly shared.
- **Two distinct nav experiences.** Operator items move entirely into Settings. Requesters get a clean, purpose-built nav. The two roles are not just filtered versions of the same nav.

---

### Implementation Progress

**Step 1 — Not Started:** Navigation & shell — redesign `AppShell.vue` with two distinct nav configurations. Requester nav: Home, Discover, My Requests, Account. Operator nav: Home, Discover, Missing, Activity, Settings (Settings absorbs all operator sub-items). Remove the placeholder global search input from the topbar or wire it to real search.

**Step 2 — Not Started:** Home page — artwork-first artist card grid. Monitored artists displayed as cards with cover art (local first, MusicBrainz CAA fallback). Click an artist card → expands or navigates to their missing releases. Cold-start state (no monitored artists) surfaces the Discover CTA prominently.

**Step 3 — Not Started:** Taste-seeding wizard — new `DiscoverView.vue`. Open-ended graph flow: user types or picks a seed artist → related artists surface as cards (MusicBrainz relationships + Last.fm/ListenBrainz) → user picks from related → more related surfaces, narrowing toward their taste → user clicks "Done" to exit. Each pick = monitoring that artist. Re-enterable from "Discover" nav item at any time. First-run: auto-shown after onboarding completes if no artists are monitored.

**Step 4 — Not Started:** External similarity service integration — investigate Last.fm and ListenBrainz artist similarity APIs. Add a server-side route that proxies similar-artist lookups (to avoid CORS and allow caching). Decide which service to use based on rate limits, data quality, and auth requirements.

**Step 5 — Not Started:** Artwork infrastructure — wire MusicBrainz Cover Art Archive (CAA) as a fallback artwork source for artist and release cards. Local stored artwork takes precedence. Add a shared `<ArtworkImage>` component that handles load → fallback → placeholder progression.

**Step 6 — Not Started:** Requests screen reimagine — direction TBD (under discussion). Current `RequestMusicView.vue` to be replaced with a reimagined experience. See Open Questions §7.1.

**Step 7 — Not Started:** Search screen — update `SearchView.vue` to artwork-first card results for both artist and release search. Replace the current text-list output with album art cards and artist cards consistent with the rest of the redesign.

**Step 8 — Not Started:** Missing/Wanted screen — update `MissingView.vue` to visual card grid instead of table. Group by artist or by release type. Each card shows artwork + missing release info + request action.

**Step 9 — Not Started:** Multi-user awareness pass — request attribution (who requested what) shown on request cards throughout. `ActivityUsersView.vue` updated to surface per-user request activity. Operator home page shows all-users activity summary.

**Step 10 — Not Started:** Responsive & mobile — card grids collapse to single-column on narrow viewports. Sidebar collapses to a bottom nav or hamburger on mobile. All touch targets meet minimum size requirements.

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

### 3.6 Requests Screen Has No Clear Identity

`RequestMusicView.vue` is the only screen a requester currently sees. It's a form + a table. Neither the form (two text fields) nor the table (a generic list with status pills) reflects a considered design. In the reimagined app this screen needs a clear purpose — it's not just "the screen requesters are stuck on."

Direction is TBD (see Open Questions §7.1). This is a dedicated implementation step once direction is confirmed.

### 3.7 Missing Screen Is a Table

`MissingView.vue` shows wanted releases as a table. In the artwork-first redesign, this should be a card grid grouped by artist or by release type, with each card showing album art, release title, and a Request action.

### 3.8 Search Returns Text Lists

`SearchView.vue` returns search results as text lists. In the artwork-first redesign, both artist and release search results should render as artwork cards — consistent with the home page, the missing screen, and the discover flow.

### 3.9 No Multi-User Attribution on Requests

Requests exist with a `requestedBy` user association on the server, but the client displays requests as an undifferentiated list. In a multi-user household, you want to know whose request is whose — both for social context ("Alex requested this") and for operator triage.

Required: request cards throughout the app surface the requesting user's display name or avatar.

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

### 6.2 `musicbrainz_release_id` on `media_requests` (Future)

Not required for this re-scope, but noted: adding `musicbrainz_release_id TEXT` to `media_requests` would enable exact cross-reference matching between search results and existing requests (instead of artist name + release title string matching).

---

## 7. Open Questions

### 7.1 What Is the Requests Screen?

The current `RequestMusicView.vue` is underpowered and has no clear identity in the redesigned app. Candidates under consideration:

- **Request inbox** — cards showing the user's requests with status, fulfillment progress, cancel action. Artwork-first (release art on each card).
- **Per-artist grouped view** — requests grouped by artist, drill into an artist to see their requested releases and statuses.
- **Combined discovery + requests** — a single screen where you can both browse your existing requests and add new ones from search.

Decision needed before Step 6 can be designed.

### 7.2 Should the Discover Graph Show Artwork for Suggestions?

Artist artwork would significantly increase the visual quality of the Discover flow but requires CAA lookups for each suggestion card. The CAA does not reliably have artist images (it's primarily for release cover art). An alternative is a generated initial-based placeholder styled per-artist (like GitHub's identicons). Or: use MusicBrainz artist images where available, placeholder otherwise.

### 7.3 Does "Discover" Replace the Existing Search Screen?

They serve different intents: Discover is taste-graph traversal (I want to find new artists similar to ones I love). Search is lookup (I know what I want, I'm finding it to request it). They should coexist. "Discover" is exploration. "Search" or the home page intake box is retrieval.

### 7.4 How Does the Cold-Start CTA Work for Returning Users?

If a user deletes all monitored artists, the cold-start CTA would re-appear. This is probably correct behavior. But if a user has no monitored artists and doesn't want to use Discover (maybe they only use the search intake), the CTA should be dismissible.

### 7.5 ListenBrainz Coverage for Niche Genres?

ListenBrainz similarity is derived from listening patterns of its user base. For very niche genres (black metal sub-genres, obscure jazz, regional folk), the similarity data may be sparse. MusicBrainz relationship data (influenced-by, collaboration) will fill some gaps, but coverage needs to be validated before committing to ListenBrainz-only. Plan: implement ListenBrainz first, add a Last.fm fallback path if coverage is inadequate.
