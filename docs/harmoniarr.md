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
  search-dispatcher/
  candidate-builder/
  folder-browser/
  transfer-reconciler/
  import-validator/
  metadata-refresher/
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

### Proposed Repository Shape

Initial shape:

```text
client/
  Vite React application

server/
  HTTP API
  background workers
  service modules
  integration adapters

shared/
  shared schemas
  shared API contracts
  shared constants

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

Recommended frontend stack:

- Vite
- React
- TypeScript
- React Router
- TanStack Query
- CSS Modules or scoped plain CSS
- lucide-react icons
- Vitest and Testing Library
- Playwright for browser smoke tests

Vite should be used as the frontend build tool. In development, Vite can serve the client with hot reload and proxy API calls to the backend. In production, the backend should serve the compiled static assets from the Docker image.

The first frontend should be a client-rendered SPA. Server-side rendering is not needed for v1 because the app is authenticated, operational, and dashboard-oriented rather than public content-oriented.

Frontend principles:

- Use URL state for filters, selected views, and review context where useful.
- Use TanStack Query for server state, caching, invalidation, polling, and mutations.
- Use local component state for UI-only state.
- Avoid Redux unless the app proves it needs global client-side state beyond server data.
- Prefer feature folders over global component sprawl.
- Keep dense table and review experiences fast and keyboard-friendly.

### Backend Stack

Recommended backend stack:

- Node.js LTS
- TypeScript
- Fastify as the HTTP server
- Zod for runtime validation and shared schema definitions
- OpenAPI generation from route/schema definitions
- PostgreSQL through `pg`
- Kysely or small repository modules for typed SQL access
- Postgres-backed background jobs

Fastify is a good first backend choice because it is lightweight, plugin-friendly, schema-oriented, and works well for a REST API without imposing a large application framework. The route layer should stay thin so the domain services remain independent from Fastify.

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

V1 can use polling through TanStack Query for most views. This is simpler and reliable.

Later, add a server event stream for high-churn activity:

- Search job progress
- Candidate generation
- Transfer state changes
- Import validation progress
- System notices

Server-Sent Events are probably enough for v1/v2 because the app mostly needs server-to-client updates. WebSockets can be added later if bidirectional realtime interaction becomes necessary.

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

The Docker build should be multi-stage:

1. Install dependencies.
2. Build shared TypeScript.
3. Build the Vite client.
4. Build the server.
5. Copy compiled assets into the final Alpine runtime image.
6. Install only runtime dependencies and required Alpine packages.
7. Start embedded Postgres, run migrations, then start the app.

Production runtime should not require the Vite dev server. Vite is a build-time and local development tool only.

### Package Manager

Use npm workspaces unless there is a strong reason to add another package manager.

This keeps setup simple for contributors and avoids requiring users to understand pnpm/yarn-specific behavior. The repo can still be structured as workspaces:

```text
package.json
client/package.json
server/package.json
shared/package.json
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
typescript
tsx
eslint
typescript-eslint
prettier
rimraf
npm-run-all2
```

`tsx` is useful for local TypeScript scripts, migration helpers, and development entrypoints. `npm-run-all2` is useful if root scripts need to run client/server checks consistently across platforms.

Client runtime packages:

```text
react
react-dom
react-router
@tanstack/react-query
lucide-react
clsx
date-fns
```

Client conditional packages:

```text
@tanstack/react-table
@tanstack/react-virtual
react-hook-form
@hookform/resolvers
zod
```

Use TanStack Table and Virtual only when candidate/wanted/download tables become large enough to need serious table behavior and virtualization. Use React Hook Form only for settings and add/edit flows that become too complex for simple controlled components.

Client build packages:

```text
vite
@vitejs/plugin-react
typescript
```

Server runtime packages:

```text
fastify
@fastify/static
@fastify/cookie
@fastify/session
@fastify/swagger
@fastify/swagger-ui
@fastify/sensible
zod
fastify-type-provider-zod
pg
kysely
pino
undici
bottleneck
p-retry
```

Notes:

- `fastify` owns HTTP routing.
- `@fastify/static` serves the built Vite UI in production.
- `@fastify/swagger` and `@fastify/swagger-ui` expose API docs.
- `zod` validates runtime inputs and can support shared API schemas.
- `pg` is the PostgreSQL driver.
- `kysely` gives typed SQL without hiding Postgres behavior behind a heavy ORM.
- `pino` gives structured logs and aligns with Fastify defaults.
- `undici` can be used for explicit HTTP clients, though native `fetch` may be enough.
- `bottleneck` and `p-retry` are useful for MusicBrainz, AcoustID, and slskd retry/rate-limit behavior.

Server conditional packages:

```text
pg-boss
music-metadata
file-type
fast-glob
sanitize-filename
proper-lockfile
```

Use `pg-boss` only if the internal jobs table becomes too limited. Start with our own simple job records if that keeps the first implementation clearer.

Use audio/file packages when the import validator needs them:

- `music-metadata` for tags and duration.
- `file-type` for sniffing file type when extensions are unreliable.
- `fast-glob` for library/import scans.
- `sanitize-filename` for safe rename/move operations.
- `proper-lockfile` if import operations need cross-process file locking.

Shared package dependencies:

```text
zod
```

The shared workspace should stay small. It should contain schemas, inferred types, constants, and API contracts. It should not depend on server-only or client-only libraries.

Testing packages:

```text
vitest
@vitest/coverage-v8
jsdom
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
msw
@playwright/test
```

Testing roles:

- `vitest`: unit and service tests.
- `@vitest/coverage-v8`: coverage reports and ratchet support.
- `jsdom`: React component tests.
- Testing Library packages: user-focused UI tests.
- `msw`: mock HTTP APIs for client tests.
- `@playwright/test`: browser smoke and workflow tests.

The server can use Fastify's built-in injection testing for route tests instead of adding a separate HTTP test client at first.

Packages to avoid initially:

```text
redux
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

