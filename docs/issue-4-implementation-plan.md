# Issue #4 — Home Page: Media Hub Redesign — Search-First Request Flow, Activity Summary & Artist Monitoring

## Status: Not Started

### Implementation Progress

**Step 1 — Not Started:** Remove all operator panels from `DashboardView.vue` (library scan, reconciliation, discovery, artwork, runtime overview). Rewrite from scratch as a media-centric landing page.

**Step 2 — Not Started:** Rename nav label `Dashboard` → `Home` in `AppShell.vue` `operatorNav` array.

**Step 3 — Not Started:** MusicBrainz release search intake. Single search box queries `searchMusicBrainzReleases` (`/api/v1/metadata/musicbrainz/releases/search`). Results render as a list (artist name, title, year · type · country). Each result has a per-card **Request** button that calls `createMediaRequest` directly. Button transitions: idle → `Requesting…` → `Requested` (success pill). Per-card error message on failure.

**Step 4 — Not Started:** Stats row (`hx-stat-grid`) — My requests (total), Active (queued/downloading/pending import), Missing (monitored releases not yet acquired), Partial (releases with gaps), Downloading (active Soulseek transfers). Sourced from `fetchMediaRequestSummary`, `useLibraryWantedSummary`, and `useAsyncResource` polling `fetchSlskdDownloads` at 8 s. Row hidden until at least one data source resolves.

**Step 5 — Not Started:** Three activity cards — Recent requests (last 10, status pills), Wanted releases (top 8, links to `/app/missing`), Active downloads (top 8, links to `/app/activity/downloads`). Each card conditionally rendered; all link to their dedicated full-page views.

**Step 6 — Not Started:** Reorder `OnboardingSummaryPanel` — moved below the search card so the request intake is always the hero. Only rendered when `onboardingSummary.issueCount > 0`.

**Step 7 — Not Started:** Artist search mode (toggle release/artist, artist cards, discography browse, Monitor button).

**Step 8 — Not Started:** Cross-reference `requestedIds` on page load — mark already-requested results immediately after `loadRequests()` resolves.

**Step 9 — Not Started:** Already-monitored artist detection in artist search results.

**Step 10 — Not Started:** Responsive/mobile — collapse search row on narrow viewports.

---

### Current State Snapshot (Existing Infrastructure)

The current `DashboardView.vue` is an operator control panel surfacing library scan, reconciliation, discovery, artwork maintenance, runtime overview, heartbeat, activity feed, and dependency status. None of that belongs on the landing page for a media consumption app.

The following composables and API functions already exist in the codebase and will be used by the new view — no new server routes or migrations are required:

- `useLibraryWantedSummary` and `useLibraryWantedReleases` composables expose wanted-release counts and paginated release lists.
- `fetchMediaRequests` and `fetchMediaRequestSummary` are available in `library-api.js` with `scope` param support.
- `searchMusicBrainzReleases` and `searchMusicBrainzArtists` are available in `metadata-api.js`, routing through `/api/v1/metadata/musicbrainz/releases/search` and `/api/v1/metadata/musicbrainz/artists/search`.
- `importMusicBrainzArtist`, `updateMetadataArtistMonitoring`, and `browseMusicBrainzArtistReleaseGroups` are in `metadata-api.js` — sufficient to implement the artist monitor flow without new server routes.
- `useAsyncResource` is a generic polling composable already used by existing activity views.

---

## 1. Problem Statement

The Harmoniarr home page (`/app`) was an operator control plane: library scan triggers, reconciliation status, discovery runs, artwork maintenance, runtime overview panels, and heartbeat status. None of that is relevant to the primary user action — finding and requesting music.

Users who arrive at Harmoniarr want to:
1. Search for an artist or album and request it
2. See the status of their pending requests
3. Know what monitored releases are still missing
4. See what's actively downloading

