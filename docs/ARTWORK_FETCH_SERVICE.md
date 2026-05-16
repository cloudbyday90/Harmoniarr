# Artwork Fetch Service — External Provider Integration

## Purpose

This document defines the design for fetching, caching, and serving artwork from external providers (Cover Art Archive, Fanart.tv) so that artist and release tiles display artwork instead of placeholders.

It covers:

- External provider integration (Fanart.tv for artists, Cover Art Archive proxy for releases)
- Server-side caching in the existing `artwork_assets` / `artwork_assignments` tables
- Artwork serving endpoint
- Request quota tracking with daily limits and in-memory cache
- Settings UI for API keys and quota configuration
- Client-side batch resolution with `useArtworkBatchResolve` composable
- Refresh support for forced re-fetch (single + batch)
- Artist detail hero integration
- Related artists artwork resolution

## Current State

### What Exists

| Capability | Status |
|---|---|
| Artwork ingestion (embedded + sidecar) | Working — library scan extracts cover art from audio files and `folder.jpg` |
| Artwork deduplication (SHA256) | Working — content-addressable storage under `/app/data/artwork/` |
| Artwork assignment (priority-based) | Working — `artwork_assignments` links assets to owners |
| Dominant color extraction (OKLCH) | Working — sharp server-side + web worker client-side |
| Artwork cleanup/retention | Working — admin worker prunes unassigned assets |
| Client-side CAA fetch | Working — `ArtworkImage.vue` fetches `coverartarchive.org` directly from the browser (third-tier fallback) |
| Settings infrastructure | Working — `encrypted_secrets` table, provider credential patterns |
| `providerOrder` setting | Working — `fanartTv` and `coverArtArchive` in validated values |
| Artwork file serving endpoint | Working — `GET /api/v1/artwork/assets/:assetId/file` |
| Server-side CAA proxy | Working — CAA images downloaded server-side, ingested, cached locally |
| Fanart.tv integration | Working — artist images fetched, ingested, cached locally |
| Batch artwork resolution | Working — `POST /api/v1/artwork/resolve-batch` (50-item limit) |
| Quota tracking | Working — `artwork_provider_quota` table with daily tracking |
| Quota enforcement | Working — `dailyQuotaLimit` setting (default 1000), checked before each external call |
| Quota dashboard UI | Working — per-provider progress bars in Settings > Media & Storage |
| Refresh support | Working — `?refresh=true` on single + batch resolve endpoints, client-side refresh button on artist detail hero |
| Artist detail hero | Working — background + thumbnail from Fanart.tv, ghost refresh button with spinner |
| Related artists artwork | Working — batch resolves `artist_thumbnail` for related artists, `<img>` with lazy loading, avatar fallback |
| Discover view artwork | Working — batch resolves `artist_thumbnail` for seed chips, suggestions, and search results |

## External Providers

### Cover Art Archive (Releases)

CAA is a free, open service operated by the Internet Archive and MetaBrainz Foundation. No API key is required.

- **Release artwork:** `GET https://coverartarchive.org/release/{mbid}/front`
- **Release-group artwork:** `GET https://coverartarchive.org/release-group/{mbid}/front`
- **Rate limit:** 1 request per second (MetaBrainz policy). CAA returns HTTP 503 if exceeded.
- **Response:** HTTP 302 redirect to the actual image file on the Internet Archive CDN. The `Location` header contains the final URL.
- **Failure modes:** HTTP 404 (no artwork), 503 (rate limited), network timeout.

Harmoniarr fetches CAA artwork server-side, caches it in `artwork_assets`, and serves it locally. This eliminates repeated external calls for the same release and provides offline resilience.

### Fanart.tv (Artists and Release Groups)

Fanart.tv is a community-maintained artwork database. It keys off MusicBrainz IDs. An API key is required and obtained by registering at fanart.tv.

**Two API key types:**

| Key Type | Header | Delay for new images | Use case |
|---|---|---|---|
| **Project API Key** | `api-key` | 7 days | Application-level access |
| **Personal API Key** | `client-key` | 2 days | End-user access, takes priority over project key |

Harmoniarr sends **both** keys when configured. When both are present, Fanart.tv prioritizes the personal key.

