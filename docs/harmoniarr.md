# Harmoniarr

## Document Purpose

This is a living planning document for Harmoniarr, a standalone Docker-hosted music library manager inspired by Lidarr, but designed around Soulseek as the primary acquisition source.

The goal is to keep early product, architecture, and implementation decisions in one place before code is written. This document should be updated as assumptions are validated, design decisions are made, and implementation details become concrete.

## Working Concept

Build Harmoniarr as a self-hosted application that combines music library management, metadata, Soulseek search, candidate scoring, download orchestration, and import review.

The application should not simply clone Lidarr or act as a prettier Soulseek client. Its purpose is to make finding, choosing, downloading, and importing music from Soulseek significantly better than doing it manually.

## Core Direction

The app will run as its own Docker service and interface with Soulseek through an API layer.

The preferred initial Soulseek backend is `slskd`, because it already provides:

- Soulseek network login
- Search
- User browsing
- Download queueing
- Transfer monitoring
- API authentication
- Docker-friendly deployment

The app should treat `slskd` as the Soulseek engine, while owning the higher-level library and decision-making logic.

## Product Positioning

This should be a Soulseek-native acquisition and library manager.

The first strong milestone should be:

> Make finding, choosing, downloading, and importing music from Soulseek significantly better than doing it manually.

Full automation should come later, after matching, transfer handling, and import confidence are reliable.

## Why This Exists

The primary reason for the app is simple: a user wants a particular album, release, or song, and Soulseek is often the best place to find it.

The problem is that Soulseek is powerful but not organized around library management. It exposes people, folders, files, queues, and searches. It does not know what the user's music library is missing, which release is intended, whether a folder is complete, whether filenames match the expected track list, or whether the download should be imported.

This app exists to bridge that gap.

It should turn a user's music intent into a reliable acquisition workflow:

```text
I want this music
  -> understand what "this music" means
  -> search Soulseek safely and repeatably
  -> identify plausible sources
  -> explain which candidate is best
  -> download selected files
  -> validate the result
  -> import cleanly into the library
```

### Problems To Solve

Manual Soulseek acquisition has several recurring problems:

- Search terms are inconsistent and often need multiple attempts.
- Results are file-oriented, while albums are usually folder-oriented.
- Folder names, filenames, tags, and release metadata often disagree.
- Search results do not prove that a folder contains the full album.
- Users may share partial albums, duplicates, alternate editions, or unrelated files.
- Queue length and user availability can make a good-looking result impractical.
- Repeating failed searches manually is tedious.
- Remembering trusted, slow, blocked, or unreliable users is manual.
- Completed downloads still need validation, cleanup, tagging, and import decisions.
- Existing library managers are not designed around Soulseek's messy peer-to-peer model.

The app should solve these by treating Soulseek as an acquisition network, not as a traditional indexer.

### User Problems

The user-facing problems are:

- "I want this album, but I do not want to manually inspect every search result."
- "I want to know whether this folder really matches the release I asked for."
- "I want missing tracks filled without replacing albums that are already good."
- "I want to avoid downloading bad matches, partial folders, and junk extras."
- "I want the app to remember what worked, what failed, and which users are reliable."
- "I want completed downloads to become a clean library, not a pile of files."
- "I want automation eventually, but only after the app can explain its choices."

These should drive the first product decisions more than broad Lidarr parity.

### Why Not Just Lidarr

Lidarr is built around indexers, releases, download clients, and a relatively structured automation model. Soulseek behaves differently:

- Search is fuzzy and user-driven.
- Results may be loose files instead of releases.
- Folder browsing is often required to confirm an album.
- Download availability depends on individual users, queues, and sharing behavior.
- The best candidate may be found through multiple weak signals rather than one clean release result.

The goal is not to replace every Lidarr feature immediately. The goal is to build the parts that Lidarr-style workflows do not handle well when Soulseek is the primary source.

### Why Not Just slskd

`slskd` is the Soulseek engine and should remain the integration point for the network. It already solves login, search, browsing, queueing, and transfer control.

This app should solve the layer above `slskd`:

- Music metadata awareness
- Wanted state
- Library state
- Candidate grouping
- Album and track matching
- Scoring and review
- Download intent
- Import validation
- Historical decisions
- User trust over time

In other words, `slskd` answers "what can Soulseek do right now?" This app answers "what should we do with that capability for this library?"

### How We Solve It

The design should solve the problem through a few core mechanisms:

- Convert user intent into durable wanted items.
- Generate deterministic search strategies instead of relying on one query.
- Store raw Soulseek observations before making decisions.
- Group file results into folder/user candidates.
- Browse promising folders before trusting search results.
- Match candidates against expected metadata with tolerant rules.
- Score candidates using explainable factors.
- Require manual review until confidence is proven.
- Track transfers and imports as stateful workflows.
- Remember user-level outcomes to improve future decisions.
- Preserve history so every decision can be explained later.

This is why the app should be time-based, Postgres-backed, and pipeline-driven from the beginning.

### Success Criteria

The first useful version should be considered successful when it can:

- Take a specific album request.
- Search Soulseek through `slskd`.
- Produce ranked album candidates.
- Explain why each candidate did or did not match.
- Let the user download one selected candidate.
- Track the transfer to completion.
- Present completed files for import review.
- Record enough history to retry, debug, or improve the decision later.

The app should feel useful before full automation exists. Good manual-assisted acquisition is the foundation for trustworthy automation.

## Metadata Provider Direction

MusicBrainz should be the primary canonical metadata source for artists, albums, releases, and tracks.

It is a strong fit because the app needs stable music identity, not just display metadata. MusicBrainz provides stable MBIDs and a useful hierarchy:

```text
Artist
  -> Release Group
      -> Release
          -> Medium
              -> Track
                  -> Recording
```

This maps well to the app's core questions:

- Which artist did the user mean?
- Which album concept did the user mean?
- Which release or edition should be targeted?
- How many discs and tracks are expected?
- What are the expected track titles?
- What alternate names, aliases, or artist credits should help search?
- Is this an album, EP, single, compilation, soundtrack, bootleg, live release, or other type?

MusicBrainz should be used as the source of truth for:

- Artist identity
- Release group identity
- Release identity
- Release type and status
- Release dates
- Country and label metadata when available
- Medium/disc layout
- Track names and positions
- Recording links
- Artist credits
- Aliases and alternate titles
- External relationship links when useful

### Why MusicBrainz First

MusicBrainz is the best initial metadata component because it is structured around music catalog identity. The app's matching and wanted-state logic needs canonical IDs and release structure more than popularity data.

This is especially important for Soulseek because a search result may only contain filenames and folder paths. The app needs a known target to compare those messy results against.

MusicBrainz gives us the target:

```text
Expected release:
  artist
  album title
  release year
  disc count
  track count
  track titles
  aliases
  release type/status
```

Soulseek gives us observations:

```text
Observed files:
  username
  folder path
  filename
  extension
  size
  bitrate/format when available
  queue and transfer details
```

The app's job is to compare the observed Soulseek data against the expected MusicBrainz metadata.

### MusicBrainz Caveats

MusicBrainz should not be treated as perfect.

Known caveats:

- Some artists and releases have incomplete metadata.
- Some releases have many editions that differ only slightly.
- Tracklists may differ by country, format, deluxe edition, remaster, or bonus tracks.
- User expectations may target a loose "album concept" rather than one exact release.
- Public API usage must be rate-limited and identify the application with a meaningful User-Agent.
- The public API should be cached aggressively to avoid repeated lookups.

Because of this, the app should model both:

- `release_group`: the user's broad album intent.
- `release`: the specific tracklist/version used for matching.

For v1, the user can select a preferred release when adding an album, and the app can default to an official release with a sensible country/date/format preference.

### Cover Art

Cover Art Archive should be the first artwork provider because it is directly connected to MusicBrainz release and release-group MBIDs.

Artwork should be cached locally and treated as optional. Missing artwork should never block search, matching, download, or import workflows.

### Secondary Metadata Sources

Secondary providers can be added later, but they should not replace MusicBrainz as the identity backbone.

Potential secondary roles:

- Discogs: useful for physical editions, labels, catalog numbers, and some artwork gaps.
- Spotify/Apple/Tidal/Deezer: useful for popularity, modern digital availability, and sometimes artwork, but not ideal as canonical library identity.
- Last.fm/ListenBrainz: useful for listening stats, popularity, recommendations, and discovery signals.
- Local tags: useful for import validation and existing library scans.

The initial design should keep a metadata provider abstraction, but not overbuild multi-provider merging in v1.

### Metadata Alternatives Considered

There is no single obvious provider that is strictly better than MusicBrainz for this app's first metadata layer. Some providers are better for specific jobs.

MusicBrainz should remain the canonical identity backbone because it provides stable MBIDs across artists, release groups, releases, recordings, works, labels, areas, places, URLs, and tracks. Those identifiers are useful for disambiguation and long-term library management.

Alternative provider fit:

- Discogs: stronger for physical release editions, formats, catalog numbers, labels, barcodes, marketplace-adjacent metadata, and collector-style release variants. It may be better than MusicBrainz when the user cares about a very specific pressing or edition. It should be considered a strong secondary provider, especially for release enrichment.
- Spotify: strong for mainstream digital catalog search, popularity, modern album grouping, artist images, and user familiarity. It is weaker as a canonical source because it is a streaming catalog with market availability constraints, attribution requirements, and service-specific IDs.
- Apple Music: similar role to Spotify, with broad catalog metadata, charts, recommendations, and catalog search. It may be useful for mainstream metadata enrichment and artwork, but it should not be the canonical source for a self-hosted acquisition manager.
- AcoustID: not a replacement for MusicBrainz before search, but very useful after files are downloaded. It can fingerprint audio and return MusicBrainz-linked recordings, making it valuable for import validation and post-download correction.
- ListenBrainz: useful for listening history, popularity, recommendations, and discovery signals. It is part of the MetaBrainz ecosystem and works well alongside MusicBrainz identifiers, but it is not a primary release/tracklist catalog.
- TheAudioDB: useful for artwork, artist biographies, metadata decoration, and simple API access. It is not strong enough to be the canonical identity source for album matching.
- Commercial databases such as Gracenote, TiVo/Rovi, or Music Story: may be stronger in some commercial metadata areas, but they add licensing, cost, access, and redistribution constraints that do not fit the initial self-hosted design.

Practical conclusion:

```text
Canonical identity: MusicBrainz
Physical edition enrichment: Discogs
Artwork fallback/enrichment: Cover Art Archive, then optional Discogs/TheAudioDB/streaming providers
Mainstream popularity/discovery: ListenBrainz, Spotify, Apple Music
Post-download audio verification: AcoustID
```

The provider model should allow enrichment from multiple sources while keeping one canonical identity per managed item. For v1, that canonical identity should be MusicBrainz.

### Initial Metadata Flow

Artist add should use MusicBrainz first:

1. User searches for an artist.
2. App queries MusicBrainz artist search.
3. User selects the correct artist.
4. App stores the artist MBID and core artist metadata.
5. App fetches release groups for the artist.
6. App filters release groups based on user monitoring preferences.
7. App fetches selected release details and tracklists.
8. App creates wanted items from monitored missing releases.
9. App uses release metadata to generate Soulseek search queries.

Album add should work similarly:

1. User searches for artist and album text.
2. App searches MusicBrainz release groups and releases.
3. User picks the intended album/release.
4. App stores MBIDs and tracklist metadata.
5. App creates a wanted item and optionally starts discovery.

### Metadata Storage Principle

The app should store MusicBrainz identifiers and normalized local projections.

It should not depend on live MusicBrainz calls during search scoring. Search scoring should use locally cached metadata so the system remains fast, debuggable, and resilient when external services are slow or unavailable.

Recommended local records:

- `metadata_artists`
- `metadata_release_groups`
- `metadata_releases`
- `metadata_media`
- `metadata_tracks`
- `metadata_recordings`
- `metadata_aliases`
- `metadata_refresh_runs`

Each metadata record should track:

- Source provider
- Source identifier
- Fetched timestamp
- Last refresh timestamp
- Raw payload checksum
- Normalized projection

This fits the broader time-based design and lets the app explain which metadata version was used for a search or import decision.

## Release Monitoring And Detection

Harmoniarr should include a service that monitors known artists for newly published releases and turns relevant discoveries into wanted state.

This should cover:

- Albums.
- EPs.
- Singles.
- Live releases.
- Compilations.
- Remixes.
- Soundtracks or split releases where the monitored artist is relevant.
- Future-dated releases that should become wanted when they are released.

The service should not directly search Soulseek every time metadata changes. Its job is to detect new or changed music metadata, explain the decision, and update monitored or wanted state. Discovery scheduling should still decide when Soulseek searches are allowed to run.

### Monitoring Model

Release monitoring starts from a monitored artist.

Each monitored artist should have monitoring rules:

- Release types to watch, such as albums, EPs, singles, live releases, and compilations.
- Release statuses to include, such as official releases only by default.
- Whether future releases should be tracked before release date.
- Whether newly detected releases should become wanted automatically.
- Whether singles should be monitored by default or only shown for review.
- Country, format, and edition preferences for choosing a default release.
- Optional ignore rules for known noisy release groups, bootlegs, reissues, karaoke, tribute releases, or unrelated compilations.

Defaults should be conservative:

- Albums and EPs are monitored by default for monitored artists.
- Singles are detected but can require review unless the user enables automatic single monitoring.
- Compilations, live releases, remixes, and unofficial releases should be opt-in or review-first.
- Future releases should be visible, but should not trigger Soulseek search until the release date or a configured early-search window.

### Release Detector

The release detector is the comparison layer between provider metadata and Harmoniarr's known local state.

It should answer:

- Is this release group new for a monitored artist?
- Is this a new release or edition under an existing release group?
- Did the release type, status, date, title, artist credit, or tracklist change?
- Is this release relevant to the monitored artist, or only an incidental appearance?
- Is this a duplicate, merge, redirect, or provider correction for something already known?
- Should the discovery create a wanted item, update existing metadata, or only create a review event?

The detector should emit durable detection events rather than silently changing state.

Example event types:

- `release_group_detected`
- `release_detected`
- `release_changed`
- `release_date_changed`
- `tracklist_changed`
- `release_merged`
- `release_removed_or_unavailable`
- `release_reclassified`
- `release_ignored_by_policy`
- `release_needs_review`

This "detector" layer is intentionally separate from metadata fetching. Fetching asks providers what exists. Detection decides what changed and what that change means for this library.

### Detection Flow

Suggested flow:

```text
Scheduled artist metadata refresh
  -> fetch release groups for monitored artist
  -> normalize provider payloads
  -> compare with local metadata snapshot
  -> emit release detection events
  -> apply monitoring policy
  -> create or update release records
  -> reconcile wanted state
  -> schedule discovery only when eligible
```

The detector should use local snapshots and source identifiers. It should avoid making decisions from live provider responses that are not stored, because every detection should be explainable later.

### Wanted State Integration

Detected releases should flow into wanted reconciliation.

Rules:

- If a new monitored album or EP is detected and the library does not satisfy it, create a wanted album/release item.
- If a single is detected and single monitoring is disabled, create a review event but no wanted item.
- If a future-dated release is detected, create known metadata and pending monitored state, but hold search eligibility until policy allows it.
- If a release is reclassified from single to album or EP, re-run monitoring policy and wanted reconciliation.
- If a tracklist changes, update matching metadata and flag existing candidates, downloads, or imports that used the old tracklist.
- If a release is merged or redirected by MusicBrainz, preserve historical IDs and map them to the surviving canonical record.

The user should be able to see why something became wanted:

```text
Detected new official album for monitored artist
  -> album monitoring enabled
  -> not present in library
  -> wanted item created
```

### Scheduling And Rate Limits

Release monitoring should respect provider rate limits, especially MusicBrainz.

Initial cadence:

- Refresh newly added artists immediately.
- Refresh monitored artists on a staggered daily or weekly schedule.
- Refresh artists with recent or future releases more frequently.
- Refresh inactive artists less frequently after their catalog is stable.
- Allow manual refresh from the artist page.

The app should avoid synchronized refresh spikes after container restart. Scheduled checks should be jittered and persisted.

Release monitoring should not create unbounded search traffic. New wanted items should enter the same discovery eligibility, cooldown, and rate-limit system as manually added wanted items.

### UI Surface

Release monitoring should appear in the UI as part of artist, wanted, and activity views.

Expected UI elements:

- Artist page section for recently detected releases.
- Monitoring settings for albums, EPs, singles, live releases, compilations, and future releases.
- Detection history showing provider, timestamp, detected change, policy decision, and resulting wanted state.
- Review queue for detected releases that need user confirmation.
- Badges for future releases, newly detected releases, ignored releases, and review-required releases.
- Manual refresh action on artist pages.

The UI should make detection explainable. A user should not see a surprise wanted item without being able to trace it back to a release detection event and monitoring rule.