The home page should answer all four of those questions without navigating away, exactly as Overseerr/Sonarr/Lidarr do for their respective media types.

Additionally, the request intake was two separate text fields (Artist, Album/Release) that required the user to already know the exact strings. A MusicBrainz-backed search box that returns result cards with a one-click Request button is dramatically more usable — the user searches for what they remember, picks the right release, and submits with one click.

---

## 2. Existing Infrastructure to Leverage

| Component | File | Notes |
|---|---|---|
| MusicBrainz release search | `src/client/lib/metadata-api.js` | `searchMusicBrainzReleases({ release, artist, limit })` → `payload.search.results[]` |
| MusicBrainz artist search | `src/client/lib/metadata-api.js` | `searchMusicBrainzArtists({ query, limit })` → `payload.search.results[]` |
| Artist release-group browse | `src/client/lib/metadata-api.js` | `browseMusicBrainzArtistReleaseGroups({ artistId, limit, offset, type })` |
| Import artist | `src/client/lib/metadata-api.js` | `importMusicBrainzArtist(artistId)` — POST, includes CSRF |
| Update artist monitoring | `src/client/lib/metadata-api.js` | `updateMetadataArtistMonitoring(artistId, { monitored })` — PUT, includes CSRF |
| Create media request | `src/client/lib/library-api.js` | `createMediaRequest({ artistName, releaseTitle, requestKind })` — POST with CSRF |
| Fetch media requests | `src/client/lib/library-api.js` | `fetchMediaRequests({ scope })` → `payload.mediaRequests[]` |
| Fetch request summary | `src/client/lib/library-api.js` | `fetchMediaRequestSummary({ scope })` → counts + fulfillmentCounts |
| Wanted summary | `src/client/composables/useLibraryWantedSummary.js` | `libraryWantedSummary`, `releaseCounts` (missing, partial) |
| Wanted releases | `src/client/composables/useLibraryWantedReleases.js` | `wantedReleases`, `isLoading`, `loadWantedReleases()` |
| Onboarding summary | `src/client/composables/useOnboardingSummary.js` | `summary.issueCount`, `steps`, `nextAction` |
| Async polling | `src/client/composables/useAsyncResource.js` | `{ fetcher, project, initialData, pollIntervalMs }` → `{ data, isLoading, load }` |
| Soulseek downloads | `src/client/lib/slskd-search-api.js` | `fetchSlskdDownloads({ includeRemoved })` → array of `{ username, directories[] }` |
| Design system | `src/client/design-system.css` | `hx-card`, `hx-stat-grid`, `hx-stat-card`, `hx-table`, `hx-btn`, `hx-pill`, `hx-empty`, `hx-skeleton`, `hx-input`, `hx-field`, `hx-form-row`, `hx-page` |
| Onboarding panel | `src/client/components/OnboardingSummaryPanel.vue` | Accepts `summary`, `steps`, `nextAction`, `isLoading`, `errorMessage`, `isSetupMode`; emits `refresh` |
| Router | `src/client/router.js` | `/app` → `dashboard`, `/app/missing` → `missing`, `/app/requests` → `request-music`, `/app/activity/downloads` → `activity-downloads`, `/app/search` → `search` |

---

## 3. Gaps (What Is Missing)

### 3.1 No Artist Search Mode

The current search box queries `searchMusicBrainzReleases` only — the user must know the album title. A release-only search misses the primary Lidarr-style workflow: search by artist name, browse their discography, pick an album, request it. Harmoniarr has all the required API functions; they are just not wired to the home page.

### 3.2 No Already-Requested Cross-Reference on Search Results

When `runSearch()` returns results and the user has previously requested some of those releases, the result cards all show `Request` buttons — even for releases already in `mediaRequests`. The `requestedIds` set is only populated during the current page session (when the user clicks Request in the UI). There is no cross-reference against the loaded `mediaRequests` list on mount.