- **Artist artwork:** `GET https://webservice.fanart.tv/v3.2/music/{mbid}`
- **Release-group artwork:** `GET https://webservice.fanart.tv/v3.2/music/albums/{mbid}`
- **Rate limit:** Fanart.tv states limits are "very rarely applied" and most keys have unlimited access. Hard 429 responses are uncommon. Handle `Retry-After` header with exponential backoff if received.
- **Cache requirement:** Fanart.tv requires caching responses locally for at least 7 days. The artwork itself (image files) is cached indefinitely since they are immutable (identified by content hash).
- **Authentication:** HTTP headers:
  - `api-key: {project_key}` (if configured)
  - `client-key: {personal_key}` (if configured)
- **v3.2 response shape** (artist):

```json
{
  "name": "Radiohead",
  "mbid_id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
  "artistthumb": [
    {
      "id": "12345",
      "url": "https://assets.fanart.tv/fanart/music/a74b.../artistthumb/12345.jpg",
      "lang": "",
      "likes": "12",
      "disc_type": "0"
    }
  ],
  "artistbackground": [
    {
      "id": "67890",
      "url": "https://assets.fanart.tv/fanart/music/a74b.../artistbackground/67890.jpg",
      "lang": "",
      "likes": "8"
    }
  ],
  "hdmusiclogo": [
    {
      "id": "11223",
      "url": "https://assets.fanart.tv/fanart/music/a74b.../hdmusiclogo/11223.png",
      "lang": "",
      "likes": "5"
    }
  ],
  "musiclogo": [
    {
      "id": "11224",
      "url": "https://assets.fanart.tv/fanart/music/a74b.../musiclogo/11224.png",
      "lang": "",
      "likes": "3"
    }
  ],
  "albumcover": [
    {
      "id": "44556",
      "url": "https://assets.fanart.tv/fanart/music/a74b.../albumcover/44556.jpg",
      "lang": "",
      "likes": "3",
      "cdart": "0"
    }
  ]
}
```

**v3.2 album response** (for `GET /v3.2/music/albums/{release_group_mbid}`):

```json
{
  "cdart": [...],
  "albumcover": [
    {
      "id": "55667",
      "url": "https://assets.fanart.tv/fanart/music/.../albumcover/55667.jpg",
      "lang": "",
      "likes": "7"
    }
  ]
}
```

Note: In v3.2, album responses may return album image types as **arrays** (not objects). The client must handle both shapes.

**Image types to fetch:**

| Type | Shape | Usage | `artwork_role` |
|---|---|---|---|
| `artistthumb` | Square thumbnail | Artist card tiles, artist detail avatar | `artist_thumbnail` |
| `artistbackground` | Wide banner (1920×1080) | Artist detail page hero | `artist_background` |
| `musiclogo` / `hdmusiclogo` | Transparent PNG | Artist detail page branding | `artist_logo` |
| `albumcover` | Square album art | Release cards (supplemental to CAA) | `cover_front` |

**Selection logic:** For each image type, select the image with the highest `likes` count (parsed as integer). If no images exist for a type, skip it. The `lang` field may be `""` (no language) or a locale code; prefer `""` first, then any.

## Architecture

### Data Flow

```
Search / Browse / Library view
  │
  ├─ ArtistCard / ReleaseCard needs artwork
  │    │
  │    └─ Client asks server: POST /api/v1/artwork/resolve-batch
  │         (or GET /api/v1/artwork/resolve for single items)
  │         │
  │         ├─ Server checks artwork_assignments for existing cached artwork
  │         │    ├─ Found → { url: "/api/v1/artwork/assets/{id}/file", cached: true }
  │         │    └─ Not found (or refresh=true) → fetch from external provider
  │         │         │
  │         │         ├─ Check quota → skip if exceeded
  │         │         │
  │         │         ├─ Cover Art Archive (releases/release groups): primary
  │         │         │    └─ Ingest image → create asset + assignment
  │         │         │
  │         │         ├─ Fanart.tv (release groups): fallback for CAA
  │         │         │    └─ Ingest image → create asset + assignment
  │         │         │
  │         │         ├─ Fanart.tv (artists): primary for artist artwork
  │         │         │    └─ Ingest all image types → create assets + assignments
  │         │         │
  │         │         └─ Return the resolved URL (or { url: null } if no artwork found)
  │         │
  │         └─ Client sets <img src> to the local URL via getResolved()
  │
  └─ ArtworkImage component receives localSrc prop (first-priority source)
```

### Server Components