### Suggested Records

Release monitoring may need records such as:

- `artist_monitoring_rules`
- `metadata_provider_snapshots`
- `release_detection_runs`
- `release_detection_events`
- `release_monitoring_decisions`
- `release_redirects`
- `future_release_holds`

These records should preserve enough raw and normalized data to explain provider changes without depending on current live provider state.

## Dependency Heartbeat And Provider Limits

Harmoniarr should include a dependency heartbeat service that tracks the health, availability, and rate-limit state of external and local dependencies.

This service should support:

- `slskd` API availability and authentication.
- MusicBrainz API availability, rate limiting, and User-Agent configuration.
- Cover Art Archive availability.
- AcoustID availability and fingerprint lookup health.
- Optional ClamAV availability and signature freshness when antivirus scanning is enabled.
- Local Postgres health.
- Background worker health.
- Library and download path read/write checks.
- Local media tools such as `ffmpeg`, `ffprobe`, and Chromaprint tooling.
- Socket.IO or realtime update health if the app exposes a realtime status channel.

Heartbeat should not mean "spam every dependency every few seconds." The service should use dependency-appropriate checks. Local services can tolerate more frequent checks, while public metadata providers should rely mostly on passive health from real requests plus low-frequency probes.

### Heartbeat Responsibilities

The heartbeat service should:

- Record the last successful check per dependency.
- Record the last failure per dependency with status code, error class, and timestamp.
- Track current dependency state, such as `healthy`, `degraded`, `rate_limited`, `unreachable`, `misconfigured`, or `disabled`.
- Expose dependency state to the scheduler so blocked jobs do not keep retrying aggressively.
- Expose dependency state to the UI so users can see why searches, metadata refreshes, imports, or fingerprinting are paused.
- Emit operational events when dependencies recover or degrade.
- Apply backoff and circuit-breaker behavior for repeated failures.

The heartbeat service should not own domain decisions. For example, it can say MusicBrainz is rate limited or unavailable, but metadata refresh policy should decide when to retry a specific artist.

### MusicBrainz API Limits

MusicBrainz must be treated as a rate-limited public dependency.

Official guidance currently requires:

- No more than one request per second from the client application.
- A meaningful User-Agent header that includes application identity and contact information.
- Avoiding synchronized background jobs that wake up at fixed times across installations.
- Avoiding frequent polling just to check whether metadata changed.

Harmoniarr should implement this as adapter-level policy:

- A MusicBrainz-specific rate limiter with a default ceiling of one request per second.
- A configured User-Agent such as `Harmoniarr/<version> (<project-url-or-contact>)`.
- Persistent request queues for metadata refresh and release monitoring.
- Randomized jitter for scheduled metadata refreshes.
- Aggressive local caching of MusicBrainz responses and normalized projections.
- Conditional refresh policy based on artist activity, recent release dates, stale metadata age, and user action.
- Backoff on HTTP 503 and other throttling or temporary service errors.
- No heartbeat probe that consumes MusicBrainz quota more often than necessary.

Manual user actions may be prioritized, but they still must respect the MusicBrainz adapter rate limiter.

### Provider Rate-Limit Model

Each external provider adapter should define its own limits and retry behavior.

Provider configuration should include:

- Requests per second or minimum interval.
- Burst behavior, if any.
- Required headers.
- Authentication requirements.
- Retryable status codes.
- Backoff schedule.
- Cache TTL rules.
- Whether health should be active, passive, or both.

This keeps MusicBrainz-specific rules out of generic heartbeat code while still letting the heartbeat service report provider health consistently.

### Scheduler Integration

Schedulers should consult dependency state before creating work.

Examples:

- Do not dispatch metadata refresh jobs while MusicBrainz is rate limited or unreachable.
- Do not dispatch Soulseek searches while `slskd` is unreachable or unauthenticated.
- Do not create fingerprint lookup jobs while AcoustID is unavailable.
- Do not start import jobs if the library root is not writable.
- Do not start transcode jobs if `ffmpeg` or the temporary transcode path is unavailable.

Blocked work should remain durable and explainable. The UI should be able to show:

```text
Metadata refresh paused
Reason: MusicBrainz rate limited
Next retry: 2026-04-26 14:25:00
```

### Suggested Records

Dependency heartbeat may need records such as:

- `dependency_checks`
- `dependency_status`
- `dependency_events`
- `provider_rate_limit_state`
- `provider_request_log`
- `worker_heartbeats`
- `path_health_checks`

The current status tables can be compact projections, but historical check and event records should be retained long enough to debug recurring service problems.

## Architecture Principle

Soulseek compatibility should drive the architecture.

The application should avoid leaking `slskd` implementation details into the domain model. Instead, it should define an internal acquisition interface that can be backed by `slskd` first and potentially other Soulseek integrations later.

```text
Application Domain
  Artists
  Albums
  Wanted items
  Candidate scoring
  Imports
  Library state

Soulseek Service Layer
  Search
  Browse user
  Enqueue files
  Read transfers
  Cancel/retry downloads

slskd Adapter
  HTTP/API calls
  Authentication
  Response normalization
  Error translation
```

## Code Organization Principle

The implementation should avoid large singleton files and oversized all-purpose services.

The backend should be organized around small shared service files with clear ownership. Each service should own one bounded responsibility and expose a narrow API. Larger workflows should compose these services rather than growing into one central manager.

Preferred shape:

```text
domain/
  wanted/
  metadata/
  discovery/
  candidates/
  downloads/
  imports/
  library/
  users/

integrations/
  slskd/
  musicbrainz/
  acoustid/
  cover-art-archive/

workers/
  dependency-heartbeat/
  search-dispatcher/
  candidate-builder/
  folder-browser/
  transfer-reconciler/
  import-validator/
  metadata-refresher/
  release-detector/
  quality-upgrade-detector/
  wanted-reconciler/
```

Each domain area should prefer several focused files over a single large module.

Example for discovery:

```text
discovery/
  search-job-service
  query-generator
  search-result-normalizer
  source-candidate-builder
  folder-browse-policy
  candidate-match-service
  candidate-score-service
  discovery-history-repository
```

Example for imports:

```text
imports/
  import-review-service
  file-inspection-service
  tag-reader-service
  duration-validator
  acoustid-validation-service
  import-confidence-service
  library-write-service
```

### Service Boundaries

Services should be small enough that their purpose is obvious from the filename.

Guidelines:

- Keep adapters separate from domain logic.
- Keep repositories separate from workflow orchestration.
- Keep scoring factors separate from score orchestration.
- Keep validators separate from the import review state machine.
- Keep background worker entrypoints thin.
- Keep API route handlers thin.
- Keep UI data mapping separate from backend domain models.
- Prefer pure functions for normalization, matching, scoring, and eligibility rules where practical.
- Prefer explicit dependency injection over hidden process-wide singletons.

Acceptable singleton-like objects:

- Database pool
- Logger
- Configuration provider
- Metrics registry
- Job queue connection

These should be infrastructure dependencies, not places where domain logic accumulates.

### Workflow Composition

Long workflows should be expressed as orchestration over smaller services.

For example, a search dispatch worker should not contain query generation, slskd response normalization, candidate grouping, scoring, and persistence in one file. It should coordinate:

```text
wanted eligibility
  -> query generation
  -> slskd adapter call
  -> result normalization
  -> result persistence
  -> candidate build job enqueue
```

This keeps each piece testable and lets us improve Soulseek behavior without rewriting large files.

### Frontend Organization

The frontend should follow the same principle.

Avoid one large page file that contains fetching, state management, table rendering, modal behavior, and domain mapping.

Preferred pattern:

- Page files compose features.
- Feature folders own their local UI and hooks.
- Shared components stay generic.
- API clients stay outside components.
- Domain-specific table columns, filters, and actions live beside the feature that owns them.

Example:

```text
client/features/wanted/
  WantedPage
  WantedTable
  wantedColumns
  useWantedItems
  wantedStatusBadge

client/features/candidates/
  CandidateReviewPage
  CandidateComparisonTable
  CandidateScoreBreakdown
  useCandidateActions
```

Shared frontend infrastructure should include:

```text
client/composables/useSWR
client/constants/cacheKeys
client/api/*
```

Feature composables should wrap SWR rather than making large page files own fetch logic directly.

Examples:

```text
useDashboardData
useMissingItems
useActivityQueue
useManualSearchSession
useSystemHealth
useErrorLogs
```

The goal is to make future changes local. If matching changes, we should know where to look. If slskd changes, the adapter should absorb it. If candidate review UI changes, it should not require editing unrelated library or import screens.

## Codebase And Runtime Stack Direction

The app should follow the operational shape that makes Sonarr/Radarr successful for self-hosting:

- One web application users open in the browser.
- One API surface used by the frontend and integrations.
- Background workers for long-running tasks.
- A persistent app data volume.
- Clear health, logs, settings, and system status.
- Reverse-proxy support.
- Docker-first deployment.

The technology should be modern, but the runtime should stay boring. The app should be easy to run on a NAS, home server, mini PC, VM, or Docker host without requiring a complex platform.

### JavaScript Module Format

The project should use ES modules as the default JavaScript module format.

The root `package.json` should declare:

```json
{
  "type": "module"
}
```

With this setting, normal `.js` files are interpreted as ES modules by Node. Project scripts and application code should therefore use `.js` or `.ts` with `import` and `export` syntax.

Extension policy:

- Use `.js` for normal JavaScript source in this ESM package.
- Use `.ts` for normal TypeScript source when TypeScript is introduced.
- Reserve `.cjs` for rare CommonJS compatibility files.
- Reserve `.mjs` for rare cases where a file must be explicitly ESM outside the package scope or a tool specifically requires the extension.
- Reserve `.cts` and `.mts` only for TypeScript files that need explicit per-file CommonJS or ESM behavior.

This keeps the codebase consistent while still leaving escape hatches for future tooling, package publishing, or interoperability needs.

### Proposed Repository Shape

Initial shape:

```text
client/
  Vite Vue application

server/
  HTTP API
  background workers
  service modules
  integration adapters

database/
  migrations
  schema snapshot
  seed/test fixtures

scripts/
  migration helpers
  release helpers
  validation helpers
```

This should be a single repository and a single Docker image for the standard deployment.

### Frontend Stack

Recommended frontend stack, matching Classifarr where practical:

- Vite
- Vue 3
- Vue Router
- Pinia
- Axios
- Tailwind CSS
- Heroicons Vue
- VueUse, primarily for browser state helpers such as online/offline state
- Socket.IO client
- Vitest and Testing Library

Vite should be used as the frontend build tool. In development, Vite can serve the client with hot reload and proxy API calls to the backend. In production, the backend should serve the compiled static assets from the Docker image.

The first frontend should be a client-rendered SPA. Server-side rendering is not needed for v1 because the app is authenticated, operational, and dashboard-oriented rather than public content-oriented.

Vue is the best compatibility choice if Harmoniarr should stay close to Classifarr. It lets us reuse operational patterns, CI shape, linting strategy, component conventions, and developer context from Classifarr rather than maintaining a parallel React stack.

Frontend principles:

- Use URL state for filters, selected views, and review context where useful.
- Use Pinia for shared client state that is genuinely application-wide.
- Use local component state for UI-only state.
- Keep API access behind client service modules instead of calling Axios directly from large views.
- Use the Harmoniarr SWR composable for service-backed page/module data.
- Prefer feature folders over global component sprawl.
- Keep dense table and review experiences fast and keyboard-friendly.

### Backend Stack

Recommended backend stack, matching Classifarr where practical:

- Node.js 24 LTS
- Express 5 as the HTTP server
- Helmet, CORS, cookie-parser, JSON Web Token, and rate-limit middleware
- Swagger UI for API documentation
- PostgreSQL through `pg`
- Small repository modules around explicit SQL
- Morgan or structured request logging
- Axios or native fetch for external HTTP clients
- Socket.IO for realtime operational updates when polling is not enough
- Postgres-backed background jobs

Express is the better first backend choice for compatibility with Classifarr. It is already proven in the sibling project, keeps middleware and auth patterns familiar, and reduces the amount of stack-specific work needed when sharing operational ideas between the two applications.

The route layer should still stay thin. Express should own HTTP mechanics, not domain behavior. Harmoniarr's Soulseek discovery, candidate scoring, transfer reconciliation, and import validation should live in focused services that can be tested without Express.

The backend should own:

- API routing
- authentication/session handling
- static UI serving
- settings and configuration
- metadata provider clients
- slskd adapter
- discovery pipeline
- download reconciliation
- import validation
- migration status
- health/status endpoints

### API Style

The API should be REST-first with an OpenAPI document.

This fits the Servarr-style ecosystem better than GraphQL for v1:

- Easier to inspect manually.
- Easier to test with `curl`.
- Easier to document.
- Easier to generate typed clients.
- Easier for external tools to integrate with later.

Suggested route groups:

```text
/api/system
/api/settings
/api/metadata
/api/library
/api/wanted
/api/search
/api/candidates
/api/downloads
/api/imports
/api/users
/api/migrations
```

The app should publish `/api/openapi.json` and eventually a simple API docs view.

### Realtime And Polling

The app needs live-ish updates for searches, transfers, imports, and worker activity.

V1 can use ordinary polling for most views. This is simple and reliable.

For high-churn activity, use Socket.IO because that matches Classifarr's existing stack:

- Search job progress
- Candidate generation
- Transfer state changes
- Import validation progress
- System notices

Socket.IO should not become the primary data API. It should publish status changes and operational events while REST remains the source of truth.

### SWR Data Refresh Strategy

Harmoniarr should use a Classifarr-style Vue SWR composable for service-backed UI data.

Classifarr currently uses a custom `useSWR` composable rather than the React SWR package. The pattern is:

- Hydrate visible UI immediately from `localStorage` cache when the cached value is still inside its TTL.
- Mark cached data as stale while fetching fresh data in the background.
- Keep stale data visible during revalidation instead of clearing the screen.
- Retry transient network, `429`, and `5xx` failures with bounded backoff.
- Treat ordinary `4xx` failures as non-retryable.
- Pause interval polling when the browser tab is hidden.
- Revalidate when the browser comes back online.
- Sync cache updates across tabs with the `storage` event.
- Expose `data`, `isLoading`, `isStale`, `error`, `refresh`, `isOffline`, `retryCount`, and `cacheTimestamp`.

Harmoniarr should adapt that composable with a Harmoniarr cache prefix:

```text
harmoniarr:v1:swr:
```

The cache key format should be stable and explicit:

```text
domain:resource:identifier-or-filter-hash
```

Examples:

```text
dashboard:main
dashboard:activity-summary
system:health
library:artists:list
artist:detail:{artistId}
album:detail:{albumId}
missing:list:{filterHash}
activity:queue:{filterHash}
activity:downloads
activity:imports
activity:users
search:manual:{searchSessionId}
logs:unresolved
notifications:unread
```

Recommended TTL presets:

```text
SHORT = 30000      # 30 seconds, frequent activity and queues
MEDIUM = 60000     # 60 seconds, dashboard and summary data
LONG = 300000      # 5 minutes, user/account/settings data
VERY_LONG = 900000 # 15 minutes, static-ish metadata/config
```

Recommended polling intervals:

```text
FAST = 5000     # downloads, imports, queue counts, active jobs
NORMAL = 30000  # dashboard, missing summaries, notifications
SLOW = 60000    # settings, health summaries, background stats
```

Use SWR by default for:

- Dashboard artist list and summary panels.
- Missing page list and counts.
- Activity queue, candidates, downloads, imports, history, source users, blocklist, and failed jobs.
- Header health, unread notifications, and active task indicators.
- Settings health/status pages.
- Logs and unresolved error summaries.

Use Socket.IO to trigger SWR revalidation, not to replace REST state.

Examples:

- `download.progress` event -> refresh `activity:downloads`.
- `import.review.created` event -> refresh `activity:imports` and dashboard urgent reviews.
- `wanted.changed` event -> refresh `missing:list:*` and dashboard missing summary.
- `dependency.changed` event -> refresh `system:health`.

User actions should call `refresh` or mutate the relevant cache after success:

- Search/retry wanted item.
- Download candidate.
- Accept or reject import.
- Resolve error log.
- Trust, block, or annotate source user.
- Change monitoring or quality profile settings.

Optimistic cache mutation is acceptable for low-risk UI state, such as marking a notification read. For high-impact domain changes, prefer server response first, then revalidate.

The UI should expose freshness without being noisy:

- Show a subtle updating indicator while `isStale` is true.
- Show last updated time from `cacheTimestamp` on operational modules.
- Keep manual refresh controls where users expect them.
- Do not show full-page loading when stale data is available.

SWR cache must not store secrets. Authentication tokens, API keys, slskd credentials, and decrypted secrets must never be written to SWR localStorage.

### Background Jobs

The app should avoid adding Redis in the default deployment.