Fix: after `loadRequests()` resolves, populate `requestedIds` by matching each `mediaRequest` against the search results using `artistName + releaseTitle` string comparison, or pre-populate from a server-provided `musicbrainzReleaseId` if available.

### 3.3 No Already-Monitored Artist Detection

In the planned artist search mode, artists that Harmoniarr already monitors locally should show a `Monitored` pill instead of an `Import & Monitor` button. The `searchMusicBrainzArtists` results include a `musicbrainzArtistId`; `fetchMetadataArtist` or a local search can check whether that ID is already in the local metadata store.

The most practical approach: after the artist search resolves, call `searchLocalMetadataArtists` (already in `metadata-api.js`) for each result's name, cross-reference by `musicbrainzArtistId`, and mark matched results as already monitored. This avoids N+1 fetches by doing one bulk search.

### 3.4 ~~Artist Search Not Wired to Discography Browse~~ — Not Yet Started

`browseMusicBrainzArtistReleaseGroups` is available but not wired to any home-page panel. The intended flow is: artist result card → click artist name or a "Browse" button → inline discography list expands showing release groups → each release group has a `Request` button.

This requires local UI state for "expanded artist" (`expandedArtistId ref`) and a per-artist release-group cache (`artistReleaseGroups reactive map`).

### 3.5 Two-Field Form Removed But `reactive` Import Still Present

The old form used `reactive` from Vue. After replacing the form with the search flow, `reactive` is now only used for `requestErrors = reactive({})`. This is valid but could be a plain `ref({})` with minor type-narrowing differences. Not a bug, but worth noting for future cleanup.

### 3.6 `requestErrors` Uses `delete` on Reactive Object

`requestErrors` is `reactive({})` and uses `delete requestErrors[id]` to clear per-card errors. Vue 3 reactive objects track `delete` correctly, but the pattern is slightly non-idiomatic. Alternative: `ref({})` with `requestErrors.value = { ...requestErrors.value }` without the deleted key. Not a correctness issue.

### 3.7 No Responsive Collapse for Search Row

`.hx-search-row` is `display: flex` with a full-width input and a button side by side. On narrow viewports (mobile, narrow sidebar layouts), the button may overflow or wrap awkwardly. A `flex-wrap: wrap` or a breakpoint-aware stacked layout is needed.

### 3.8 Search Results Not Cleared on New Query Submission

`searchResults.value = []` is set at the top of `runSearch()` before the API call resolves. If the API is slow, there is a blank gap between the clear and the results appearing. A `isSearching` skeleton state covers the gap visually but the UX could be improved by keeping the previous results visible until new ones arrive (stale-while-revalidate pattern).

This is a UX improvement, not a correctness bug.

---

## 4. Design Decisions

### Decision 1: Single Search Box, Mode Toggle (Release / Artist)

Rather than separate routes or panels for release vs. artist search, the home page search card uses a single text input with a toggle or segmented control: **By Release** (default) / **By Artist**. The same search box is reused; `runSearch()` dispatches to `searchMusicBrainzReleases` or `searchMusicBrainzArtists` based on the active mode.

**Pro:** One search box, familiar to Overseerr/Lidarr users. No navigation required to switch search type.
**Con:** Requires a mode ref and conditional template rendering for results.

**Recommendation:** Implement as a `searchMode = ref('release')` toggle with two `<button type="button">` pills or a `<select>`. The result list template conditionally renders release cards or artist cards based on `searchMode`.

### Decision 2: Artist Cards Expand Inline (No New Route)

When a user is in artist mode and clicks an artist result card, the discography expands inline within the same card list — not a navigation to a new page. This keeps the home page self-contained and matches the Overseerr "Add Movie" flow where you search, see a result, and act on it without leaving the page.

The Settings → Library Browser (`/app/settings/library-browser`) remains the deep-dive metadata workspace for full artist/release exploration. The home page artist mode is a quick "find and monitor" shortcut only.