```
src/server/artwork/
  artwork-fetch-service.js       — Orchestrates external provider fetches with quota checks, per-item refresh in batch
  artwork-quota-service.js       — Daily quota tracking with in-memory cache
  artwork-serve-service.js       — Resolves asset metadata for file serving
  artwork-policy-service.js      — Exposes dailyQuotaLimit in runtime policy
  artwork-module.js              — Wires all services, lazy client construction

src/server/integrations/
  cover-art-archive/cover-art-archive-client.js  — CAA HTTP client with serial queue, rate limiting, retries
  fanart-tv/fanart-client.js                      — Fanart.tv HTTP client with dual-key auth, retries on 429/5xx

src/server/routes/
  artwork-routes.js              — Serve, resolve, resolve-batch (with per-item refresh normalization), quota endpoints

src/server/migrations/
  20260615_010000_artwork_provider_quota.sql  — Quota tracking table
```

### Client Components

```
src/client/composables/
  useArtworkBatchResolve.js      — Batch resolve composable (50-item chunks, graceful failure)
  useArtworkQuota.js             — Quota status composable

src/client/lib/
  artwork-api.js                 — resolveArtwork (with refresh param), batchResolveArtwork (per-item refresh), fetchArtworkQuota
  artwork-quota-presentation.js  — Quota display formatting helpers

src/client/views/
  SearchView.vue                 — Batch resolve after search, wired into cards
  LibraryView.vue                — Watches displayReleases, batch resolves
  ArtistDetailView.vue           — Hero background + thumbnail + refresh button + discography artwork + related artists artwork
  DiscoverView.vue               — Batch resolves artist thumbnails for seed chips, suggestions, and search results
  SettingsMediaStorageView.vue   — Quota dashboard card + daily limit input
  SettingsConnectionsView.vue    — Fanart.tv provider card
```

### New Database Table: `artwork_provider_quota`

Tracks daily request counts per provider so operators can monitor free-tier usage.

```sql
CREATE TABLE artwork_provider_quota (
  id          UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  provider    TEXT NOT NULL,                    -- 'fanartTv' | 'coverArtArchive'
  window_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, window_date)
);
```

This table is append-mostly. Each provider gets one row per day. Queries:

- "How many Fanart.tv requests today?" → `SELECT request_count FROM artwork_provider_quota WHERE provider = 'fanartTv' AND window_date = CURRENT_DATE`
- "Last 30 days of usage" → `SELECT * FROM artwork_provider_quota WHERE window_date >= CURRENT_DATE - 30 ORDER BY window_date DESC`

A periodic cleanup job can prune rows older than 90 days.

### Artwork Owner Types

The `artwork_assignments.owner_type` column uses synthetic MusicBrainz-keyed identifiers:

| `owner_type` | `owner_id` source | Description |
|---|---|---|
| `musicbrainz_release` | MusicBrainz Release MBID | CAA release covers |
| `musicbrainz_release_group` | MusicBrainz Release Group MBID | CAA or Fanart.tv release-group covers |
| `musicbrainz_artist` | MusicBrainz Artist MBID | Fanart.tv artist images |

This avoids requiring a local `metadata_*` row before resolving artwork — search results that haven't been imported yet can still display artwork.

### `artwork_role` Values

| Role | Description | Provider |
|---|---|---|
| `cover_front` | Front cover art | CAA, Fanart.tv `albumcover` |
| `artist_thumbnail` | Square artist photo | Fanart.tv `artistthumb` |
| `artist_background` | Wide artist banner | Fanart.tv `artistbackground` |
| `artist_logo` | Transparent logo | Fanart.tv `musiclogo` / `hdmusiclogo` |

### `source_provider` Values

| Provider | `source_provider` value |
|---|---|
| Cover Art Archive | `coverArtArchive` |
| Fanart.tv | `fanartTv` |
| Embedded extraction | `embedded_extract` (existing) |
| Sidecar file | `folder_sidecar` (existing) |

### Settings

| Namespace | Key | Type | Default | Notes |
|---|---|---|---|---|
| `artwork` | `fanartTvEnabled` | `boolean` | `false` | Master switch |
| `artwork` | `dailyQuotaLimit` | `integer` | `1000` | Daily request limit per provider |
| `artwork` | `providerOrder` | `string[]` | `['coverArtArchive']` | `fanartTv` also supported |

Encrypted secrets:

| `secret_type` | `name` | Notes |
|---|---|---|
| `integration_credential` | `providers.fanartTv.apiKey` | Fanart.tv **Project** API Key (application-level, 7-day delay) |
| `integration_credential` | `providers.fanartTv.clientKey` | Fanart.tv **Personal** API Key (user-level, 2-day delay, takes priority) |