Because embedded Postgres is already part of the standard container, background jobs should start with a Postgres-backed queue. This keeps the deployment closer to the one-container Classifarr-style model and avoids another required service.

Jobs should cover:

- Metadata refresh
- Search dispatch
- Candidate building
- Folder browsing
- Transfer reconciliation
- Import validation
- AcoustID lookup
- Library scan
- Cleanup

The first implementation can use a small internal jobs table if needs are simple. If job behavior grows, consider a Postgres-backed queue library such as `pg-boss`.

Avoid Redis-backed queues like BullMQ for the default deployment unless we later decide an external Redis service is acceptable.

### Build And Package Model

The Docker build should follow the Classifarr multi-stage Alpine pattern:

1. Build the Vite client in a Node Alpine builder stage.
2. Install production server dependencies in a Node Alpine builder stage.
3. Copy server source, production `node_modules`, built client assets, database files, and the entrypoint into the final runtime image.
4. Install runtime Alpine packages, including embedded PostgreSQL 18 packages.
5. Start embedded Postgres, run migrations, then start the app.

Production runtime should not require the Vite dev server. Vite is a build-time and local development tool only.

### Package Manager

Use npm and the same root-orchestrated script style as Classifarr unless there is a strong reason to add another package manager.

This keeps setup simple for contributors and avoids requiring users to understand pnpm/yarn-specific behavior. The repo can still keep separate package files:

```text
package.json
client/package.json
server/package.json
```

Scripts should be root-level where practical:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run migration:create`
- `npm run migration:check`

### NPM Package Plan

The package set should stay practical and conservative. Add dependencies when they support a concrete boundary, not because they might be useful later.

Root workspace development packages:

```text
eslint
glob
markdownlint-cli2
```

The root package should stay mostly orchestration-focused, like Classifarr. Root scripts should call into `client`, `server`, and `scripts` rather than accumulating application runtime dependencies.

Client runtime packages:

```text
vue
vue-router
pinia
axios
@heroicons/vue
@vueuse/core
socket.io-client
clsx
date-fns
```

Client conditional packages:

```text
virtual-scroller or table virtualization package
form validation helper if settings forms become complex
```

Add table virtualization only when candidate, wanted, download, or import views become large enough to need it. Start with clear Vue components and extract shared table behavior after the first real screens prove the shape.

Client build packages:

```text
vite
@vitejs/plugin-vue
tailwindcss
@tailwindcss/postcss
postcss
```

Server runtime packages:

```text
express
helmet
cors
cookie-parser
express-rate-limit
jsonwebtoken
swagger-ui-express
pg
socket.io
node-cron
axios
dotenv
morgan
bottleneck
p-retry
js-yaml
```

Notes:

- `express` owns HTTP routing and static serving.
- `helmet`, `cors`, rate limiting, cookie parsing, and JWT handling should mirror Classifarr patterns where applicable.
- `swagger-ui-express` exposes API documentation.
- `pg` is the PostgreSQL driver.
- Small repository modules should keep SQL explicit instead of introducing a heavy ORM early.
- `socket.io` supports operational updates for transfers, imports, and worker state.
- `node-cron` is acceptable for simple scheduled maintenance, metadata refresh, and reconciliation jobs.
- `axios` keeps parity with Classifarr and is fine for slskd, MusicBrainz, AcoustID, and Classifarr calls.
- `bottleneck` and `p-retry` are useful for MusicBrainz, AcoustID, and slskd retry/rate-limit behavior.

Server conditional packages:

```text
pg-boss
music-metadata
file-type
fast-glob
sanitize-filename
proper-lockfile
bcrypt
```

Use `pg-boss` only if the internal jobs table becomes too limited. Start with our own simple job records if that keeps the first implementation clearer.

Use audio/file packages when the import validator needs them:

- `music-metadata` for tags and duration.
- `file-type` for sniffing file type when extensions are unreliable.
- `fast-glob` for library/import scans.
- `sanitize-filename` for safe rename/move operations.
- `proper-lockfile` if import operations need cross-process file locking.
- `bcrypt` if local user accounts/password auth are included instead of API-key-only access.

Testing packages:

```text
jest
supertest
pg-mem
testcontainers
@testcontainers/postgresql
vitest
@vitest/coverage-v8
jsdom
@testing-library/vue
@vue/test-utils
```

Testing roles:

- `jest`: server unit and integration tests, matching Classifarr.
- `supertest`: Express route tests.
- `pg-mem`: fast database-adjacent unit tests where a real Postgres instance is not required.
- `testcontainers` and `@testcontainers/postgresql`: database-backed integration tests.
- `vitest`: client unit/component tests.
- `@vitest/coverage-v8`: coverage reports and ratchet support.
- `jsdom`: Vue component tests.
- Vue Testing Library and Vue Test Utils: user-focused UI tests and lower-level component testing where needed.

Playwright can be added later for browser smoke and workflow tests once there is a stable UI to exercise.

Packages to avoid initially:

```text
redux
react
fastify
tanstack query
apollo/graphql
typeorm
prisma
bullmq
redis clients
next
nestjs
electron
```

Avoid these until there is a concrete need:

- React/Fastify are good tools, but they would diverge from Classifarr and reduce compatibility.
- GraphQL adds complexity before we need it.
- Heavy ORMs may fight the explicit SQL and migration model.
- BullMQ requires Redis, which conflicts with the simple embedded Postgres deployment.
- Next/Nest/Electron add framework surface area we do not need for a Docker-hosted operational app.

### Servarr-Inspired Behaviors To Keep

The app should borrow operational behaviors from Sonarr/Radarr, not necessarily their exact implementation stack.

Useful behaviors:

- Sidebar navigation for core areas.
- Activity queue visibility.
- Wanted/missing views.
- Manual search and manual import flows.
- Quality profile concepts.
- Root folder/path management.
- Health checks and system warnings.
- Task history.
- Logs visible from the UI.
- API key support for external integrations.
- Base URL support for reverse proxies.
- Docker update expectation: users update by pulling a new image, not by self-updating inside the container.

This lets the app feel familiar to self-hosted media users while still being Soulseek-native.

## Initial Scope

The first version should focus on manual-assisted acquisition.

Basic flow:

1. User adds an artist, album, or wanted item.
2. App fetches or stores metadata.
3. App searches Soulseek through `slskd`.
4. Results are normalized and grouped.
5. App scores likely candidates.
6. User reviews and selects a candidate.
7. App enqueues files through `slskd`.
8. App monitors transfer state.
9. Completed files enter an import review flow.
10. Accepted files are renamed, tagged, moved, and linked to the library.

## Soulseek-First Requirements

Because Soulseek data is inconsistent, the app must be tolerant of imperfect results.

The app should support:

- Folder-based album matching
- Loose track matching
- Partial album detection
- Missing track fill-in
- User trust/block rules
- Queue position awareness
- Retryable failure handling
- Duplicate result detection
- Completed transfer reconciliation
- Import confidence scoring

## Important Soulseek Operations

The app should support these operations through the Soulseek service layer:

- Validate connection to `slskd`
- Check Soulseek connection state
- Submit searches
- Poll or retrieve search results
- Browse a user's shared files
- Enqueue selected files
- Enqueue likely album folders
- Read active transfers
- Read completed transfers
- Cancel downloads
- Retry failed downloads
- Reconcile app state with backend state on startup

## Candidate Scoring

Search results should be converted into candidates and scored.

Possible scoring factors:

- Artist name match
- Album title match
- Release year match
- Track count match
- Folder coherence
- File extension
- Bitrate or lossless indication
- File size sanity
- Presence of cue/log/artwork files
- Username trust level
- Queue length
- Free slot availability
- Historical success/failure for the user
- Whether the result appears to be a full release or loose tracks

The UI should make the score explainable. Users should be able to see why a result is considered strong, weak, or risky.

## Soulseek Content Discovery Strategy

Soulseek discovery should use a staged process instead of a single exact search.

Soularr reference behavior:

- Reads wanted albums from Lidarr.
- Chooses a plausible release using release country, format, official status, and track count.
- Searches slskd using an album query, optionally prepending artist.
- Uses slskd search filters for search timeout, maximum peer queue, and minimum peer upload speed.
- Caches search results by album, user, allowed file type, and source folder.
- Groups promising files by Soulseek user and folder path.
- Browses user folders through slskd to get full folder contents.
- Counts audio files in the folder and compares against expected track count.
- Uses fuzzy filename matching between expected tracks and Soulseek filenames.
- Tries preferred file types in priority order.
- Supports multi-disc releases by trying a flat album match first, then split-disc matching.
- Filters non-audio extras unless whitelisted.
- Tracks ignored users, failed imports, stalled downloads, remote queue timeouts, and requeue attempts.

Our app should adopt the staged discovery shape, but improve it by ranking all viable candidates before downloading. Soularr is useful as a proof of workflow, but our app should not stop at the first match. The user should be able to compare candidates, see why they were scored, and override the decision.

Discovery stages:

1. Build a wanted item from metadata.
2. Generate multiple search queries.
3. Submit searches through slskd with rate limits.
4. Normalize search responses.
5. Group files into user/folder candidates.
6. Browse promising user folders for complete contents.
7. Normalize folder contents.
8. Match folder contents against expected release tracks.
9. Score and explain candidates.
10. Send high-confidence candidates to review or download.
11. Fall back to track-level search when album-level discovery fails.

Search query generation should include:

- Album title only.
- Artist plus album title.
- Artist plus album title plus release year.
- Album title plus release year.
- Normalized ASCII query.
- Punctuation-stripped query.
- Configurable blacklist/strip words.
- Alternate artist names when metadata provides them.
- Alternate release titles when metadata provides them.
- Track-specific queries for missing-track fill mode.

Album-title-only search should remain available because Soulseek folder names often omit the artist. Artist-prepended search should also be available because ambiguous album titles need stronger context.

Search responses should be normalized into a durable snapshot containing:

- Search job id
- Query text
- slskd search id
- Response timestamp
- Username
- Folder path
- Filename
- File extension
- Size
- Bitrate, sample rate, and bit depth when available
- Queue and peer information when available
- Raw slskd payload for compatibility debugging

Candidate grouping should primarily use:

- Username
- Folder path
- File type or quality bucket

This matches how Soulseek users usually organize albums and avoids treating every matching track as an unrelated result.

Candidate matching should evaluate:

- Expected track count vs audio file count
- Expected disc count vs folder layout
- Per-track fuzzy filename match
- Folder name match against artist, album, and year
- File extension and quality profile priority
- Presence of duplicate tracks
- Missing tracks
- Extra audio files
- Suspicious file sizes
- Non-audio extras
- User trust status
- Queue length and upload speed
- Prior success or failure for the user

The app should support both strict album matching and pragmatic review:

- Full album mode should require all expected tracks unless the user allows partial candidates.
- Missing-track fill mode may accept individual track candidates.
- Multi-disc mode should support both flat folders and split folders.
- Medium confidence candidates should be visible but require manual review.
- Low confidence candidates should be hidden by default but available through filters.

Operational rules:

- Cache search and browse results to avoid hammering Soulseek users.
- Rate-limit searches globally and per wanted item.
- Persist failed searches and failed imports.
- Persist ignored, blocked, and preferred users.
- Record every query attempt and candidate score so decisions are explainable later.
- Treat slskd API behavior as an adapter concern; store normalized snapshots for app logic.

The first implementation should prefer manual review after candidate discovery. Automation should only use this pipeline after confidence scoring has proven reliable.

## Practical Discovery Implementation

The practical implementation should treat Soulseek discovery as an asynchronous pipeline. The user asks the app to find an album or track, and the backend creates durable jobs that can be inspected, retried, and improved over time.

Core pipeline:

1. Create a `wanted_item`.
2. Create a `search_job`.
3. Generate `search_attempts` from the wanted item metadata.
4. Execute each attempt through the slskd adapter.
5. Store raw and normalized `search_result_files`.
6. Group files into `source_candidates`.
7. Browse promising user folders and store `candidate_files`.
8. Run candidate matching.
9. Run candidate scoring.
10. Present candidates in the UI for review.
11. Enqueue selected files through slskd.
12. Track transfers and reconcile completion.

Suggested tables:

- `wanted_items`
- `search_jobs`
- `search_attempts`
- `search_result_files`
- `source_candidates`
- `candidate_files`
- `candidate_match_runs`
- `candidate_score_runs`
- `candidate_score_factors`
- `download_jobs`
- `download_files`
- `transfer_events`
- `import_reviews`

The first version can keep the data model simpler, but these concepts should remain visible in the service boundaries.

### Search Job Flow

When the user requests discovery for an album:

1. Load artist, release group, release, and expected track metadata.
2. Normalize search terms.
3. Generate query variants.
4. De-duplicate query variants.
5. Execute queries with a rate limit.
6. Store every response before making matching decisions.

Example query set for an album:

```text
album
artist album
artist album year
album year
artist normalized_album
album_without_parenthetical
artist alternate_title
```

The query generator should be deterministic. Given the same wanted item and settings, it should produce the same ordered query list. This makes tests and debugging easier.

### slskd Adapter Contract

The app domain should call a narrow adapter instead of using slskd directly.

```text
searchText(query, options) -> SearchHandle
getSearchState(searchId) -> SearchState
getSearchResponses(searchId) -> SearchResponse[]
deleteSearch(searchId) -> void
browseUserDirectory(username, directory) -> DirectoryListing
enqueue(username, files) -> EnqueueResult
getDownloads(username?) -> TransferList
getDownload(username, id) -> TransferFile
cancelDownload(username, id) -> void
```

Adapter responsibilities:

- Authenticate with slskd.
- Translate slskd request/response shapes.
- Normalize path separators.
- Normalize transfer states.
- Preserve raw payloads for diagnostics.
- Convert slskd errors into app-level error codes.

The rest of the app should not care whether slskd returns a direct object, an array-wrapped directory response, or version-specific differences.

### Candidate Builder

Search results should be grouped into candidates before any detailed matching.

Candidate key:

```text
username + normalized_folder_path + quality_bucket
```

The candidate builder should:

- Extract folder path from each result filename.
- Normalize path separators.
- Normalize extension case.
- Bucket files by audio quality.
- Ignore obvious non-audio files for matching.
- Keep non-audio extras as supporting evidence.
- Merge duplicate files from repeated query attempts.
- Preserve which query found each file.

Candidate generation should not require a perfect match. It should create possible candidates cheaply, then let the matcher and scorer decide quality.

### Folder Browse Step

For promising candidates, browse the full user directory through slskd.

Browse should happen when:

- A candidate has enough matching search-result files to be plausible.
- A candidate folder name strongly matches the album.
- A candidate contains at least one expected track.
- A user is trusted or historically successful.

Browse should not happen for every weak search result. This avoids excessive Soulseek traffic.

Folder browse results should be cached by:

```text
username + folder_path + observed_at
```

The cache should have a TTL because Soulseek users can change shared files, go offline, or reorganize folders.

### Matching Algorithm

The matcher should compare expected release tracks to candidate audio files.

For each expected track:

1. Normalize expected title.
2. Normalize candidate filename.
3. Strip extension.
4. Strip common track number prefixes.
5. Strip disc prefixes.
6. Compare using a fuzzy string score.
7. Keep the best candidate file match.

The matcher should output structured evidence:

- Expected track id
- Expected title
- Matched filename
- Match score
- Match reason
- Whether the match is unique
- Whether multiple expected tracks matched the same file

Album-level match summary:

- Expected track count
- Matched track count
- Missing track count
- Extra audio count
- Duplicate match count
- Average track match score
- Minimum track match score
- Disc layout match
- File type consistency

### Scoring Algorithm

Scoring should be explainable and factor-based.

Initial score groups:

- Metadata match
- Track coverage
- Folder coherence
- Quality
- User reliability
- Transfer practicality
- Risk penalties

Example factor output:

```json
[
  { "factor": "track_coverage", "points": 30, "reason": "12/12 expected tracks matched" },
  { "factor": "avg_track_match", "points": 18, "reason": "average filename match 0.91" },
  { "factor": "quality", "points": 15, "reason": "FLAC matched preferred profile" },
  { "factor": "folder_name", "points": 8, "reason": "folder contains album title and year" },
  { "factor": "queue", "points": -5, "reason": "remote queue length above preferred threshold" }
]
```

Candidate confidence levels:

- `high`: likely correct, eligible for future automation.
- `medium`: plausible, user review required.
- `low`: weak, hidden by default.
- `rejected`: invalid for the current wanted item.

The first scoring implementation can be rule-based. We should not need AI or embeddings for v1.

### Manual Review UI

The review UI should show candidates as a ranked comparison table.

Important columns:

- Rank
- Confidence
- User
- Folder
- Format
- Track coverage
- Avg match
- Missing tracks
- Extra audio
- Queue/speed
- Trust status
- Score explanation

Candidate detail should show:

- Expected track list beside matched files.
- Missing tracks.
- Extra files.
- Non-audio extras.
- Raw folder path.
- Query attempts that found the candidate.
- Score factor breakdown.

Primary actions:

- Download candidate.
- Reject candidate.
- Prefer user.
- Block user.
- Mark as not this release.
- Search again with modified query.
- Switch to track fill mode.

### Download Selection

When a candidate is accepted, the app should enqueue only selected files.

Default selection:

- Matched audio files.
- Optional approved extras such as `.cue`, `.log`, `.m3u`, `.jpg`, `.png`, `.txt`, `.nfo`.

The app should avoid blindly downloading every file in the folder. That is one of the ways Soulseek automation becomes messy.

### First Milestone Slice

The practical first slice should be narrow:

1. Search one album manually.
2. Generate album and artist-album queries.
3. Store search attempts and normalized files.
4. Group by user and folder.
5. Browse top candidate folders.
6. Match by track count and fuzzy filenames.
7. Show ranked candidates in the UI.
8. Let the user enqueue one candidate.

This proves the core acquisition loop without needing full Lidarr parity, automation, or complex import behavior.

## Request Lifecycle And Timing

The app needs a clear answer for when work begins. A user action should create durable intent first, then the scheduler should decide what operational jobs are allowed to run. This keeps the system predictable and avoids turning every UI click into immediate Soulseek traffic.

Primary request flow:

1. User adds or monitors an artist.
2. App imports artist metadata.
3. App creates release groups, releases, tracks, and monitoring records.
4. Release detection compares provider metadata against known local state.
5. App derives wanted items from monitoring rules, detection decisions, and existing library state.
6. App creates discovery requests for wanted items that are eligible to search.
7. Scheduler turns eligible discovery requests into search jobs.
8. Search jobs create candidate records.
9. Candidate review or automation creates download jobs.
10. Transfer reconciliation creates import reviews.
11. Import approval creates library files and updates wanted state.

The important distinction is that adding an artist does not directly mean "search Soulseek now for everything." Adding an artist means "create and maintain wanted state." Search timing is controlled by eligibility rules, rate limits, user intent, and automation settings.

### User-Initiated Triggers

These should create work quickly because the user explicitly asked for it:

- Add artist and choose monitored releases.
- Add a specific album/release to wanted.
- Manual search for an album.
- Manual search for one missing track.
- Retry a failed wanted item.
- Search again with a modified query.
- Accept candidate and start download.
- Recheck completed download for import.

Manual search should bypass long scheduled delays, but it should still respect global Soulseek rate limits and slskd availability.

### Scheduled Triggers

Scheduled work should maintain the library without overwhelming Soulseek or the local system.

Suggested schedules:

- Dependency heartbeat: periodic and passive checks for external services, local tools, worker health, and path readiness.
- Metadata refresh: periodic artist and release metadata updates.
- Release detection: compare refreshed artist metadata against known local state and emit release detection events.
- Wanted reconciliation: periodic recalculation of missing, monitored, and upgradeable music.
- Quality upgrade detection: periodic comparison of library files against quality profiles and upgrade policy.
- Search queue dispatch: frequent but rate-limited search job creation.
- Candidate refresh: occasional re-search for wanted items with no good candidates.
- Transfer reconciliation: frequent polling of active slskd downloads.
- Import scan: frequent check for completed files ready to validate.
- Trust/statistics update: periodic aggregation of user outcomes, queue behavior, and speeds.
- Cleanup: remove stale slskd search handles, old raw payloads beyond retention, and expired browse cache entries.

Search cadence should be conservative by default. A practical starting point is immediate dispatch for manual actions, then scheduled automatic searches with per-wanted-item cooldowns.

### Event-Driven Triggers

Some work should happen as a direct consequence of state changes:

- Dependency degraded -> pause or back off affected schedulers.
- Dependency recovered -> re-evaluate blocked jobs.
- Artist metadata imported -> recalculate monitored releases.
- Artist metadata refreshed -> run release detection.
- New relevant release detected -> apply monitoring policy and reconcile wanted state.
- Future release date reached -> recalculate search eligibility.
- Wanted item created -> mark as search eligible if monitored and missing.
- Search job completed -> build candidates.
- Candidate built -> browse promising folders.
- Folder browse completed -> run matching and scoring.
- Candidate accepted -> create download job.
- Download job created -> enqueue selected files through slskd.
- Transfer state changed -> append transfer event.
- Transfer completed -> create import review.
- Import accepted -> move or link files into the library.
- Library file added or rescanned -> inspect quality and recalculate upgrade eligibility.
- Import completed -> mark wanted item satisfied or partially satisfied.
- Import rejected -> preserve reason and decide whether retry is allowed.

Event-driven work should append history records before mutating current-state projections. This gives us an audit trail for every meaningful transition.

### Wanted Item Eligibility

A wanted item should become eligible for discovery only when all required conditions are met:

- It is monitored.
- It is missing or below the desired quality profile.
- Metadata is complete enough to generate useful queries.
- It is not already satisfied by the library.
- It is not blocked by a user decision.
- It is not currently downloading.
- It is not inside a cooldown window.
- The app has not exceeded global, artist-level, or wanted-item search limits.
- slskd is reachable and authenticated.

Eligibility should be recalculated rather than guessed. The app can store a current `wanted_items.status`, but the scheduler should be able to explain why an item is or is not eligible at a given time.

### Suggested Wanted Statuses

Wanted item states should represent product intent, not low-level job execution.

- `unmonitored`: known to the app but not actively pursued.
- `wanted`: monitored and missing or upgradeable.
- `search_queued`: eligible and waiting for scheduler dispatch.
- `searching`: an active search job exists.
- `candidates_found`: one or more candidates are available.
- `needs_review`: no candidate is safe enough for automation.
- `downloading`: selected files are active in slskd.
- `import_pending`: files completed and need validation.
- `satisfied`: library state fulfills the wanted item.
- `blocked`: user or policy says not to pursue it.
- `failed`: latest attempt failed and needs retry or review.

Search jobs, candidate jobs, download jobs, and import reviews should have their own statuses. A wanted item should summarize the latest meaningful state without losing the detailed job history.

### Cooldowns And Backoff

Automatic searches need cooldowns to avoid repeatedly asking Soulseek the same question.

Suggested cooldown behavior:

- New manual request: run as soon as rate limits allow.
- New monitored album: search soon, but batch with nearby requests.
- No results: retry later with a longer cooldown.
- Weak candidates only: retry later, but keep candidates for review.
- Download failed: retry the same candidate only a limited number of times.
- User rejected candidates: do not immediately rediscover identical candidates.
- slskd unavailable: pause dispatch and retry health checks.
- User blocked or ignored a Soulseek user: remove or demote their candidates immediately.

Backoff should be stored as data, not hidden in process memory. If the container restarts, the app should remember what was waiting, what failed, and when the next attempt is allowed.

### Initial Timing Policy

For the first implementation, the timing model should be intentionally simple:

1. Manual album search creates a wanted item and dispatches a search job immediately.
2. Search jobs run one wanted item at a time.
3. Automatic searches are disabled or limited to explicitly monitored wanted items.
4. Candidate browse is capped to the top ranked search-result groups.
5. Downloads only start from user-selected candidates.
6. Transfer reconciliation polls slskd on a short interval.
7. Import always requires review until scoring and validation are proven reliable.

This gives us the right architecture for automation without forcing full automation into the first release.

## Matching Philosophy

The app should not depend on exact matching only.

Soulseek results are often messy:

- Folder names vary
- Tags may be absent or wrong
- Albums may be partial
- Tracks may be loose files
- Users may organize libraries differently
- Releases may not map cleanly to metadata providers

The app should use confidence levels:

- High confidence: eligible for future auto-import
- Medium confidence: requires review
- Low confidence: visible but not recommended
- Rejected: hidden unless filters are changed

## Import Philosophy

Importing should be conservative.

Completed downloads should not automatically enter the library unless confidence is high. Files should first be validated against the expected artist, album, and track list.

Import states:

- Pending
- Ready to import
- Needs review
- Imported
- Rejected
- Failed

## Planned Antivirus Scanning

Harmoniarr should plan for optional antivirus scanning of completed downloads before import.

This is a future security feature, not a v1 blocker. The first implementation should focus on safe staging, strict file-type handling, import validation, and not executing downloaded content. Antivirus scanning can then be added as a defense-in-depth layer.

The likely integration should use ClamAV rather than a custom antivirus engine.

Preferred model:

```text
slskd download completed
  -> keep file in staging
  -> scan with ClamAV
  -> clean: continue import validation
  -> infected or suspicious: quarantine and block import
  -> scan failed: hold for review based on policy