- Redux is unnecessary while TanStack Query handles server state.
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
4. App derives wanted items from monitoring rules and existing library state.
5. App creates discovery requests for wanted items that are eligible to search.
6. Scheduler turns eligible discovery requests into search jobs.
7. Search jobs create candidate records.
8. Candidate review or automation creates download jobs.
9. Transfer reconciliation creates import reviews.
10. Import approval creates library files and updates wanted state.

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

- Metadata refresh: periodic artist and release metadata updates.
- Wanted reconciliation: periodic recalculation of missing, monitored, and upgradeable music.
- Search queue dispatch: frequent but rate-limited search job creation.
- Candidate refresh: occasional re-search for wanted items with no good candidates.
- Transfer reconciliation: frequent polling of active slskd downloads.
- Import scan: frequent check for completed files ready to validate.
- Trust/statistics update: periodic aggregation of user outcomes, queue behavior, and speeds.
- Cleanup: remove stale slskd search handles, old raw payloads beyond retention, and expired browse cache entries.

Search cadence should be conservative by default. A practical starting point is immediate dispatch for manual actions, then scheduled automatic searches with per-wanted-item cooldowns.

### Event-Driven Triggers

Some work should happen as a direct consequence of state changes:

- Artist metadata imported -> recalculate monitored releases.
- Wanted item created -> mark as search eligible if monitored and missing.
- Search job completed -> build candidates.
- Candidate built -> browse promising folders.
- Folder browse completed -> run matching and scoring.
- Candidate accepted -> create download job.
- Download job created -> enqueue selected files through slskd.
- Transfer state changed -> append transfer event.
- Transfer completed -> create import review.
- Import accepted -> move or link files into the library.
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
- `/health` returns a simple readiness payload with `status`, `database`, and `timestamp`.
- The mounted app data volume maps to `/app/data`.
- The embedded Postgres data directory is `/app/data/postgres`.
- Postgres listens on the local container socket/port and reports ready before the app finishes startup.
- Startup logs report the migration result, for example `142 total, 0 newly applied`.
- The live `schema_migrations` table contains timestamped migration filenames such as `20260425_121000_fix_image_embedding_defaults.sql`.
- Authenticated operational endpoints, such as `/api/migration/status`, return `401` without credentials.

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

The app should remember Soulseek user outcomes.

Per-user data may include:

- Preferred user
- Blocked user
- Successful downloads
- Failed downloads
- Average speed
- Queue behavior
- Common quality
- Notes
- Last seen