Both keys are optional independently. If both are configured, both are sent in request headers (`api-key` + `client-key`).

## API Endpoints

### Single Artwork Resolution

```
GET /api/v1/artwork/resolve?owner_type={type}&owner_id={id}&artwork_role={role}&refresh={bool}
```

| Parameter | Required | Description |
|---|---|---|
| `owner_type` | Yes | `musicbrainz_release`, `musicbrainz_release_group`, `musicbrainz_artist` |
| `owner_id` | Yes | MusicBrainz MBID |
| `artwork_role` | No | Default `cover_front`. For artists: `artist_thumbnail`, `artist_background`, `artist_logo` |
| `refresh` | No | `true` or `1` to bypass cached assignment and re-fetch from external providers |

**Auth:** Any authenticated session.

**Response (found):**

```json
{
  "url": "/api/v1/artwork/assets/550e8400-e29b-41d4-a716-446655440000/file",
  "assetId": "550e8400-e29b-41d4-a716-446655440000",
  "sourceProvider": "fanartTv",
  "cached": true,
  "dominantColor": { "hue": 210.5, "chroma": 0.12, "lightness": 0.45 }
}
```

**Response (not found):**

```json
{
  "url": null,
  "assetId": null,
  "sourceProvider": null,
  "cached": false,
  "quotaExceeded": false
}
```

**Response (quota exceeded):**

```json
{
  "url": null,
  "assetId": null,
  "sourceProvider": null,
  "cached": false,
  "quotaExceeded": true
}
```

**Logic:**

1. If `refresh` is false (default): check `artwork_assignments` for an existing preferred assignment. If found, return immediately (`cached: true`).
2. If `artwork.fetchEnabled` is `true`:
   a. Check quota for each provider — skip if daily limit exceeded.
   b. For releases: try CAA first. For release groups: try CAA, then Fanart.tv as fallback.
   c. For artists: try Fanart.tv.
   d. If a provider returns artwork, ingest through `artwork_ingestion_service`, create assignment, increment quota, return URL (`cached: false`).
3. If no provider returns artwork, return not-found. If any provider had quota exceeded, set `quotaExceeded: true`.

### Batch Artwork Resolution

```
POST /api/v1/artwork/resolve-batch
```

```json
{
  "requests": [
    { "ownerType": "musicbrainz_artist", "ownerId": "mbid-1", "artworkRole": "artist_thumbnail" },
    { "ownerType": "musicbrainz_release_group", "ownerId": "mbid-2" },
    { "ownerType": "musicbrainz_artist", "ownerId": "mbid-3", "artworkRole": "artist_thumbnail", "refresh": true }
  ]
}
```

Each request item may include `"refresh": true` to bypass cache for that specific item. The server normalizes truthy values (`true`, `'true'`, `1`, `'1'`) to boolean `true`.

**Auth:** Any authenticated session. Rate limited to 30 requests per minute.

**Response:**

```json
{
  "resolved": {
    "musicbrainz_artist:mbid-1:artist_thumbnail": { "url": "...", "assetId": "...", "cached": true, "sourceProvider": "fanartTv", "quotaExceeded": false },
    "musicbrainz_release_group:mbid-2:cover_front": { "url": null, "assetId": null, "cached": false, "sourceProvider": null, "quotaExceeded": false }
  }
}
```

Keys are `{ownerType}:{ownerId}:{artworkRole}`. Batch limit: 50 items per call. Items are resolved concurrently via `Promise.all`.

### Artwork File Serving

```
GET /api/v1/artwork/assets/:assetId/file
```

**Auth:** Any authenticated session.

**Response:** The stored image file with `Content-Type`, `Content-Length`, and `Cache-Control: public, max-age=31536000, immutable` (artwork is content-addressable by SHA256).

### Artwork Quota Status

```
GET /api/v1/artwork/quota
```

**Auth:** Admin only.

**Response:**

```json
{
  "providers": [
    {
      "provider": "fanartTv",
      "enabled": true,
      "apiKeyConfigured": true,
      "today": { "requestCount": 47, "date": "2026-05-15" },
      "dailyLimit": 1000
    },
    {
      "provider": "coverArtArchive",
      "enabled": true,
      "today": { "requestCount": 23, "date": "2026-05-15" },
      "dailyLimit": 1000
    }
  ],
  "limit": 1000
}
```