```

Recommended deployment shape:

- Optional separate ClamAV Docker service running `clamd`.
- `freshclam` updates signatures.
- Harmoniarr connects to `clamd` over TCP or a Unix socket.
- Harmoniarr records scan results per file.
- Scan results appear in import review.
- Infected or suspicious files are quarantined and cannot be imported unless an explicit future override policy exists.

Settings should eventually include:

- Enable or disable antivirus scanning.
- ClamAV host, port, or socket path.
- Whether to scan audio files.
- Whether to scan extra files such as images, logs, playlists, cue sheets, archives, and text files.
- Quarantine path and retention behavior.
- Import policy when the scanner is unavailable: fail closed, hold for review, or fail open.
- Signature age warning threshold.

Antivirus scanning should not be treated as proof that a file is safe. It can catch known malware, but it cannot guarantee safety. Harmoniarr should still:

- Avoid executing downloaded files.
- Avoid auto-extracting archives by default.
- Use an allowlist for importable file types.
- Keep downloads in staging until scan and import validation pass.
- Show scan failures clearly.

Planned records may include:

- `antivirus_scan_runs`
- `antivirus_scan_results`
- `antivirus_quarantine_items`
- `antivirus_signature_status`

The dependency heartbeat service should eventually track ClamAV availability and signature freshness when antivirus scanning is enabled.

## Security Benchmark Planning

The security benchmark planning document lives in `docs/SECURITY_BENCHMARKS.md`.

It is adapted from Classifarr's security benchmark structure, but it should be treated as a Harmoniarr planning baseline until implementation exists. As Dockerfiles, API routes, authentication, worker jobs, and CI gates are added, the benchmark document should be updated with concrete file references and verified status.

The benchmark should track:

- Container hardening.
- API authentication and authorization.
- REST security practices.
- Download and import safety.
- Path traversal prevention.
- Integration and provider safety.
- Secret handling.
- Worker and queue abuse resistance.
- Optional future antivirus scanning.
- Security CI gates.

## Media Management Settings

Media management should be one of the first settings areas because it controls how Harmoniarr turns accepted downloads into an organized library.

This section should cover file organization, naming conventions, import behavior, and safe rename previews. Audio transcoding should be designed separately, but the media management model should leave room for it.

### Bundled Media Tooling

The standard Harmoniarr image should include local media tooling needed for inspection and future conversion workflows.

`ffmpeg` is the correct baseline tool to include because it can inspect, decode, and convert audio formats locally without depending on an external service. It is also useful for technical validation, such as checking whether a downloaded file can be decoded.

`ffprobe` should also be available for metadata and stream inspection. The app should use structured probe output where possible instead of parsing human-readable command output.

For this design section, `ffmpeg` should be treated as the local media engine for inspection, validation, and transcoding. Harmoniarr should own the policy, job state, profiles, validation, and UI. `ffmpeg` should execute the actual media operation.

### Media Management Scope

The first media management settings should include:

- Root music folders.
- Artist folder naming.
- Album folder naming.
- Song file naming.
- Multi-disc naming behavior.
- Character replacement and filename sanitization.
- Import move, copy, or hardlink behavior.
- Whether to rename files during import.
- Whether to preserve extra files such as artwork, logs, cue sheets, playlists, and notes.
- Whether existing library files can be renamed in bulk.
- Preview and approval behavior for rename plans.
- File and folder permission behavior for imported media.

These settings should apply during import first. Existing-library cleanup should use the same naming rules, but it should be a separate user-initiated action with a preview.

### Naming Template Model

Naming should be template-based and previewable.

The app should provide defaults that work for most music libraries while allowing advanced users to customize them.

Default artist folder:

```text
{ArtistName}
```

Default album folder:

```text
{AlbumTitle} ({ReleaseYear})
```

Default song filename:

```text
{TrackNumber:00} - {SongTitle}
```

Default multi-disc song filename:

```text
{DiscNumber}-{TrackNumber:00} - {SongTitle}
```

Optional richer album folder:

```text
{AlbumTitle} ({ReleaseYear}) [{Quality}]
```

Potential template tokens:

- `{ArtistName}`
- `{AlbumArtistName}`
- `{AlbumTitle}`
- `{ReleaseTitle}`
- `{ReleaseYear}`
- `{ReleaseDate}`
- `{ReleaseCountry}`
- `{ReleaseFormat}`
- `{Edition}`
- `{DiscNumber}`
- `{DiscCount}`
- `{TrackNumber}`
- `{TrackNumber:00}`
- `{SongTitle}`
- `{Quality}`
- `{AudioCodec}`
- `{AudioChannels}`
- `{Bitrate}`
- `{SampleRate}`
- `{MusicBrainzArtistId}`
- `{MusicBrainzReleaseGroupId}`
- `{MusicBrainzReleaseId}`
- `{MusicBrainzRecordingId}`

The UI should show live examples for the selected artist, album, and song so the user can see exactly what a template will produce.

### Filename Safety

Naming rules must be safe across common mounted filesystems.

The app should handle:

- Invalid filename characters.
- Reserved Windows names.
- Leading and trailing dots or spaces.
- Repeated whitespace.
- Path length limits.
- Case-only renames.
- Duplicate destination paths.
- Unicode normalization differences.
- Slash-like punctuation in artist, album, and song names.

Character replacement should be configurable, but the default should be conservative and readable. For example, path separators in titles should become hyphens instead of creating accidental subfolders.

The app should never silently overwrite an existing library file. Collisions should create an import review problem that the user can resolve.

### Import Organization

Accepted imports should be organized through a planned operation.

The import planner should calculate:

- Source file path.
- Destination artist folder.
- Destination album folder.
- Destination filename.
- Final destination path.
- Import operation type: move, copy, or hardlink.
- Extra files to include or ignore.
- Conflicts, warnings, and required user decisions.

The user should be able to preview the import plan before applying it, especially while automatic import is disabled.

Recommended v1 posture:

- Rename and move accepted files into the library.
- Do not modify existing library files without explicit user action.
- Do not overwrite files.
- Do not transcode during import yet.
- Preserve downloaded files only when the configured import mode calls for copy or hardlink.
- Keep import history so every file move or rename can be explained later.

### Existing Library Rename And Cleanup

The library scanner may discover files that are already present but do not match the configured naming convention.

These should not be renamed automatically during scan. Instead, Harmoniarr should offer a separate rename preview:

```text
Scan existing library
  -> identify files outside naming convention
  -> build rename plan
  -> show before/after paths
  -> require user approval
  -> apply safe operations
  -> record history
```

Bulk rename should support filtering by artist, album, status, and confidence. Ambiguous or unmatched files should be excluded from automatic rename plans until the user resolves them.

### Extra Files

Soulseek album folders often contain useful non-audio files.

Media management should define which extra files are imported with an album:

- Cover images: `.jpg`, `.jpeg`, `.png`, `.webp`
- Cue sheets: `.cue`
- Logs: `.log`
- Playlists: `.m3u`, `.m3u8`
- Notes: `.txt`, `.nfo`
- Spectrograms or checksums later if useful

The app should avoid importing unrelated junk by default. Extra files should be included only when they are in the selected candidate folder and pass configured extension rules.

### File Permissions

Media management should include file and folder permission settings for imported files.

The Docker image should support `PUID`, `PGID`, and `UMASK` style configuration where practical, but the application should also expose clear media permission settings so users can understand what will happen during import.

Recommended defaults:

```text
Folder mode: 755
File mode: 644
```

This means imported folders are readable and traversable by other users, while imported files are readable but only writable by the owner. Users with shared-library setups can relax or tighten this based on their environment.

Settings should include:

- Folder permission mode.
- File permission mode.
- Whether to apply permissions to imported files.
- Whether to apply permissions to imported extra files.
- Whether to apply permissions to newly created artist and album folders.
- Whether existing library files can be permission-fixed in bulk.
- Optional owner and group behavior when the container has permission to apply it.

Permission handling should be conservative:

- Apply configured permissions to newly imported files and newly created folders.
- Do not recursively change existing library permissions during scan.
- Offer a separate previewed permission-fix action for existing library files.
- Report permission failures clearly instead of hiding them.
- Validate that target paths are writable before import starts.

The app should show effective permission behavior in the UI, including how `UMASK` affects the configured mode if the runtime environment applies one.

### Settings Page Placement

The `Settings` area should include a `Media Management` section with tabs or subsections for:

- Root folders.
- Naming.
- Import behavior.
- Permissions.
- Extra files.
- Existing library cleanup.
- Future transcoding settings.

The naming screen should be practical: template inputs, token insertion, live previews, and validation warnings. It should not require the user to import files before seeing whether a naming rule works.

## Transcoding Settings

Transcoding should be a first-class settings area, but it should be conservative by default.

The first supported direction should be:

```text
Lossless source
  -> lossy derivative