### Decision 3: Already-Requested Cross-Reference via artistName + releaseTitle String Match

MusicBrainz search results include `result.title` and `result.artist.name`. The `mediaRequests` list includes `artistName` and `releaseTitle`. Cross-reference by `(artistName.toLowerCase() === result.artist.name.toLowerCase()) && (releaseTitle.toLowerCase() === result.title.toLowerCase())`. This is fuzzy-approximate but sufficient for the home page display — exact match on the dedicated Requests page uses server-side canonical IDs.

If `musicbrainzReleaseId` is added to `media_requests` in a future migration (see Gap 3.2), the cross-reference should use that instead.

### Decision 4: Monitor Artist = Import + Enable Monitoring in One Click

From an artist result card, **Monitor** calls `importMusicBrainzArtist(artistId)` (which upserts the artist into local metadata) and then `updateMetadataArtistMonitoring(artistId, { monitored: true })`. Both calls must complete before the button transitions to `Monitored`. The button shows `Monitoring…` during the in-flight state.

If the import succeeds but the monitoring update fails, the artist is still imported. The button shows an error message but the artist appears in local metadata without monitoring enabled. The user can navigate to Settings → Library Browser to correct.

### Decision 5: Stats Row Hidden Until Data Resolves

The stats grid (`hx-stat-grid`) renders only when `requestSummary || wantedSummary.libraryWantedSummary.value` is truthy. This prevents a flash of all-zero counters on first load. Individual stat cards further gate on their own data source. Active downloads card only appears when `activeDownloadFiles.length > 0`.

### Decision 6: Onboarding Panel Below Search Card

`OnboardingSummaryPanel` renders below the request intake and above the stats row. This preserves the alert visibility without demoting the request intake to secondary status. Users with a healthy setup never see the onboarding panel at all. Users who have setup issues see it after the search box — the message is contextually appropriate ("fix these things to make your requests work") rather than a blocker.

---

## 5. Proposed Changes by Component

### 5.1 `src/client/views/DashboardView.vue` — Search Mode Toggle

Add `searchMode = ref('release')` and update `runSearch()` to dispatch conditionally:

```js
import { searchMusicBrainzArtists, searchMusicBrainzReleases } from '../lib/metadata-api.js';

const searchMode = ref('release'); // 'release' | 'artist'
const artistResults = ref([]);
const monitoringId = ref(null);
const monitoredIds = ref(new Set());

async function runSearch() {
  const q = searchQuery.value.trim();
  if (!q) return;
  isSearching.value = true;
  searchError.value = '';
  searchResults.value = [];
  artistResults.value = [];
  try {
    if (searchMode.value === 'artist') {
      const payload = await searchMusicBrainzArtists({ query: q, limit: 8 });
      artistResults.value = payload.search?.results ?? [];
    } else {
      const payload = await searchMusicBrainzReleases({ release: q, limit: 12 });
      searchResults.value = payload.search?.results ?? [];
    }
  } catch (err) {
    searchError.value = err instanceof Error ? err.message : 'Search failed';
  } finally {
    isSearching.value = false;
  }
}
```

### 5.2 `src/client/views/DashboardView.vue` — Artist Monitor Action

```js
import {
  browseMusicBrainzArtistReleaseGroups,
  importMusicBrainzArtist,
  updateMetadataArtistMonitoring,
} from '../lib/metadata-api.js';

const monitorErrors = reactive({});
const expandedArtistId = ref(null);
const artistReleaseGroups = reactive({});

async function monitorArtist(artist) {
  const id = artist.id;
  monitoringId.value = id;
  delete monitorErrors[id];
  try {
    await importMusicBrainzArtist(id);
    await updateMetadataArtistMonitoring(id, { monitored: true });
    monitoredIds.value = new Set([...monitoredIds.value, id]);
  } catch (err) {
    monitorErrors[id] = err instanceof Error ? err.message : 'Monitor failed';
  } finally {
    if (monitoringId.value === id) monitoringId.value = null;
  }
}

async function toggleArtistDiscography(artist) {
  const id = artist.id;
  if (expandedArtistId.value === id) {
    expandedArtistId.value = null;
    return;
  }
  expandedArtistId.value = id;
  if (!artistReleaseGroups[id]) {
    try {
      const payload = await browseMusicBrainzArtistReleaseGroups({ artistId: id, limit: 20 });
      artistReleaseGroups[id] = payload.releaseGroups ?? [];
    } catch {
      artistReleaseGroups[id] = [];
    }
  }
}
```