## Client-Side Wiring

### ArtworkImage Component (3-Tier Fallback)

`ArtworkImage.vue` uses a priority chain:

1. `localSrc` prop (server-cached artwork URL)
2. Direct CAA browser fetch by MBID
3. Placeholder SVG

No changes were needed to the fallback logic — passing `localSrc` from the batch resolver activates tier 1.

### `useArtworkBatchResolve` Composable

Instantiated once per view. Handles:

- **Auto-batching:** Splits requests into 50-item chunks, sends them concurrently.
- **Caching:** Results stored in a reactive `artworkMap` ref keyed by `{ownerType}:{ownerId}:{artworkRole}`.
- **Lookup:** `getResolved(ownerType, ownerId, artworkRole)` returns the full result object or `null`.
- **Graceful failure:** If the batch request fails, existing map entries are preserved and cards degrade to CAA direct / placeholder.

### Integration Points

| View | Trigger | What resolves |
|---|---|---|
| `SearchView` | After search results load | Artist thumbnails + release covers |
| `LibraryView` | Watches `displayReleases` | Release covers (with release/release-group MBID fallback) |
| `ArtistDetailView` | On mount + MBID change | Hero: `artist_background` + `artist_thumbnail` via single resolve. Discography: `cover_front` via batch resolve. Related artists: `artist_thumbnail` via batch resolve |
| `DiscoverView` | Watches `seeds`, `suggestions`, `results` | Seed chips: `artist_thumbnail` with circular 1.5rem avatar. Suggestions + search results: `artist_thumbnail` via batch resolve with `<img>` / avatar fallback |

### Artist Detail Hero

The artist detail page resolves two artwork types for the hero section:

- `artist_background`: Full-width background image with gradient overlay (semi-transparent to base color)
- `artist_thumbnail`: 5rem × 5rem rounded image with shadow

Both are decorative — failures silently degrade to a text-only header with placeholder icon.

A ghost icon button in the hero allows manual refresh. When clicked, it re-resolves both artwork types with `refresh: true` and shows a spinning animation during the request.

### Related Artists Artwork

The artist detail page batch-resolves `artist_thumbnail` for each related artist MBID. Results are stored in a `relatedArtwork` ref (separate from discography artwork).

In the template, each related artist chip shows:
- `<img>` with `loading="lazy"` when artwork is available (4rem circular, `object-fit: cover`)
- Colored-initial avatar fallback when no artwork exists

### Discover View Artwork

The Discover page batch-resolves `artist_thumbnail` for three contexts:

1. **Seed chips**: Small circular 1.5rem avatar images shown alongside the seed artist name. Falls back to a colored-initial circle when no artwork is available.
2. **Suggestion cards**: Full-size artist card artwork in the suggestions grid. `<img>` with `loading="lazy"` when available, colored-initial avatar fallback.
3. **Search result cards**: Same pattern as suggestion cards, applied to artist search results.

A single `useArtworkBatchResolve` instance is shared across all three contexts. Separate `watch`ers on `seeds`, `suggestions`, and `results` trigger batch resolves reactively as each list changes.

### Card Props

Both `ArtistCard.vue` and `ReleaseCard.vue` accept:

| Prop | Type | Description |
|---|---|---|
| `localSrc` | `String` | Server-cached artwork URL (tier 1) |
| `dominantColor` | `Object` | OKLCH color for placeholder tinting |
| `artworkAssetId` | `String` | Asset UUID for client-side color extraction |

## Quota Tracking

### Service Design

`artworkQuotaService` provides three operations:

- **`incrementQuota(provider)`**: Atomic UPSERT into `artwork_provider_quota`, increments `request_count`. Updates in-memory cache.
- **`isQuotaExceeded(provider)`**: Checks in-memory cache against `dailyQuotaLimit`. Returns `false` if no limit configured.
- **`getQuotaStatus()`**: Returns all provider statuses for the dashboard.

### In-Memory Cache

The quota service maintains an in-memory cache:

- Keyed by `(provider, date)`.
- Invalidated automatically when the date changes (next-day reset).
- Updated on each `incrementQuota` call.
- Bypasses database reads for quota checks on every external API call.

### Daily Limit

- Configured via `artwork.dailyQuotaLimit` setting (default: 1000, positive integer).
- Applied **per provider** — each provider gets the same daily budget.
- Checked **before** each external API call. If exceeded, the call is skipped and `quotaExceeded: true` is returned.
- Cache hits (existing assignments) do not count against quota — only actual external fetches increment the counter.