```

This supports common library needs such as keeping a lossless archive while creating MP3, AAC, Opus, or Ogg Vorbis copies for compatibility, mobile storage, or remote playback.

Transcoding should not be required for normal import. A downloaded FLAC album should be importable as FLAC. Transcoding should run only when a profile, manual action, or later automation rule asks for it.

### Transcoding Engine

FFmpeg should be the default and bundled transcoding engine.

Reasons:

- It can read and write a broad set of audio containers and codecs.
- It can inspect media through `ffprobe`.
- It supports bitrate, quality, sample rate, channel, filter, metadata, and artwork operations.
- It is available in Alpine packages and works well inside Docker.
- It avoids requiring a separate external transcoding service.

Codec-specific tools may still be useful as implementation details later, but they should not be the primary user-facing integration. The app should expose stable transcoding profiles and generate the correct local command behind the scenes.

Important licensing note: the standard image should avoid nonfree encoder builds. If optional codecs require special licensing or nonfree FFmpeg builds, those should be opt-in and clearly documented rather than silently included.

### Transcoding Profiles

Transcoding settings should be profile-based.

A profile should define:

- Profile name.
- Source eligibility.
- Target format.
- Target codec.
- Container extension.
- Bitrate or quality mode.
- Sample rate behavior.
- Channel behavior.
- Bit depth or sample format behavior where applicable.
- Metadata and artwork behavior.
- Output location.
- Replacement behavior.
- Validation behavior.

Default presets should include:

```text
MP3 320
  Target format: mp3
  Codec: libmp3lame
  Mode: CBR
  Bitrate: 320 kbps
  Sample rate: preserve or 44.1 kHz
  Channels: preserve stereo/downmix multichannel to stereo

MP3 V0
  Target format: mp3
  Codec: libmp3lame
  Mode: VBR
  Quality: V0

Opus 160
  Target format: opus
  Codec: libopus
  Mode: VBR
  Bitrate: 160 kbps

AAC 256
  Target format: m4a
  Codec: aac
  Mode: CBR or constrained VBR if supported
  Bitrate: 256 kbps

Ogg Vorbis Q6
  Target format: ogg
  Codec: libvorbis
  Mode: VBR
  Quality: q6
```

The app should ship with these presets as starting points and allow custom profiles later. Presets should be editable or duplicable rather than hard-coded as the only allowed profiles.

### Source Eligibility

The first version should only transcode from lossless sources by default.

Lossless source formats may include:

- FLAC
- ALAC
- WAV
- AIFF
- WavPack

The app should avoid lossy-to-lossy transcoding by default because it compounds quality loss. Users can enable it manually, but it should require a clear warning and explicit confirmation.

The app should also warn on lossy-to-lossless transcoding. This is technically possible but practically misleading because it cannot restore information already lost in the original lossy file. A lossy-to-lossless output may be larger, but it is not a quality upgrade.

Eligibility rules should include:

- Source codec is lossless.
- Source file validates successfully.
- Source file is already imported or approved for import.
- Target file does not already exist unless replacement is explicitly allowed.
- Target profile is enabled.
- The file is not currently being written, imported, or scanned.
- Lossy-to-lossy and lossy-to-lossless operations require explicit user approval if enabled.

### Bitrate, Quality, And Bit Depth

The settings UI should distinguish audio concepts clearly.

For lossy outputs, the main controls are:

- Codec.
- Container.
- Bitrate.
- Constant bitrate, variable bitrate, or quality mode.
- Sample rate.
- Channel count or layout.

Bit depth is not usually a meaningful user-facing target for MP3, AAC, Opus, or Vorbis in the same way it is for PCM or lossless audio. The app can expose sample format only in advanced settings if needed.

Avoid using video-style labels such as `10-bit` for audio transcoding. For audio, the relevant terms are usually:

- 16-bit PCM
- 24-bit PCM
- 32-bit float
- Sample format, such as `s16`, `s32`, or `fltp`
- Sample rate, such as 44.1 kHz, 48 kHz, 96 kHz, or preserve source

For v1, bit depth/sample format should be advanced and usually set to `auto` or `preserve when applicable`.

### Output Behavior

The user should choose what transcoded files are for.

Output modes:

- Replace import output with the transcoded file.
- Keep original and create a lossy derivative beside it.
- Write derivatives to a separate root folder.
- Write derivatives to a device/sync-oriented folder later.

Recommended v1 posture:

- Keep the original lossless file.
- Create lossy derivatives only when explicitly requested.
- Do not delete or replace source files automatically.
- Do not transcode directly over an existing file.
- Write to a temporary path first, then atomically move into place when validation succeeds.

Naming for derivatives should reuse media management templates, with optional tokens such as `{TranscodeProfile}` or `{Quality}`.

### Metadata, Artwork, And ReplayGain

Transcoding should preserve useful metadata where possible.

Settings should include:

- Copy tags from source.
- Normalize or rewrite tags from Harmoniarr metadata.
- Embed cover art when supported by the target container.
- Preserve MusicBrainz identifiers.
- Preserve ReplayGain tags if present.
- Calculate ReplayGain or loudness tags later as a separate option.

The app should not apply loudness normalization to audio samples by default. If loudness normalization is added later, it should be explicit because it changes the audio data.

### Job Control And Safety

Transcoding can be CPU-heavy, so it should be a queued background workflow.

Settings should include:

- Enable or disable transcoding globally.
- Maximum concurrent transcodes.
- CPU priority or nice level where supported.
- Temporary transcode directory.
- Retry behavior.
- Failure retention.
- Whether transcoding can run during import.
- Whether transcoding can run as a later library maintenance job.

Each transcode job should record:

- Source file id.
- Source path.
- Target path.
- Profile id.
- FFmpeg version.
- Generated command or normalized command plan.
- Start and finish timestamps.
- Exit code.
- stderr summary.
- Output validation result.
- Resulting codec, bitrate, sample rate, channels, duration, and file size.

The UI should show progress, current file, profile, output target, and failure reason.

### Validation

A transcode should only be considered successful after validation.

Validation should check:

- Output file exists.
- Output file is non-empty.
- `ffprobe` can read it.
- Duration is close to source duration.
- Expected audio stream exists.
- Codec and container match the selected profile.
- File size is plausible.
- Tags and artwork were handled as expected where configured.

If validation fails, the source file should remain untouched and the failed output should be quarantined or removed according to settings.

### Settings Page Placement

The `Settings` area should include a `Transcoding` section with:

- Enable/disable.
- Profiles.
- Source eligibility.
- Output behavior.
- Metadata and artwork.
- Job limits.
- Validation behavior.
- Advanced FFmpeg options.

Advanced FFmpeg options should be treated carefully. The app may allow expert users to add extra arguments, but built-in profiles should generate commands from structured settings so the behavior remains explainable and testable.

## AcoustID Role

AcoustID should fit after download and before final import.

It is not a good primary discovery source because the user usually starts with intent such as artist, album, release, or song title. AcoustID needs an audio file fingerprint, so it becomes useful only after the app has local files to inspect.

Primary role:

```text
Downloaded audio file
  -> generate Chromaprint fingerprint
  -> submit lookup to AcoustID
  -> receive possible MusicBrainz recording IDs
  -> compare to expected release tracks
  -> raise or lower import confidence
```

### Where It Runs

AcoustID should run during import validation:

1. slskd reports a selected file as completed.
2. Transfer reconciliation marks the file complete.
3. Import review job reads local file metadata.
4. App runs technical validation such as extension, size, duration, and decode ability.
5. App optionally generates an acoustic fingerprint.
6. App queries AcoustID for matching recordings.
7. App compares returned MusicBrainz recording IDs to the expected track recordings.
8. Import confidence is updated.
9. User sees fingerprint evidence in the import review screen.

Fingerprinting should be per file, not per album folder. Album-level confidence can then be calculated from the file-level results.

### What AcoustID Can Prove

AcoustID can help answer:

- Does this audio file appear to be the recording we expected?
- Does this file map to a different MusicBrainz recording?
- Are two differently named files actually the same recording?
- Is a track filename misleading?
- Did the user download the right album folder but with one wrong track?
- Does an existing library file already match the downloaded recording?

This is valuable because Soulseek filenames and tags can be wrong even when the audio is correct.

### What AcoustID Cannot Prove

AcoustID should not be treated as absolute truth.

Limitations:

- It identifies recordings, not necessarily exact releases.
- The same recording can appear on many releases.
- Remasters, edits, live versions, regional variants, and alternate mixes can complicate matching.
- Some files may not have known fingerprints.
- Bad, short, corrupted, or unusual files may fail fingerprinting.
- A returned MusicBrainz recording can still be ambiguous for release-level import.

Because of this, AcoustID should contribute evidence rather than replace release/track matching.

### Import Confidence Impact

AcoustID should be a score factor in import validation.

Positive signals:

- Fingerprint returns the expected MusicBrainz recording MBID.
- Fingerprint returns a recording also present on the selected release group.
- Multiple tracks in the same album candidate fingerprint correctly.
- Fingerprint confirms a file whose filename was only a medium-confidence match.

Negative signals:

- Fingerprint returns a different artist.
- Fingerprint returns a different recording not linked to the expected release group.
- Multiple expected tracks fingerprint as the same recording.
- File duration and fingerprint result conflict with expected metadata.

Neutral signals:

- No AcoustID result.
- Fingerprint generation failed for a technical reason.
- Result is too ambiguous to use.

AcoustID should not automatically reject files by itself in v1. It should push files toward `Ready to import`, `Needs review`, or `Rejected` only in combination with filename, tag, duration, release, and user decision evidence.

### UI Placement

AcoustID evidence should appear in `Imports`, not in the first candidate review table.

Import review should show:

- Expected track
- Downloaded filename
- Embedded tags
- Duration
- Candidate match score
- AcoustID status
- Returned MusicBrainz recording IDs
- Whether the result matches the expected recording
- Confidence effect

The user should be able to expand a track and see why the app thinks the file is correct or suspicious.

### Data Model Additions

Recommended records:

- `audio_fingerprints`
- `acoustid_lookup_runs`
- `acoustid_lookup_results`
- `import_validation_runs`
- `import_validation_factors`

Suggested `audio_fingerprints` fields:

- File id
- Fingerprint algorithm
- Fingerprint version
- Duration seconds
- Fingerprint hash or stored fingerprint reference
- Generated timestamp
- Error message

Suggested `acoustid_lookup_results` fields:

- Lookup run id
- AcoustID id
- Score
- MusicBrainz recording MBID
- MusicBrainz release group MBID
- Raw payload
- Matched expected track id
- Match status

The app should cache fingerprints and lookup results. If the same file is revalidated, it should not regenerate or re-query unless the file changed or the user forces a refresh.

### Dependency Notes

AcoustID requires local fingerprint generation through Chromaprint tooling or a compatible library.

Container implications:

- The Alpine image should include a way to generate Chromaprint fingerprints.
- The import worker needs access to completed downloaded files.
- Fingerprinting should be queued so large imports do not block the API.
- Failed fingerprint jobs should be retryable but not fatal to import review.

For v1, AcoustID can be optional but the data model should leave room for it. A practical first implementation can validate by filename, tags, duration, and track count first, then add fingerprinting as an import-confidence upgrade.

## Quality Upgrade Detection

Harmoniarr should include a service that detects when existing library items are below the user's preferred quality and creates upgrade intent when policy allows it.

This is separate from missing-music detection. A track or album can be present but still upgradeable.

Example upgrade goals:

- Replace low-bitrate MP3 with higher-bitrate MP3.
- Replace lossy files with lossless files.
- Prefer direct CD rips where possible.
- Prefer complete album folders over scattered track files.
- Prefer candidates with cue/log/artwork evidence.
- Prefer trusted users with a history of clean imports.

The service should not blindly assume every FLAC is better than every MP3. It should score upgrade candidates using technical evidence, metadata evidence, source-user history, and import validation.

### Quality Profile Model

Quality profiles should define what counts as acceptable, preferred, and upgradeable.

Profile dimensions may include:

- Whether upgrades are enabled globally.
- Whether upgrades are enabled per artist, album, or song.
- Allowed codecs.
- Preferred codecs.
- Minimum bitrate for lossy formats.
- Upgrade floor: the lowest current quality that should be considered eligible for upgrade.
- Upgrade ceiling: the target quality where Harmoniarr should stop searching for a better copy.
- Whether lossless is preferred over lossy.
- Whether CD-quality lossless is preferred.
- Whether high-resolution audio is allowed, preferred, or ignored.
- Whether lossy-sourced lossless files should be rejected or sent to review.
- Whether cue sheets, rip logs, and artwork increase confidence.
- Whether upgrades are allowed automatically or only manually.

Suggested initial quality ladder:

```text
Rejected
  -> Low-quality lossy
  -> Acceptable lossy
  -> Preferred lossy
  -> Lossless
  -> Verified or high-confidence CD rip
```

This ladder should be configurable. Some users may prefer compact lossy libraries, while others may want lossless-first acquisition.

The upgrade floor and ceiling should be explicit settings:

```text
Upgrade floor: anything below Acceptable lossy
Upgrade ceiling: Lossless
```

With those settings, Harmoniarr would try to upgrade low-quality lossy files until it finds a lossless copy, then stop treating the item as upgradeable. A different user might set the floor to `Any lossy` and the ceiling to `Verified or high-confidence CD rip`, or disable upgrades entirely.

The ceiling should prevent endless upgrade churn. Once an album or song satisfies the selected ceiling, it should not keep searching for marginally better copies unless the user changes the profile, manually requests a search, or a stronger direct-CD-rip policy is enabled.

Quality profile settings should be available in `Settings` and overridable at narrower scopes:

- Global default profile.
- Root-folder profile.
- Artist override.
- Album override.
- Song override when needed.

Narrower overrides should be visible in the UI so the user can tell why one artist or album is being upgraded differently from the global default.

### Upgrade Detector

The quality upgrade detector should compare current library state against the selected quality profile.

It should answer:

- Is this album or song present?
- Does the existing file satisfy the selected quality profile?
- Is the existing file below the preferred cutoff?
- Is the existing file below the configured upgrade ceiling?
- Is the existing file at or above the configured upgrade floor?
- Is the item eligible for upgrade search?
- Is there already a better candidate, active download, or import review?
- Has the user blocked upgrades for this artist, album, song, format, or source?
- Would replacing or adding the better file create duplicates or path conflicts?

The detector should emit explainable upgrade decisions, not only mutate wanted state.

Example decision:

```text
Existing file: MP3 192 kbps
Profile target: lossless preferred
Library state: present but below preferred quality
Decision: mark song upgradeable and create wanted upgrade intent
```

### Direct CD Rip Confidence

"Direct CD rip" should be treated as a confidence claim, not a binary fact unless strong evidence exists.

Strong positive signals:

- Lossless codec such as FLAC, ALAC, WAV, AIFF, or WavPack.
- CD-compatible audio properties, usually 16-bit / 44.1 kHz stereo.
- Complete album folder matching the expected tracklist.
- Cue sheet matching the album structure.
- EAC, XLD, CUETools, or similar rip log.
- AccurateRip or CUETools verification in the log.
- Consistent track durations with the selected release.
- No suspiciously small file sizes.
- Source user has prior successful lossless imports.

Weak or ambiguous signals:

- Filename says `CD`, `FLAC`, `EAC`, `log`, or `100%`.
- Folder contains artwork only.
- Tags claim lossless but no technical or rip-log evidence exists.
- High sample rate or bit depth without release context.

Negative signals:

- Lossless container with spectral evidence suggesting lossy source.
- Missing or inconsistent tracks.
- Durations differ significantly from expected tracks.
- Rip log does not match files in the folder.
- Cue sheet references missing files.
- File cannot be decoded cleanly.
- Known bad or blocked source user.

The app should call this something like `rip confidence` or `source quality confidence`, not a guaranteed CD-rip flag unless the evidence supports that.

### Fingerprinting Role

Music fingerprinting belongs in this workflow, but it solves identity more than quality.

Fingerprinting can help answer:

- Is this upgraded file the same recording as the existing file?
- Does the candidate match the expected MusicBrainz recording?
- Did the candidate folder contain a wrong track despite good-looking filenames?
- Would importing this upgrade replace the right song?

Fingerprinting generally cannot prove:

- That a file came directly from a CD.
- That a FLAC was not transcoded from MP3.
- That a rip is bit-perfect.
- That a specific physical edition was used.

For direct CD-rip confidence, rip logs, cue sheets, technical audio inspection, AccurateRip/CUETools evidence, and decode validation are more relevant than AcoustID alone. AcoustID should still be valuable because it prevents the app from upgrading to the wrong recording.

### Lossy-Source Detection

Harmoniarr may eventually add lossy-source detection for files stored in lossless containers.

Possible signals:

- Spectral cutoff patterns.
- Codec/container mismatch.
- Implausible bitrate or file size.
- Known encoder tags.
- Inconsistent sample rate or bit depth claims.

This should be treated as heuristic evidence. Spectral analysis can identify obvious suspicious files, but it should not be the only reason to reject a candidate in v1.

### Upgrade Flow

Suggested flow:

```text
Library scan or import completed
  -> inspect technical audio properties
  -> compare current files to quality profile
  -> mark albums or songs as satisfied, acceptable, or upgradeable
  -> create wanted upgrade intent when policy allows
  -> search for better candidates through normal discovery
  -> score candidates with quality and rip-confidence factors
  -> download selected upgrade candidate
  -> validate identity and quality during import review
  -> replace, keep beside, or reject according to media management policy