### 5.3 `src/client/views/DashboardView.vue` — Already-Requested Cross-Reference

After `loadRequests()` resolves, reconcile `requestedIds` against the current `searchResults`:

```js
async function loadRequests() {
  isLoadingRequests.value = true;
  try {
    const [summaryPayload, requestsPayload] = await Promise.all([
      fetchMediaRequestSummary({ scope: 'mine' }),
      fetchMediaRequests({ scope: 'mine' }),
    ]);
    requestSummary.value = summaryPayload;
    mediaRequests.value = requestsPayload.mediaRequests ?? [];
    // Reconcile requestedIds against current search results
    reconcileRequestedIds();
  } catch {
    // silent
  } finally {
    isLoadingRequests.value = false;
  }
}

function reconcileRequestedIds() {
  if (!searchResults.value.length || !mediaRequests.value.length) return;
  const ids = new Set(requestedIds.value);
  for (const result of searchResults.value) {
    const artistLower = (result.artist?.name ?? '').toLowerCase();
    const titleLower = result.title.toLowerCase();
    const alreadyRequested = mediaRequests.value.some(
      (r) => r.artistName.toLowerCase() === artistLower && r.releaseTitle.toLowerCase() === titleLower,
    );
    if (alreadyRequested) ids.add(result.id);
  }
  requestedIds.value = ids;
}
```

Also call `reconcileRequestedIds()` immediately after `runSearch()` resolves (search results are fresh, requests may already be loaded).

### 5.4 `src/client/views/DashboardView.vue` — Template: Search Mode Toggle

In the search card, add a mode segmented control above or alongside the search input:

```html
<div class="hx-search-mode">
  <button
    type="button"
    class="hx-search-mode-btn"
    :class="{ 'is-active': searchMode === 'release' }"
    @click="searchMode = 'release'; searchResults = []; artistResults = []"
  >Release</button>
  <button
    type="button"
    class="hx-search-mode-btn"
    :class="{ 'is-active': searchMode === 'artist' }"
    @click="searchMode = 'artist'; searchResults = []; artistResults = []"
  >Artist</button>
</div>
```

### 5.5 `src/client/views/DashboardView.vue` — Template: Artist Result Cards

Below the release result list, add a conditional artist result list:

```html
<ul class="hx-result-list" v-else-if="artistResults.length > 0">
  <li class="hx-result-item" v-for="artist in artistResults" :key="artist.id">
    <div class="hx-result-meta">
      <span class="hx-result-artist">{{ artist.type ?? 'Artist' }}</span>
      <span class="hx-result-title">{{ artist.name }}</span>
      <span class="hx-result-detail">
        <template v-if="artist.country">{{ artist.country }}</template>
        <template v-if="artist.country && artist.disambiguation"> · </template>
        <template v-if="artist.disambiguation">{{ artist.disambiguation }}</template>
      </span>
      <span v-if="monitorErrors[artist.id]" class="hx-result-error">{{ monitorErrors[artist.id] }}</span>
    </div>
    <div class="hx-result-action">
      <span v-if="monitoredIds.has(artist.id)" class="hx-pill" data-tone="success">Monitored</span>
      <button
        v-else
        type="button"
        class="hx-btn"
        data-variant="primary"
        :disabled="monitoringId === artist.id"
        @click="monitorArtist(artist)"
      >
        {{ monitoringId === artist.id ? 'Monitoring…' : 'Monitor' }}
      </button>
    </div>
  </li>
</ul>
```