This allows the app to become better over time without needing perfect metadata.

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

The test stack should be similar in shape to Classifarr:

- Jest or equivalent for server tests.
- Supertest or equivalent for HTTP route tests.
- Testcontainers or an equivalent containerized Postgres harness for database-backed integration tests.
- Vitest or equivalent for client tests.
- Testing Library style component tests for frontend behavior.
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

## UI Location Model

The app needs an initial answer for where the user goes to perform core actions. This section is intentionally high-level; detailed screen design can come later.

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

- `Library`: known artists, albums, tracks, and imported files.
- `Wanted`: missing, monitored, upgradeable, and failed items.
- `Search`: manual Soulseek search and discovery runs.
- `Candidates`: ranked Soulseek matches waiting for review.
- `Downloads`: active, queued, failed, and completed transfers.
- `Imports`: completed downloads waiting for validation or user action.
- `Users`: Soulseek user trust, block, history, and notes.
- `Settings`: slskd connection, metadata, quality profiles, paths, automation, and system status.

### Where To Add Artists

The main place to add an artist should be the `Library` area.

Expected flow:

1. User opens `Library`.
2. User selects `Add Artist`.
3. User searches metadata sources for the artist.
4. User chooses the correct artist.
5. User chooses monitoring behavior.
6. App creates artist, release, track, and wanted records.
7. User lands on the new artist page with wanted state visible.

The artist page should show enough state to answer:

- Which albums/releases are known?
- Which items are monitored?
- Which items are missing?
- Which items already exist in the library?
- Which items are actively searching, downloading, or waiting for review?
- Which actions are available now?

Adding an artist should not hide the acquisition work in the background. The user should be able to see what became wanted and why.

### Other Entry Points

Artist add is not the only way to create intent.

The UI should also allow:

- Add a specific album from `Wanted`, `Library`, or global search.
- Add a one-off track from `Search` or `Wanted`.
- Start manual search from an artist page.
- Start manual search from an album/release page.
- Retry failed wanted items from `Wanted`.
- Search again from a candidate review page.
- Create a wanted item from a completed manual Soulseek result.

This matters because not every user action begins with a clean artist import. Sometimes the user already knows the album, sometimes they only know a track, and sometimes they find something while browsing Soulseek that should become part of the managed library.

### Initial Screen Priority

The first useful screen after login should probably be operational rather than decorative.

Candidate starting points:

- `Wanted`: best if the app is focused on missing music.
- `Library`: best if the app is focused on collection management.
- `Activity`: best if the app is focused on current searches, downloads, and imports.

Initial decision: start with a practical dashboard that surfaces wanted items, active downloads, candidate reviews, and import reviews, with clear navigation to `Add Artist` in the `Library` area.

### UI Principle

The UI should separate intent from activity:

- Intent lives in `Library` and `Wanted`.
- Discovery lives in `Search` and `Candidates`.
- Execution lives in `Downloads`.
- Validation lives in `Imports`.
- Memory lives in `Users` and historical detail views.

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

## Open Decisions

- Should the primary wanted unit be album/release, track, or both?
- Should metadata start with MusicBrainz only, or support multiple sources from the beginning?
- Should `slskd` be managed externally, bundled in Compose, or optionally launched by the app?
- Should imports modify tags in v1, or only rename/move files first?
- How much of Lidarr's quality profile model should be reused conceptually?
- Should the app support multiple Soulseek backends eventually, or only preserve the abstraction?

## Decided

- Project name: Harmoniarr.
- License: GPL-3.0-or-later, matching Classifarr.
- Use a Classifarr-style GitHub Action to check copyright/license headers on source files.
- Use Postgres by default.
- Target PostgreSQL 18 for the embedded database.
- Pin the standard image to a stable Alpine branch, starting with Alpine 3.23 unless implementation testing shows a blocker.
- Use a Classifarr-style embedded Postgres pattern inside the standard application container.
- Use Alpine as the underlying Docker image base.
- Do not require `pgvector` for v1; keep it optional for future vector-search features.
- Do not use a separate graph database for v1; model relationships explicitly in Postgres.
- Use timestamped migrations with explicit migration status tracking.
- Prefer time-based historical records for searches, scoring, transfers, imports, trust changes, and operational events.

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