```

Upgrade searches should use the same Soulseek discovery pipeline as missing music, but with different scoring priorities. A lossless candidate with weak identity evidence should not outrank a slightly lower-quality candidate that clearly matches the target release.

### Upgrade Import Policy

Upgrades need careful import behavior because a library file already exists.

Initial posture:

- Do not delete or replace existing files automatically.
- Show a before/after comparison during import review.
- Let the user choose replace, keep both, reject, or defer.
- Preserve the old file until the new file validates and the import operation succeeds.
- Record upgrade history so the user can see what changed and why.

For v1, upgrade automation should be review-first. Later automation can allow trusted high-confidence upgrades according to quality profile settings.

### Suggested Records

Quality upgrade detection may need records such as:

- `quality_profiles`
- `library_quality_snapshots`
- `quality_upgrade_runs`
- `quality_upgrade_decisions`
- `rip_confidence_factors`
- `upgrade_wanted_items`
- `upgrade_import_reviews`

These should preserve the evidence used at the time of the decision, because quality classifications may change as the app gains better inspection tools.

## Library Model

Initial core entities:

- Artist
- Release Group
- Release
- Track
- Wanted Item
- Search Job
- Search Result
- Candidate
- Download
- Transfer
- Import Decision
- Library File
- Soulseek User Profile

## Data Storage Direction

Postgres is the default database. SQLite is not planned as the initial persistence layer.

The target Postgres major version is PostgreSQL 18.

As of April 26, 2026:

- PostgreSQL 18 is the current major version.
- PostgreSQL 18.3 is the current visible minor release from the PostgreSQL project release banner and release notes.
- Alpine v3.23 packages PostgreSQL 18 in `main` as `postgresql18`.
- Alpine v3.23 packages `postgresql18-contrib`.
- Alpine v3.23 packages `postgresql-pgvector` 0.8.1 in `community`, built against `postgresql18`.

This makes PostgreSQL 18 viable for the standard Alpine-based image.

The application should use a bundled Postgres deployment pattern inspired by Classifarr: the standard self-hosted deployment should include Postgres inside the application image/container instead of requiring users to provision an external database first.

Classifarr reference pattern:

- The application image installs Postgres runtime packages.
- The entrypoint initializes a Postgres data directory under the mounted app data volume.
- Postgres listens locally inside the container.
- The app starts only after the embedded Postgres process is ready.
- Fresh installs can load a schema snapshot before normal migration checks.
- Existing installs reuse the persisted Postgres data directory.
- Startup guards should detect incompatible Postgres data-directory versions and refuse to start rather than risk corruption.

Local Classifarr probe observations:

- The running `classifarr` container uses image `ghcr.io/cloudbyday90/classifarr:latest`.
- The public HTTP port is `21324`.
- Docker publishes only `21324/tcp`; PostgreSQL `5432` is not exposed to the host.
- `/health` returns a simple readiness payload with `status`, `database`, and `timestamp`.
- The mounted app data volume maps to `/app/data`.
- The embedded Postgres data directory is `/app/data/postgres`.
- Inside the container, Postgres listens on loopback, `127.0.0.1:5432` and `::1:5432`, plus the local socket directory.
- `/app/data/postgres` is owned by `classifarr:classifarr` with `0700` permissions inside the container.
- `/run/postgresql` and `/var/run/postgresql` are owned by `classifarr:classifarr` with `0770` permissions inside the container.
- The app process runs as UID/GID `1000:1000` in the current local container.
- Postgres reports ready before the app finishes startup.
- Startup logs report the migration result, for example `142 total, 0 newly applied`.
- The live `schema_migrations` table contains timestamped migration filenames such as `20260425_121000_fix_image_embedding_defaults.sql`.
- Authenticated operational endpoints, such as `/api/migration/status`, return `401` without credentials.

Initial schema planning lives in [DATABASE_MODEL.md](DATABASE_MODEL.md). That document should be treated as the working Postgres baseline while the product model is still being refined.

The schema should use local surrogate UUID primary keys for entity, workflow, and event tables. Provider identifiers and natural identifiers, such as MusicBrainz IDs, Soulseek usernames, `slskd` IDs, file paths, and metadata source keys, should be stored as ordinary columns with unique indexes where needed. Foreign keys should reference the local surrogate `id` columns so provider changes, redirects, and correlation overrides do not destabilize internal relationships.

The storage design should be time-based wherever the domain benefits from history, reconciliation, and auditability. This matters because Soulseek state changes over time and the app needs to explain how it reached a decision.

Time-based records should be preferred for:

- Search jobs and result snapshots
- Candidate score runs
- Transfer state transitions
- Import decisions
- User trust changes
- Automation decisions
- Retry attempts
- Library scans
- Metadata refreshes
- Migration runs

Mutable tables are still appropriate for current-state projections, but the system should preserve enough historical state to answer:

- What did we search?
- What did Soulseek return at that time?
- Why did this candidate score well or poorly?
- What did the user choose?
- What changed during transfer reconciliation?
- Why was an import accepted, rejected, or sent to review?

## PostgreSQL 18 And Alpine Support

PostgreSQL 18 should be the initial database target, but the implementation must account for packaging and upgrade behavior.

### Alpine Package Plan

The Alpine runtime image should install explicit PostgreSQL 18 packages instead of relying on unversioned package names.

Expected packages:

```text
postgresql18
postgresql18-client
postgresql18-contrib
tzdata
```

Optional packages:

```text
postgresql-pgvector
```

The Dockerfile should pin the Alpine branch, for example `alpine:3.23`, and install from stable repositories rather than `edge` unless there is a specific reason. Using `edge` would make the image less predictable.

If we need development headers or extension builds later, those should be builder-stage dependencies only:

```text
postgresql18-dev
build-base
```

Runtime should stay smaller and avoid carrying compiler toolchains.

### Data Directory Layout

Because this app embeds Postgres inside the application container, it should not blindly copy the official `postgres:18` Docker image layout.

The app should own its embedded Postgres layout under the mounted app data volume:

```text
/app/data/postgres/18
```

or:

```text
/app/data/postgres/18/data
```

The exact path can be finalized during implementation, but it should be version-aware from the beginning.

This avoids ambiguity when future major versions are introduced and makes startup checks easier:

- Detect the existing data directory.
- Read the existing cluster major version.
- Compare it to the packaged server major version.
- Start only when compatible.
- Refuse to start with a clear error when a major-version upgrade is required.

The official PostgreSQL Docker image changed `PGDATA` behavior in PostgreSQL 18 and now uses a version-specific path such as `/var/lib/postgresql/18/docker`, with volumes mounted at `/var/lib/postgresql`. We are not using the official Postgres image directly, but the same lesson applies: mount the parent data area and make the cluster directory version-aware.

### Upgrade Policy

PostgreSQL major upgrades should be explicit.

Rules:

- Minor PostgreSQL package updates within major version 18 are allowed through image updates.
- Major upgrades, such as 18 to 19, require an app-defined upgrade path.
- The app should never auto-run a major PostgreSQL upgrade silently.
- Startup should fail safely if the on-disk cluster major version does not match the bundled server major version.
- The UI and logs should tell the user what version exists on disk and what version the image contains.

Future major upgrade options:

- Dump and restore.
- `pg_upgrade` with both old and new binaries available in a migration image.
- A documented one-shot upgrade command or helper container.

For v1, the requirement is detection and safe refusal, not automated major upgrades.

### PostgreSQL 18 Compatibility Notes

PostgreSQL 18 has useful features for this app:

- `uuidv7()` for time-ordered UUIDs.
- Improved major upgrade behavior through retained optimizer statistics.
- Better index usage through skip scans.
- Asynchronous I/O improvements.
- Temporal constraints that may be useful later for time-bound uniqueness.

Potential concerns:

- PostgreSQL 18 enables data checksums by default during `initdb`.
- `pg_upgrade` requires compatible checksum settings between old and new clusters.
- MD5 password authentication is deprecated; use SCRAM authentication.
- Some full-text search and `pg_trgm` behavior can be affected by collation provider changes during upgrades.
- Newer PostgreSQL extensions may lag behind a major release on some distributions.

For this app, the practical response is:

- Use SCRAM.
- Keep local socket access internal to the container.
- Enable clear startup logs showing checksum and cluster version.
- Avoid relying on non-core extensions unless they are packaged and tested for PostgreSQL 18 on Alpine.
- Treat `pgvector` as optional until a feature actually needs it.

### Alpine-Specific Risks

Alpine is viable, but it has predictable tradeoffs:

- Alpine uses musl libc, which can expose compatibility issues in native Node modules.
- Some npm packages may not provide prebuilt musl binaries and may compile from source.
- Audio tooling for Chromaprint/AcoustID must be verified on Alpine.
- PostgreSQL extension availability depends on Alpine package maintainers.
- Package names and extension versions may differ from Debian-based examples.

Mitigations:

- Build and test on the same Alpine version used for runtime.
- Keep native dependencies explicit.
- Run CI Docker builds for the production image.
- Verify `postgresql18`, `postgresql18-contrib`, and Chromaprint tooling during image build.
- Verify `postgresql-pgvector` only if a vector-search feature is enabled.
- Prefer stable Alpine branches, not `edge`.
- Keep a startup diagnostics endpoint that reports PostgreSQL server version, data directory version, extension availability, and migration status.

## Database Extension And Graph Strategy

The app should start with plain PostgreSQL 18 plus core/contrib extensions, not a required vector database or graph database.

Recommended v1 database capabilities:

- Relational tables for canonical entities and workflows.
- Many-to-many tables for music relationships.
- JSONB for raw provider payloads and Soulseek observations.
- B-tree indexes for identifiers, statuses, timestamps, and foreign keys.
- GIN indexes for JSONB fields only where queries prove they need them.
- `pg_trgm` from `postgresql18-contrib` for fuzzy text matching if needed.
- Full-text search for internal filtering and library search if needed.

### pgvector Decision

Do not require `pgvector` in v1.

`pgvector` is useful when the app has embeddings and needs semantic nearest-neighbor search. That may become useful later for:

- Similar artist or album recommendations.
- Semantic matching of messy release names.
- Clustering user search behavior.
- Embedding-based duplicate detection.
- AI-assisted metadata cleanup.

More concrete possible uses:

- Store embeddings for artist names, aliases, album titles, release disambiguation text, genres, and folder names.
- Find likely metadata matches for very messy Soulseek folder names that normal string similarity cannot handle.
- Cluster repeated failed searches to identify alternate naming patterns.
- Recommend nearby albums or artists from the user's library and wanted history.
- Detect likely duplicate imports when filenames and tags differ but text context is similar.
- Build hybrid search that combines Postgres full-text search, trigram similarity, and vector similarity.
- Power future AI-assisted review explanations, such as "this looks like a deluxe edition rather than the standard release."

Example future table shape:

```text
semantic_embeddings
  id
  entity_type
  entity_id
  embedding_model
  embedding_dimensions
  source_text_hash
  embedding
  created_at
```

Possible embedded entities:

```text
artist
release_group
release
track
candidate_folder
search_query
import_review
```

Those are not first-order v1 problems. The first-order v1 problems are deterministic:

- Does this folder contain the expected tracks?
- Do filenames match expected track titles?
- Does the release year/type/artist line up?
- Is the transfer practical?
- Did the import validate?

These can be handled with normalized strings, trigram similarity, duration checks, tag checks, AcoustID, and explainable scoring.

Do not use `pgvector` for:

- Basic artist/album/track identity.
- Primary wanted state.
- Exact release matching.
- Transfer state.
- Import state.
- User trust state.
- Any decision that must be fully deterministic and explainable in v1.

Keeping `pgvector` optional has benefits:

- Smaller default image.
- Fewer extension compatibility concerns.
- Less migration complexity.
- No need to create embeddings infrastructure before it has product value.
- More explainable v1 matching decisions.

Decision: keep the schema compatible with future vector features, but do not enable or require `pgvector` initially.

### Graph Database Decision

Do not use a separate graph database in v1.

Music metadata does have graph-like relationships:

- Artists have aliases, memberships, credits, collaborations, and relationships.
- Release groups contain releases.
- Releases contain media and tracks.
- Tracks link to recordings.
- Recordings can appear across many releases.
- Soulseek users can have repeated trust and transfer relationships.

However, these relationships are manageable in PostgreSQL with ordinary tables.

Use explicit relationship tables:

```text
artist_aliases
artist_relationships
artist_release_groups
release_group_releases
release_media
media_tracks
track_recordings
recording_release_appearances
soulseek_user_outcomes
```

If recursive traversal is needed later, PostgreSQL recursive CTEs can handle modest graph-style queries. For v1, the app mostly needs scoped lookups and workflow state, not open-ended graph traversal.

A graph database would add:

- Another service to run.
- Another backup/restore model.
- Another query language.
- More operational support burden.
- More data consistency work between Postgres and the graph store.

Decision: model relationships explicitly in Postgres. Reconsider a graph database only if future features require deep relationship traversal that is painful or slow in Postgres.

### Potential Technical Issues

The main risks to track before implementation:

- Embedded Postgres lifecycle: init, start, stop, health, backup, and restore need careful scripting.
- PostgreSQL major upgrades: must fail safely until an upgrade path exists.
- Alpine native dependencies: Node modules, Chromaprint, audio tag readers, and filesystem tools must be tested on musl.
- slskd API compatibility: version differences should be isolated in the adapter.
- Soulseek rate limits and etiquette: search/browse jobs must avoid excessive traffic.
- Metadata provider rate limits: MusicBrainz must be cached and rate-limited.
- Matching correctness: wrong imports are worse than manual review friction.
- Partial albums: track-fill mode and full-album mode need separate rules.
- Multi-disc releases: flat folders and disc subfolders must both be handled.
- File path handling: Windows-mounted shares, Docker paths, permissions, and case sensitivity can be messy.
- Long-running jobs: search, browse, transfer reconciliation, and fingerprinting need durable state.
- UI scale: candidate tables and wanted views may grow large and need pagination/virtualization.
- Observability: users need enough logs/status to understand stuck searches, failed downloads, and import decisions.

The v1 posture should be conservative: fewer required moving parts, more explicit state, and manual review before automation.

## Migration Strategy

Database migrations should be timestamped and tracked explicitly.

Migration files should use time-based identifiers so ordering is obvious and collision risk is low:

```text
YYYYMMDD_HHMMSS_description.sql
```

Classifarr supports old numeric migrations and newer timestamp migrations. For this project, we should start with timestamped migrations only unless there is a strong reason to support a legacy numeric format.

The database should include a migration status table. A minimal Classifarr-style table tracks:

- Migration filename
- Applied timestamp

Our table should start slightly richer so operational status can be shown clearly:

- Migration identifier
- Filename
- Name or description
- Checksum
- Status
- Started timestamp
- Finished timestamp
- Duration
- Error message
- Application version

Migration statuses should include:

- Pending
- Running
- Applied
- Failed
- Rolled Back
- Skipped

The app should expose migration state in an operational/status view so startup problems are understandable. If migrations fail, the app should report the failed migration and error clearly instead of failing silently or hiding the database state.

For the initial implementation, the migration runner should run before the API becomes ready. Migration failure should keep the app unhealthy until the issue is resolved.

The repository should include migration helper scripts:

- Create a timestamped migration from a description.
- Validate migration filenames.
- Block new non-timestamped migration files.
- Dump or refresh a schema snapshot for fresh installs.

Later, if multi-instance deployments become a goal, migrations should be moved to a single-run job or leader-controlled process.

## Trust Model

The app should build its own local Soulseek source-user trust model.

Soulseek should not be treated as having a reliable global reputation system. Harmoniarr should instead derive source reliability from observed local outcomes, current availability, and user decisions.

This score should influence candidate ranking, but it should not override identity matching. A trusted user with the wrong album is still a bad candidate.

### Source Signals

Per-user data may include:

- Preferred, trusted, ignored, or blocked state.
- User notes.
- First seen and last seen.
- Current presence when available.
- Free upload slot availability.
- Queue length and queue position over time.
- Upload slot count when available.
- Browse success or failure.
- Successful downloads.
- Failed downloads.
- Stalled downloads.
- Cancelled or retried downloads.
- Average speed.
- Average wait time.
- Transfer completion rate.
- Import acceptance rate.
- Import rejection rate.
- Wrong-track or wrong-album history.
- Complete-album-folder rate.
- Common quality, such as MP3, FLAC, cue/log presence, and artwork.
- Direct CD-rip confidence history.
- Antivirus quarantine events when antivirus scanning exists.

The app should record both current projections and historical events. Current trust state is useful for ranking, but history is needed to explain why the app trusts or avoids a user.

### Source Labels

The UI should avoid pretending there is a universal Soulseek reputation score.

Suggested labels:

- `Trusted`
- `Reliable`
- `New`
- `Slow`
- `Risky`
- `Ignored`
- `Blocked`
- `Known good source`
- `Needs review`

Labels should be explainable. A user should be able to see why a source is marked reliable or risky.

### Source Score Factors

Candidate scoring should include a source score with positive and negative factors.

Positive factors:

- Prior successful imports from this user.
- High transfer completion rate.
- Good average speed.
- Low or reasonable queue length.
- Free upload slot available.
- Browse succeeds.
- Complete folder structure.
- Repeated high-quality files.
- Prior accepted lossless or CD-rip-confidence imports.
- User explicitly marked trusted.

Negative factors:

- Repeated failed or stalled transfers.
- Very slow average speed.
- Long queue or unavailable slots.
- Browse repeatedly fails.
- Prior wrong-album or wrong-track imports.
- Prior rejected imports.
- Suspicious files, bad tags, or corrupted files.
- Antivirus quarantine event when scanning exists.
- User explicitly ignored or blocked.

Example explanation:

```text
Source score: 82
  + prior successful imports
  + has free upload slot
  + complete album folder
  + FLAC with log/cue history
  - long queue
  - one previous stalled download