### Quota Dashboard

Located in Settings > Media & Storage. Shows:

- Per-provider progress bar (usage / limit) with tone-based coloring (sun for normal, moon for approaching limit, eclipse for exceeded).
- Per-provider usage count and remaining count.
- "Daily request limit" input field in the cover art section (applies globally).

## Refresh Support

### Single Resolve

The `?refresh=true` query parameter on the single resolve endpoint:

1. **Skips** the cached assignment lookup.
2. **Re-fetches** from external providers (CAA → Fanart.tv).
3. **Creates new** assets and assignments (does not delete old ones — priority-based selection handles it).

### Batch Resolve

Each item in the `requests` array of `POST /api/v1/artwork/resolve-batch` may include `"refresh": true`. The server normalizes truthy variants (`true`, `'true'`, `1`, `'1'`) and forwards the boolean to `resolveArtwork` per item. This allows selective re-fetch within a batch — e.g., refreshing one stale artist thumbnail while using cache for the rest.

### Client-Side Refresh Button

The artist detail hero includes a ghost icon button (refresh icon) that:

1. Calls `resolveArtwork` with `refresh: true` for both `artist_background` and `artist_thumbnail`.
2. Shows a spinning animation on the button while the request is in flight (`isRefreshingArtwork` ref).
3. Updates the hero images on success. Failures are silent (hero degrades to text-only).

This allows operators to force artwork re-fetch for specific items without clearing the entire cache.

## Fetch Strategies

### Provider Priority

| Owner Type | Primary | Fallback |
|---|---|---|
| `musicbrainz_release` | CAA | — |
| `musicbrainz_release_group` | CAA | Fanart.tv `albumcover` |
| `musicbrainz_artist` | Fanart.tv (all types) | — |

### When to Fetch

| Trigger | What | Why |
|---|---|---|
| Search results render | Artists + releases in results | Immediate visual feedback; batch resolve in parent view |
| Library view loads | Releases in library | Local artwork already cached from scans; resolve fills gaps |
| Artist detail page loads | Full Fanart.tv profile (thumbnail + background) | Hero section needs multiple image types |
| Artist detail discography | Release group covers | Batch resolve for all release groups in the artist's catalog |
| Artist detail related artists | Artist thumbnails for related artists | Batch resolve `artist_thumbnail` for each related artist MBID |
| Discover seed chips | Artist thumbnails for seeds | Batch resolve `artist_thumbnail` when seeds change |
| Discover suggestions | Artist thumbnails for suggestions | Batch resolve `artist_thumbnail` when suggestions update |
| Discover search results | Artist thumbnails for results | Batch resolve `artist_thumbnail` when search results load |
| Refresh button click | Hero background + thumbnail | Force re-fetch with `refresh: true`, bypass cache |

### Cache Behavior

- **First request:** Server checks `artwork_assignments`. If empty, fetches from external provider, ingests, assigns, returns URL.
- **Subsequent requests:** Server returns the cached asset URL immediately. No external call.
- **Re-fetch (`?refresh=true`):** Skips assignment lookup, re-fetches from external providers, creates new assets + assignments.

### Rate Limiting

**Cover Art Archive:**

- Serial request queue with 1100ms minimum interval between requests.
- Retries on 503 (up to 3 attempts with exponential backoff).

**Fanart.tv:**

- Retries on 429 and 5xx (up to 3 attempts with exponential backoff).
- Quota tracked in `artwork_provider_quota` and checked before each call.

### Storage Estimates

Fanart.tv images:

| Image Type | Typical Size | Typical Dimensions |
|---|---|---|
| `artistthumb` | 50–150 KB | 500×500 to 1000×1000 |
| `artistbackground` | 200–500 KB | 1920×1080 |
| `musiclogo` | 30–80 KB | 800×310 (transparent PNG) |

CAA covers:

| Image Type | Typical Size | Typical Dimensions |
|---|---|---|
| Front cover | 100–500 KB | 500×500 to 1500×1500 |

For a library of 1,000 artists with 3 image types each:

- 1,000 × 3 × 200 KB average = ~600 MB
- Plus 3,000 releases × 300 KB average = ~900 MB
- Total: ~1.5 GB for a medium library

SHA256 deduplication reduces this since many releases share the same cover art.

### Database Impact