### 5.6 `src/client/views/DashboardView.vue` — Styles: Search Mode Toggle

```css
.hx-search-mode {
  display: flex;
  gap: var(--hx-space-1);
  margin-bottom: var(--hx-space-3);
}

.hx-search-mode-btn {
  padding: var(--hx-space-1) var(--hx-space-3);
  border-radius: var(--hx-radius-sm);
  border: 1px solid var(--hx-border);
  background: transparent;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  font-weight: 500;
  cursor: pointer;
}

.hx-search-mode-btn.is-active {
  background: var(--hx-accent-strong);
  color: #fff;
  border-color: var(--hx-accent-strong);
}

@media (max-width: 600px) {
  .hx-search-row {
    flex-wrap: wrap;
  }

  .hx-search-row .hx-btn {
    width: 100%;
  }
}
```

---

## 6. No DB Migrations Required

The media hub redesign is entirely a client-side view change. No new server routes, no new DB columns. All API functions used already exist.

If `musicbrainzReleaseId` is later added to the `media_requests` table to enable precise already-requested cross-referencing (Gap 3.2 — Decision 3), that migration would follow the existing naming convention:

```
20260601_010000_add_musicbrainz_release_id_to_media_requests.sql
```

```sql
ALTER TABLE media_requests
  ADD COLUMN IF NOT EXISTS musicbrainz_release_id TEXT;
```

---

## 7. Open Questions

1. **Should "Monitor Artist" also trigger a wanted-release reconciliation run immediately?**
   - Lidarr does this: import artist → immediately queue a wanted-releases check. In Harmoniarr, `startLibraryDiscoveryRun()` is available. Should `monitorArtist()` call it automatically, or leave that to the background scheduler?
   - **Tentative:** Do not auto-trigger from the home page. The background scheduler picks it up within its normal cycle. Auto-triggering adds complexity and confusing feedback if the user monitors 5 artists in quick succession.

2. **Should already-requested cross-reference use `musicbrainzReleaseId` or string match?**
   - String match is implemented now (Gap 3.2 / Decision 3). It is approximate — a release titled "OK Computer" and an artist named "Radiohead" will match even if the MusicBrainz IDs differ between the search result and the stored request.
   - The precise approach requires either (a) storing `musicbrainzReleaseId` on `media_requests` (server migration needed) or (b) a dedicated `GET /api/v1/library/media-requests/by-musicbrainz/:id` lookup per result (too many requests for a search page).
   - **Tentative:** Ship string match now; revisit if false positives are reported.

3. **Should the search results persist across navigation (back button)?**
   - Currently, navigating away from `/app` clears `searchResults`. Vue router destroys and remounts the component.
   - Preserving results would require either route query params (`?q=...&mode=release`) or a Pinia store.
   - **Tentative:** Route query params are the right approach for linkability (share a search URL). Implement when artist search mode lands so both modes can be reflected in URL state.

4. **Segmented control or `<select>` for search mode?**
   - Segmented control (two `<button>` pills) is more visually consistent with the design system. A `<select>` is more accessible on mobile.
   - **Tentative:** Segmented control with `role="group"` and `aria-label="Search mode"` for accessibility.

5. **Max results count — 12 releases / 8 artists. Is this right?**
   - 12 releases fits a reasonable viewport without scrolling on desktop. 8 artists is tighter because artist cards will expand to show discography.
   - These are easy to tune and expose as hardcoded constants rather than user settings.
   - **Tentative:** Keep as-is. Expose as named constants (`RELEASE_SEARCH_LIMIT = 12`, `ARTIST_SEARCH_LIMIT = 8`) at the top of the script block for easy adjustment.