```

### Source Decision Rules

Source reliability should affect ordering and automation eligibility:

- Blocked users should not be selected automatically and should be hidden by default.
- Ignored users should be de-prioritized or hidden depending on filters.
- Trusted users can raise confidence for otherwise similar candidates.
- New users should be allowed, but require normal review.
- Risky users should require review even if metadata matching looks good.
- Source trust should never make a bad identity match acceptable.

The ranking priority should be:

```text
Identity match
  -> completeness
  -> quality/rip confidence
  -> source reliability
  -> queue/download practicality
```

### Suggested Records

Source trust may need records such as:

- `soulseek_users`
- `soulseek_user_events`
- `soulseek_user_outcomes`
- `soulseek_user_trust_decisions`
- `soulseek_user_score_snapshots`
- `soulseek_user_notes`

Events should include enough context to explain future decisions, such as wanted item, candidate, transfer, import review, quality outcome, and user action.

This allows the app to become better over time without needing perfect metadata or a global Soulseek reputation system.

## Automation Strategy

Automation should be introduced gradually.

V1 should emphasize manual review and reliable workflows.

Later automation can include:

- Auto-grab from trusted users
- Auto-grab high-confidence full albums
- Upgrade lossy to lossless
- Fill missing tracks
- Retry failed candidates
- Avoid blocked users
- Enforce quality profiles
- Reject suspicious results

## Deployment Model

The app should run as a Docker service with embedded Postgres by default.

The underlying application image should be Alpine-based. This aligns with the Classifarr-style deployment model and keeps the image relatively small while still allowing Postgres runtime packages to be installed into the app image.

Alpine container requirements:

- Use an Alpine base image for the main application container.
- Install Postgres runtime packages inside the application image.
- Keep the container capable of running as a non-root user.
- Support `PUID`, `PGID`, `TZ`, and `UMASK` style environment configuration where practical.
- Ensure the embedded Postgres runtime, app process, logs, and data directory work correctly with mounted volumes.
- Include startup checks for Postgres data-directory version compatibility.
- Keep package choices explicit so Postgres, media tooling, and future audio/tagging dependencies are reproducible.

Typical deployment:

```text
harmoniarr
  Main application UI/API
  Scheduler
  Importer
  Embedded Postgres process
  Migration runner

slskd
  Soulseek connection
  Search/download backend

Volumes
  /config
  /data/postgres
  /downloads
  /incomplete
  /music
```

The app and `slskd` should share access to download paths so completed files can be imported reliably.

External Postgres can be supported later, but the default path should be a complete Docker deployment that works without separate database provisioning.

The embedded Postgres data directory must live in a persistent volume. Container rebuilds and upgrades must not destroy database state.

## Compatibility Strategy

Compatibility with Soulseek behavior should be validated early.

The project should maintain recorded or synthetic examples of real `slskd` API responses for:

- Search results
- User browsing
- Active transfers
- Completed transfers
- Failed transfers
- Queue position responses
- Error responses

These fixtures should be used to test normalization, matching, scoring, transfer reconciliation, and retry logic.

## Testing And Quality Strategy

The project should use a Classifarr-style split between client, server, integration, and operational quality checks.

The root project should orchestrate quality commands across the workspace instead of requiring contributors to remember separate commands for each package.

Expected command groups:

- `lint`
- `lint:server`
- `lint:client`
- `test`
- `test:server`
- `test:client`
- `test:integration`
- `test:coverage`
- `test:ci`
- `coverage:ratchet:check`
- `coverage:ratchet:update`
- `migration:check`
- `migration:create`
- `db:dump-schema`
- `lint:docs`

Server tests should cover:

- Domain logic
- Soulseek/slskd adapter normalization
- Candidate scoring
- Search result grouping
- Transfer reconciliation
- Import pipeline decisions
- Migration runner behavior
- API routes
- Authentication and authorization
- Background jobs and schedulers
- Error handling and retry classification

Client tests should cover:

- Core views
- Stores/state management
- API client wrappers
- Candidate comparison UI behavior
- Transfer/import status rendering
- Settings forms
- Error and empty states
- Accessibility-sensitive interactions where practical

Integration tests should cover:

- App startup against Postgres
- Migration application and status reporting
- slskd adapter behavior using fixtures or a controlled test double
- Download/transfer reconciliation flows
- Import review workflows
- Docker-facing health checks
- API route behavior with real database state

The test stack should match Classifarr's shape:

- Jest for server tests.
- Supertest for Express route tests.
- Testcontainers and `@testcontainers/postgresql` for database-backed integration tests.
- `pg-mem` for fast database-adjacent unit tests where appropriate.
- Vitest for client tests.
- Vue Testing Library and Vue Test Utils for frontend behavior.
- Coverage reports for both server and client.

Coverage should use a ratchet model. The baseline should be committed to the repository, and CI should fail when server or client coverage drops below the committed baseline beyond a small tolerance. Intentional decreases should require updating the baseline in the same change.

Quality gates should include:

- ESLint for server code.
- ESLint for client code.
- Copyright/license header compliance using the same style as Classifarr.
- Security-focused lint rules for backend code where practical.
- Test linting to catch bad test patterns.
- Migration filename validation.
- Schema snapshot freshness checks once schema snapshots exist.
- Markdown/docs linting.
- Docker image build verification.
- Health endpoint verification for the built image.
- Dependency vulnerability scanning.
- Secret scanning.
- Container vulnerability scanning.
- CodeQL or equivalent static analysis once the repository is hosted.

The initial CI model should include:

- Install root, server, and client dependencies.
- Validate migration names.
- Run server lint.
- Run client lint.
- Run server tests with coverage.
- Run client tests with coverage.
- Run coverage ratchet check.
- Run database-backed integration tests.
- Build the client.
- Build the Alpine Docker image.
- Optionally run the image and check `/health`.

The project should also keep targeted fixture tests for Soulseek compatibility. These are important enough to be treated as product tests, not incidental adapter tests.

## Release Workflow

The project should use a Classifarr-style release checklist. The working release checklist lives in `release.md` and should be kept current as the build, test, and publishing process becomes concrete.

Release metadata should include:

- Public release label
- Package version
- Date
- Owner
- Scope or highlights

Pre-release checks should require:

- Completed implementation scope.
- Passing server tests.
- Passing client tests.
- Passing integration tests.
- Passing coverage ratchet.
- Passing lint and security checks.
- Reviewed database migrations.
- Refreshed schema snapshot when migrations changed.
- Successful Docker image build.
- Verified embedded Postgres startup path.
- Updated slskd/Soulseek compatibility fixtures when adapter behavior changed.

Versioning should keep public labels and package versions distinct when needed:

- Public labels, Git tags, release notes, and UI display use labels such as `v0.1.0-beta`.
- Package files use semver-safe values such as `0.1.0-beta`.

The release process should include:

1. Update `RELEASE_NOTES.md`.
2. Update `CHANGELOG.md` when required.
3. Bump package and UI version references.
4. Run the full local quality checklist.
5. Commit with `release: vX.Y.Z-beta`.
6. Create the GitHub Release and tag with `gh release create`.
7. Let the release pipeline build and publish the Docker image from the tag.

Post-release verification should include:

- Confirm release pipeline success.
- Confirm published image availability.
- Smoke test fresh install startup.
- Smoke test existing-volume upgrade startup and migrations.
- Verify `/health`.
- Verify UI version display.
- Smoke test login/auth, slskd connection validation, search, candidate review, transfer status, and import review.
- Monitor logs for startup, migration, embedded Postgres, and Soulseek adapter errors.

## Non-Goals For Early Versions

Early versions should not try to:

- Replace the full `slskd` web UI
- Implement the Soulseek protocol directly
- Promise fully automatic perfect matching
- Clone Lidarr's UI exactly
- Support every metadata edge case
- Hide uncertainty from the user
- Require antivirus scanning before the core acquisition and import workflow is usable

## UI Location Model

The app needs an initial answer for where the user goes to perform core actions. This section is intentionally high-level; detailed screen design can come later.

### Library Hierarchy

The user-facing library should be organized artist-first.

The practical hierarchy should be:

```text
Artist
  -> Albums
      -> Songs
```

This matches how most users think about a music collection. A user should be able to add an artist, see that artist's albums, open an album, and see the songs that belong to it.

Internally, the app should still preserve the more precise MusicBrainz model:

```text
Artist
  -> Release Group
      -> Release
          -> Medium
              -> Track
                  -> Recording
```

The UI does not need to expose all of those terms by default. In normal screens:

- `Artist` is the top-level managed library entity.
- `Album` represents the broad release-group concept users recognize.
- `Edition` or `Release` can appear only when the user needs to choose or inspect a specific version.
- `Song` is the user-facing track row under an album.

This gives the app a familiar shape while keeping enough metadata precision for matching, imports, and future automation.

### Acquisition Unit

Harmoniarr should be artist-organized but album-first for acquisition.

The normal v1 workflow should be:

```text
Add artist
  -> choose monitored albums
  -> create wanted album/release items
  -> search for album candidates
  -> download a selected candidate
  -> validate songs during import
```

This keeps v1 focused on the strongest Soulseek workflow: finding complete album folders from users. Track-level acquisition should exist as a supported model, but it should be secondary at first.

Practical rules:

- Adding an artist creates a durable artist record and known album records.
- Albums under the artist can be monitored, unmonitored, missing, complete, failed, or upgradeable.
- Songs under an album inherit album intent by default.
- A song can become individually wanted when it is missing, failed, rejected during import, or needed for gap filling.
- Full album search should be the default discovery mode.
- Missing-song fill should be a fallback mode after album-level discovery or import review shows gaps.

This separates navigation from acquisition:

```text
Navigation hierarchy: Artist -> Album -> Song
Primary acquisition unit: Album/Release
Secondary acquisition unit: Song/Track
```

The database and workers should preserve both levels from the beginning so that later gap filling does not require a redesign.

### Existing Library Scan

Harmoniarr should be able to scan an existing music library and use that scan to determine what is already present, what is missing, and what may need attention.

This is a core onboarding mechanism. A new user may already have a large music collection. The app should not assume every monitored album is missing until it has inspected the configured library folders.

The scan should answer:

- Which artists already exist in the library?
- Which albums appear to exist under each artist?
- Which songs/files are present for each album?
- Which expected songs are missing?
- Which albums are complete?
- Which albums are partial?
- Which files are unmatched or ambiguous?
- Which existing files are below the desired quality profile?

The first scan does not need to be perfect, but it must be explainable. The app should show why a folder or file was matched to an artist, album, release, or song.

Practical scan flow:

```text
Read configured library roots
  -> discover audio files
  -> read path, filename, size, extension, and modified time
  -> read audio tags when possible
  -> group files into likely albums
  -> match groups to known or discovered artists/albums
  -> compare files against expected song lists
  -> create or update library state
  -> recalculate wanted and missing state
```

The scan should use multiple signals:

- Folder structure.
- Filenames.
- Embedded tags.
- Track numbers.
- Disc numbers.
- Durations.
- Audio format and bitrate.
- Existing MusicBrainz tags when present.
- AcoustID fingerprints later, when available.

Library scanning should create durable records for observed files and scan runs. It should not only update a final current-state table. Users need to understand what changed between scans, why an album became complete, or why a file became unmatched.

Initial scan states should include:

- `matched`: file confidently maps to an expected song.
- `partial`: album has some expected songs but is incomplete.
- `ambiguous`: file or folder could match more than one artist, album, release, or song.
- `unmatched`: file is in the library but not mapped to managed metadata.
- `ignored`: user has chosen not to manage this file or folder.
- `duplicate`: more than one file appears to satisfy the same song.
- `upgradeable`: file is present but below the desired quality threshold.

The library scan should feed wanted state directly:

- Complete albums should not create wanted items.
- Partial albums should create wanted song state for missing tracks.
- Missing monitored albums should create wanted album/release state.
- Upgradeable albums or songs should become wanted only if the selected quality profile allows upgrades.
- Ambiguous and unmatched files should require review rather than being treated as missing automatically.

For v1, library scanning can be conservative:

- Prefer matching by existing tags and clear folder structure.
- Avoid destructive changes.
- Do not retag or move existing files during scan.
- Let the user review ambiguous matches.
- Treat scan results as evidence for wanted reconciliation, not as irreversible truth.

This scan mechanism is what lets onboarding become practical: the app can inspect the user's current collection first, then show the user a meaningful library, missing list, and next actions.

### First-Run Onboarding

The first-run experience should guide the user through the minimum setup needed for Harmoniarr to understand the library and safely use Soulseek.

The onboarding flow should be:

```text
Create admin user
  -> configure slskd connection
  -> configure library and download paths
  -> validate permissions and path mapping
  -> scan existing library
  -> review scan summary
  -> add or confirm artists
  -> choose monitoring defaults
  -> show wanted and missing state
```

The app should strongly encourage an existing library scan, but it should not require one for an empty library. Users starting fresh should be able to skip directly to adding artists.

Onboarding should validate:

- Harmoniarr can reach `slskd`.
- `slskd` authentication works.
- Library paths are readable.
- Import target paths are writable.
- Download paths are visible to both Harmoniarr and `slskd`.
- Metadata lookup works.
- The database and background workers are healthy.

After the scan, the user should see a practical summary:

- Artists found.
- Albums found.
- Complete albums.
- Partial albums.
- Missing monitored albums.
- Missing songs.
- Unmatched files.
- Ambiguous matches needing review.
- Upgradeable files if quality rules are configured.

The goal is not to overwhelm the user with every file. The goal is to explain the current state and give direct next actions:

- Review ambiguous matches.
- Add or confirm artists.
- Monitor missing albums.
- Search for missing albums.
- Search for missing songs in partial albums.
- Ignore folders or files that should not be managed.

Onboarding should end in the real application, not a separate success page. The first post-onboarding screen should show the library state, wanted state, active setup issues, and the next useful actions.

The UI should make the user's acquisition path obvious:

```text
Add music intent
  -> see wanted state
  -> search/review candidates
  -> download
  -> import
  -> verify library state