Per artist (Fanart.tv, 3 image types):

- 3 rows in `artwork_assets` (one per image type)
- 3 rows in `artwork_assignments` (one per owner+role)

Per release (CAA):

- 1 row in `artwork_assets`
- 1 row in `artwork_assignments`

For 1,000 artists + 3,000 releases:

- ~6,000 `artwork_assets` rows
- ~6,000 `artwork_assignments` rows

`artwork_provider_quota` accumulates ~730 rows per year per provider. Prune after 90 days to keep it under 200 rows.

## Implementation Sequence

### Phase 1: Artwork Serving Endpoint (Complete)

1. `artwork-serve-service.js` — asset lookup, path traversal protection.
2. `GET /api/v1/artwork/assets/:assetId/file` route with session auth, immutable cache headers.
3. Tests: 6 service tests + 3 route tests.

### Phase 2: CAA Client + Proxy + Resolve Endpoints (Complete)

1. `cover-art-archive-client.js` — HTTP client with serial queue, rate limiting, retries.
2. `artwork-fetch-service.js` — resolve pipeline (cache → CAA → ingest → assign → return URL), batch resolve.
3. `GET /api/v1/artwork/resolve` and `POST /api/v1/artwork/resolve-batch` routes.
4. Tests: 8 CAA client + 10 fetch service + 5 resolve route tests.

### Phase 3: Fanart.tv Integration + Client Wiring (Complete)

1. `fanart-client.js` — dual-key auth, image selection, retries on 429/5xx.
2. Fanart.tv secrets in `provider-credentials-service.js`, settings in validator, provider card in SettingsConnectionsView.
3. Wired Fanart.tv into fetch service as fallback for release groups and primary for artists.
4. `useArtworkBatchResolve` composable — auto-batches in 50-item chunks.
5. Updated ArtistCard, ReleaseCard, SearchView, LibraryView.
6. Tests: 8 Fanart.tv client + 8 batch resolve composable tests.

### Phase 4: Quota, Dashboard, Refresh, Hero (Complete)

1. `artwork-quota-service.js` — atomic UPSERT, in-memory cache, daily invalidation.
2. `dailyQuotaLimit` setting + policy exposure.
3. Quota check before external calls, increment after successful fetch, skip for cache hits.
4. `GET /api/v1/artwork/quota` admin route.
5. `useArtworkQuota` composable + `artwork-quota-presentation.js` helpers.
6. Quota dashboard card in SettingsMediaStorageView.
7. `?refresh=true` support on single resolve endpoint.
8. Artist detail hero: background + thumbnail + discography batch resolve.
9. Tests: 9 quota service + 4 quota integration + 1 quota route + 3 refresh tests.

### Phase 4d–4j: Polish & Extensions (Complete)

1. End-to-end integration polish — removed unused imports, fixed stale test assertions.
2. Design doc update (first pass).
3. Client-side refresh button — ghost icon button on artist detail hero with spinning animation. `artwork-api.js` accepts `refresh` param.
4. Pre-existing test fixes — `operation-run-store`, `settings-form`, `useOperationHistory` auto-select bug. All tests green.
5. Batch resolve refresh — `resolveArtworkBatch` forwards `request.refresh` per item, route normalizes truthy variants.
6. Related artists artwork — batch resolves `artist_thumbnail` for related artists, `<img>` with `loading="lazy"`, avatar fallback.

### Phase 4k–4l: Design Doc + Discover View (Complete)

1. Design doc final update — reflects batch refresh, related artists artwork, refresh button, per-item batch refresh normalization.
2. Discover view artwork — `useArtworkBatchResolve` integrated into `DiscoverView.vue`. Three watchers on `seeds`, `suggestions`, `results` batch-resolve `artist_thumbnail`. Seed chips: circular 1.5rem avatar with colored-initial fallback. Suggestions + search results: full card artwork with `<img>` / avatar fallback.

## Security Considerations

- API keys stored in `encrypted_secrets` (AES-256-GCM), never sent to the client in GET responses.
- Artwork serve endpoint requires authentication. Asset UUIDs are not guessable but auth is enforced regardless.
- Resolve endpoint requires authentication so unauthenticated users cannot burn through quota.
- `Cache-Control: public, max-age=31536000, immutable` is safe because artwork content is addressed by SHA256.
- Batch resolve endpoint limits to 50 items and 30 requests/minute.
- Quota enforcement prevents runaway external API calls.