```

Primary navigation areas:

- `Dashboard`: home and artist/library workspace with all artists, library state, priority summaries, urgent reviews, recent activity, and a compact search launcher.
- `Missing`: focused view of missing albums, missing songs, partial albums, future release holds, failed search gaps, and upgradeable items.
- `Activity`: operational workbench for current queues, wanted items, candidates, downloads, imports, detected releases, history, blocklist, failed jobs, source-user trust, and future quarantine views.
- `Search`: manual Soulseek search page for direct queries, large result sets, grouped results, folder browsing, and creating managed candidates or wanted items from manual results.
- `Settings`: slskd connection, metadata, media management, transcoding, quality profiles, paths, automation, and system status.

The sidebar should stay focused. `Library` lives primarily through the dashboard and artist/album pages. `Missing` is first-class because finding absent music is a core workflow. `Wanted`, `Candidates`, `Downloads`, `Imports`, `Users`, `History`, and `Blocklist` belong in `Activity` as tabs or saved views, with urgent summaries surfaced on the dashboard. `Search` remains top-level because direct Soulseek queries can produce large result sets that need dedicated filtering and review space.

### Where To Add Artists

The main place to add an artist should be the `Dashboard`, because the dashboard is also the main artist library view.

Expected flow:

1. User opens `Dashboard`.
2. User selects `Add Artist`.
3. User searches metadata sources for the artist.
4. User chooses the correct artist.
5. User chooses monitoring behavior.
6. App creates artist, release, track, and wanted records.
7. User lands on the new artist page with wanted state visible.

The artist page should show enough state to answer:

- Which albums/releases are known?
- Which songs belong to each album?
- Which items are monitored?
- Which items are missing?
- Which items already exist in the library?
- Which items are actively searching, downloading, or waiting for review?
- Which actions are available now?

Adding an artist should not hide the acquisition work in the background. The user should be able to see what became wanted and why.

### Artist, Album, And Song Pages

The main library views should follow the same hierarchy as the data model.

The artist page should be the primary management page for a known artist. It should show:

- Artist identity and metadata source.
- Monitored state.
- Albums grouped by status.
- Missing, monitored, complete, failed, and upgradeable album counts.
- Active searches, downloads, candidate reviews, and imports for that artist.
- Actions to monitor albums, search selected albums, or add a specific album.

The album page should be the primary acquisition page. It should show:

- Album metadata and selected release/edition.
- Song list with track numbers, titles, durations, and file status.
- Wanted status.
- Candidate search history.
- Ranked Soulseek candidates.
- Active or historical downloads.
- Import reviews and rejected files.
- Actions to search, retry, download a candidate, or fill missing songs.

Song rows should stay lightweight in v1. A song should show whether it is missing, present, downloading, imported, rejected, or individually wanted. Detailed song-level acquisition can come after album matching and import review are reliable.

### Other Entry Points

Artist add is not the only way to create intent.

The UI should also allow:

- Add a specific album from `Missing`, the artist page, or global search.
- Add a one-off track from `Missing` or the `Search` page.
- Start manual search from an artist page.
- Start manual search from an album/release page.
- Search for a missing item directly from `Missing`.
- Open manual search from `Missing` with artist, album, song, release year, and quality target prefilled.
- Retry failed wanted items from `Activity`.
- Search again from a candidate review page.
- Create a wanted item from a completed manual Soulseek result.
- Correlate a manual Soulseek search result to a known artist, album, or song.
- Override an existing automated association when the user knows a result belongs to a different artist, album, or song.

This matters because not every user action begins with a clean artist import. Sometimes the user already knows the album, sometimes they only know a track, and sometimes they find something while browsing Soulseek that should become part of the managed library.

### Manual Search Correlation

The `Search` page should allow the user to correlate raw Soulseek results to managed library entities.

Because manual Soulseek search can return many rows, the result table should support:

- Multi-select by checkbox.
- Shift/range-select across the current sorted and filtered result order.
- Add/remove selection with keyboard modifiers where supported.
- Sort by user, folder, filename, size, extension, quality, bitrate, queue, speed, and match confidence.
- Filter by text, user, folder, extension, quality, bitrate, size, queue, availability, trust state, ignored state, and blocked state.
- Bulk actions for correlation, candidate creation, selected download, ignore, block, trust, copy paths, and export/debug metadata.

Bulk actions should always show the selected row count and preview high-impact changes before applying them.

Supported correlation targets:

- Known artist.
- Known album or release.
- Known song or track.
- New wanted artist, album, or song intent.
- Not-this-item exclusion for incorrect automated matches.

Manual correlation can override current automated state when needed. For example, the user may decide that a folder belongs to a specific album despite weak filename matching, or that a loose file should satisfy a missing song. The app should treat this as high-priority user evidence, but it should not erase the previous automated match.

Override requirements:

- Preserve the previous association.
- Record who made the override, when it happened, and why if a reason was provided.
- Show override badges in candidate and import review.
- Allow the user to clear or replace an override later.
- Require import review if the override conflicts with metadata, duration, fingerprint, or quality evidence.

This lets manual Soulseek exploration feed the managed workflow without forcing every result through automatic matching first.

### Missing Page

The `Missing` page should show the library gaps Harmoniarr can act on.

Missing item types:

- Missing album.
- Missing song.
- Partial album.
- Future release hold.
- Quality upgrade.
- Failed search retry.
- Manual wanted item.

The page should support filters for artist, album, type, monitored state, quality profile, last search age, status, and failure reason.

Each missing item should expose two primary acquisition actions:

- `Search`: create or retry managed discovery for that missing item.
- `Manual`: open the `Search` page with artist, album, song, release year, and quality target prefilled.

When `Manual` opens the `Search` page, the missing item should remain attached as the correlation target. Selected search results can then be correlated back to the missing album or song without the user re-entering context.

Other actions should include:

- Ignore the missing item.
- Unmonitor the artist, album, or song.
- Mark satisfied when the user knows the library already contains it.
- Open artist or album detail.
- View prior searches and failures.

### Initial Screen Priority

The first useful screen after login should probably be operational rather than decorative.

Initial decision: start with a practical dashboard that shows all artists as the primary table, plus a compact search launcher, priority summaries, urgent candidate/import reviews, setup health, detected releases, and recent activity. The dashboard should be the main library page, while `Activity` should be the operational queue and history page.

### UI Principle

The UI should separate intent from activity:

- Intent starts on `Dashboard` through artists, albums, wanted summaries, and monitoring state.
- Missing acquisition intent lives in `Missing`.
- Operational queues live in `Activity` for wanted items, candidates, downloads, imports, detected releases, source users, blocklist, failed jobs, and history.
- Manual discovery lives in `Search`, with compact launchers and contextual search actions available from the dashboard, artist pages, and album pages.
- Configuration and health live in `Settings`.

This separation should prevent the app from feeling like one giant search page while still keeping Soulseek acquisition central.

## Design Direction

The frontend should be a dense, practical power-user interface.

The UI should prioritize:

- Fast search review
- Clear candidate comparison
- Transfer visibility
- Import confidence
- Library state
- Missing/wanted music
- Manual override controls

It should avoid a marketing-style layout. The first screen should be the actual application experience.

### UI Skill Usage

UI planning and implementation should use the available UI-focused Codex skills when the task calls for them.

Expected usage:

- Use `figma-generate-design` when turning Harmoniarr screen plans, flows, or existing app pages into Figma screens.
- Use `figma-implement-design` when implementing production UI from Figma designs, components, or design specs.
- Use `imagegen` when Harmoniarr needs bitmap visual assets such as artwork placeholders, mockups, textures, or other raster UI imagery.

These skills should support the existing product direction rather than override it. Harmoniarr should remain a dense, operational, power-user application for library management and Soulseek acquisition, not a marketing site or decorative prototype.

During planning, these skills should be referenced when defining screen flows, design assets, and implementation handoff expectations. They should not be treated as a requirement to generate final UI before the product flows, data model, and user decisions are understood.

### UI Element Rough Inventory

This section is a rough reusable element inventory, not a final component spec. The goal is to name the common UI building blocks Harmoniarr will likely need so future screen planning can stay consistent.

#### Navigation Elements

The app should use predictable operational navigation:

- Primary sidebar with `Dashboard`, `Missing`, `Activity`, `Search`, and `Settings`.
- Top bar with global search, system health summary, active task indicators, and user menu.
- Breadcrumbs on deeper pages, such as `Dashboard / Artist / Album`.
- Context tabs on entity pages for views such as overview, releases, candidates, downloads, imports, history, and settings.
- Dashboard summaries and quick actions for adding artists, adding albums, launching manual search, and jumping into urgent Activity work.

Navigation should keep the user oriented around what they are managing:

```text
Home and library intent: Dashboard
Missing acquisition intent: Missing
Queues, history, blocklist, and source users: Activity
Manual Soulseek discovery: Search
Configuration: Settings
```

#### Data View Elements

Most core screens should be built around dense, scan-friendly data views.

Expected data elements:

- Sortable tables for wanted items, candidates, downloads, imports, users, library files, and history.
- Filter bars with status, artist, album, quality, source user, age, and confidence filters.
- Saved views for common work queues, such as missing albums, stalled downloads, import problems, and unresolved candidates.
- Expandable rows for details that do not require leaving the current queue.
- Split views where a list selection opens a detail panel.
- Empty states that point to the next real action, such as add artist, scan library, configure slskd, or search wanted item.
- Bulk selection with scoped actions and confirmation for destructive or high-impact operations.

Tables should prefer useful columns over decorative layout. Column density is acceptable because the target user is managing a library and reviewing acquisition evidence.

#### Status Elements

Harmoniarr needs a consistent status language.

Common status badges:

- `Missing`
- `Partial`
- `Complete`
- `Wanted`
- `Unmonitored`
- `Searching`
- `Candidate Found`
- `Needs Review`
- `Queued`
- `Downloading`
- `Completed`
- `Import Ready`
- `Imported`
- `Rejected`
- `Failed`
- `Blocked`
- `Ignored`
- `Upgradeable`

Operational health indicators:

- `slskd` connection status.
- Metadata provider status.
- Provider rate-limit status.
- Database status.
- Worker status.
- Library path read/write status.
- Download path mapping status.
- Queue depth and active job count.

Confidence indicators should be compact but explainable. A candidate or import should be able to show both a simple confidence level and the factors behind it.

#### Music Library Elements

Music-specific UI elements should appear across library, wanted, candidate, and import screens.

Expected elements:

- Artist header with metadata source, monitored state, and library summary.
- Album header with selected release or edition, year, type, cover art, and monitored state.
- Release or edition selector when multiple MusicBrainz releases could satisfy the album.
- Track list rows with disc number, track number, title, duration, file state, and wanted state.
- Cover art thumbnail with fallback state.
- Metadata source badge, usually MusicBrainz in v1.
- Quality summary, such as codec, bitrate, sample rate, channels, and file size.
- Missing track markers.
- Duplicate and upgradeable indicators.
- Existing library file link or path preview.

The UI should show MusicBrainz precision only when useful. Normal users should see artists, albums, editions, and songs; deeper release-group, release, medium, track, and recording identifiers can live in details panels.

#### Soulseek Elements

Soulseek-specific elements are central to the product and should be designed as first-class UI elements rather than hidden technical details.

Expected elements:

- Candidate comparison table.
- Candidate score breakdown.
- Source user row with trust status, notes, queue information, availability, and history.
- Folder path preview.
- File list preview grouped by observed folder.
- Browse-user result panel.
- Search run timeline showing queries attempted and observations found.
- Queue length and transfer availability indicators.
- Trusted, blocked, ignored, and manually noted user markers.
- Retry search action with visible query strategy.

The candidate UI should make it clear that Soulseek results are observations, not guaranteed releases. The user should be able to understand why a folder appears to match or not match the requested album.

#### Review Elements

Review workflows should be explicit and evidence-based.

Candidate review should include:

- Expected album/release summary.
- Observed source folder summary.
- Side-by-side expected track list and observed files.
- Match confidence and score factors.
- Missing, extra, duplicate, and suspicious file markers.
- Source user reliability summary.
- Actions to download, reject, ignore source, block user, trust user, browse folder, or search again.

Import review should include:

- Downloaded file list.
- Proposed track matches.
- Tag and filename evidence.
- Audio validation results.
- Rename and destination preview.
- Extra file handling.
- Conflicts and warnings.
- Actions to import, reject, rematch, rename manually, ignore extras, or quarantine files.

Review screens should preserve the explanation trail. A user should be able to see why Harmoniarr recommended a candidate or blocked an import.

#### Control Elements

Controls should be familiar, compact, and consistent.

Expected control patterns:

- Icon buttons with tooltips for repeated actions such as search, retry, refresh, download, import, reject, ignore, trust, block, edit, and view details.
- Text buttons for primary workflow actions when the label matters, such as `Add Artist`, `Download Candidate`, or `Import Selected`.
- Segmented controls for view modes, such as album candidates versus track candidates.
- Toggles for monitored state, automation settings, provider enablement, and safe import options.
- Select menus for quality profiles, root folders, metadata releases, import behavior, and saved views.
- Sliders or numeric inputs for thresholds, concurrency limits, retry counts, and scoring weights.
- Confirmation dialogs for destructive, irreversible, or broad bulk actions.
- Drawers or side panels for secondary detail where the user should keep their place in a queue.

Controls should avoid hiding uncertainty. If an action depends on confidence, permissions, path mapping, or external service health, the UI should show the blocker or warning before the user acts.

#### First Screens To Detail

The first UI element work should focus on the screens most likely to define the reusable vocabulary:

1. Dashboard.
2. Artist page.
3. Album page.
4. Missing page.
5. Activity queue view.
6. Activity wanted view.
7. Activity candidate review view.
8. Activity downloads view.
9. Activity import review view.
10. Activity users, blocklist, and history views.
11. Search page.
12. Settings pages for system health, `slskd`, paths, media management, and transcoding.
13. Quality profile settings for upgrade enablement, floor, ceiling, and override scope.

These screens cover the core product loop:

```text
Know what is missing
  -> find candidates
  -> choose a source
  -> download
  -> validate
  -> import
  -> update library state
```

## Open Decisions

- Should metadata start with MusicBrainz only, or support multiple sources from the beginning?
- Should `slskd` be managed externally, bundled in Compose, or optionally launched by the app?
- Should imports modify tags in v1, or only rename and move files first?
- How much of Lidarr's quality profile model should be reused conceptually?
- Should the app support multiple Soulseek backends eventually, or only preserve the abstraction?

## Decided

- Project name: Harmoniarr.
- License: GPL-3.0-or-later, matching Classifarr.
- Use a Classifarr-style GitHub Action to check copyright/license headers on source files.
- Use the Classifarr-compatible stack as the default implementation baseline: Node 24, npm, Express 5, Vue 3, Vite, Pinia, Tailwind CSS, Socket.IO, Jest, Vitest, Testcontainers, Docker Alpine, and explicit PostgreSQL access through `pg`.
- Use ES modules for JavaScript and TypeScript code; avoid CommonJS for project scripts and application code.
- Use Postgres by default.
- Use local surrogate UUID primary keys for domain, workflow, and event tables; keep natural/provider identifiers as indexed columns instead of primary keys.
- Target PostgreSQL 18 for the embedded database.
- Pin the standard image to a stable Alpine branch, starting with Alpine 3.23 unless implementation testing shows a blocker.
- Use a Classifarr-style embedded Postgres pattern inside the standard application container.
- Use Alpine as the underlying Docker image base.
- Do not require `pgvector` for v1; keep it optional for future vector-search features.
- Do not use a separate graph database for v1; model relationships explicitly in Postgres.
- Use timestamped migrations with explicit migration status tracking.
- Prefer time-based historical records for searches, scoring, transfers, imports, trust changes, and operational events.
- Include a dependency heartbeat service for external providers, `slskd`, local tools, workers, database health, path readiness, and provider rate-limit state.
- Enforce MusicBrainz public API constraints in the adapter, including a meaningful User-Agent, local caching, jittered refreshes, and a default limit of no more than one request per second.
- Organize the library artist-first, with albums under artists and songs under albums.
- Make album/release the primary v1 acquisition unit, while preserving song/track-level wanted state for missing-song fill and future workflows.
- Include release monitoring for known artists, with a separate release detector that emits durable events before wanted state changes.
- Include quality upgrade detection for present-but-below-profile albums and songs, with direct CD rip confidence treated as explainable evidence rather than a guaranteed binary flag.
- Include local `ffmpeg` tooling in the standard image for media inspection, validation, and future transcoding support.
- Provide media management settings for root folders, naming templates, import behavior, extra files, and safe rename previews.
- Use FFmpeg as the bundled local transcoding engine, with Harmoniarr owning profiles, job state, validation, and policy.
- Support lossless-to-lossy transcoding as the first transcoding direction.
- Keep original lossless files by default; do not replace or delete source files automatically after transcoding.
- Ship default transcoding presets for MP3 320, MP3 V0, Opus 160, AAC 256, and Ogg Vorbis Q6.
- Allow lossy-to-lossy transcoding only with explicit warning and confirmation.
- Warn on lossy-to-lossless transcoding because it cannot restore lost audio information and should not be treated as an upgrade.

## Implementation Plan Placeholder

This section will be expanded after the initial product and architecture direction is agreed.

Expected future sections:

- Milestones
- Technical stack
- Service boundaries
- Database schema
- API routes
- Background jobs
- Import pipeline
- Frontend views
- Testing strategy
- Docker Compose layout
- V1 completion criteria
