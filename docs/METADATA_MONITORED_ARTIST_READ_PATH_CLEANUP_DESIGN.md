# Metadata Monitored-Artist Read-Path Cleanup Design

Status: Implemented
Date: 2026-06-23
Owner: Backend architecture + product architecture

## Purpose

This document records the design and implementation outcome for moving the last
two product-facing monitored-artist list reads off the legacy
`metadata_artist_monitoring` table and onto the canonical operator-scoped
monitoring model.

The accepted product model is operator-scoped monitoring:
`operator_artist_monitoring` is the canonical policy table; `metadata_artist_monitoring`
remains only as a legacy compatibility table that new reads must not use. Prior
batches already migrated Release Radar, wanted reconciliation, and metadata
refresh scheduling off the legacy table. This batch closes the monitored-artist
*list* read paths that still powered the admin oversight surface and the
background artwork prefetch.

## Official Source Review

The review used current official sources available in June 2026. URLs were
resolved through web search rather than assumed:

- PostgreSQL aggregate functions: https://www.postgresql.org/docs/current/functions-aggregate.html
- PostgreSQL array functions (`unnest`): https://www.postgresql.org/docs/current/functions-array.html
- PostgreSQL `LATERAL` subqueries: https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-LATERAL
- PostgreSQL `LIMIT` / `OFFSET`: https://www.postgresql.org/docs/current/queries-limit.html
- PostgreSQL partial indexes: https://www.postgresql.org/docs/current/indexes-partial.html
- OWASP SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP Query Parameterization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html
- node-postgres parameterized queries: https://node-postgres.com/features/queries
- Express production security best practices: https://expressjs.com/en/advanced/best-practice-security/
- Node.js test runner: https://nodejs.org/api/test.html

Verified community reference for the aggregation pattern:
- Combining `array_agg` and `unnest` (set-returning functions must live in a
  `LATERAL FROM` item, not inside an aggregate):
  https://dba.stackexchange.com/questions/241989/combining-array-agg-and-unnest

Relevant takeaways applied:

- PostgreSQL set-returning functions such as `unnest()` cannot be nested inside
  an aggregate call; they must be moved into a `CROSS JOIN LATERAL` (or
  equivalent `FROM` item). The cleanup unions monitored release-group types with
  `ARRAY_AGG(DISTINCT ... ORDER BY ...)` over a `CROSS JOIN LATERAL unnest(...)`.
- `ARRAY_AGG` with an `ORDER BY` is the supported way to produce a deterministic
  aggregated array, which keeps the deduplicated release-type list stable.
- OWASP states that for SQL parts that cannot use bind variables (identifiers,
  sort directions), the correct defense is **allow-list input validation**: map
  user-supplied values to legal, code-owned values rather than interpolating raw
  input. The sort-key allow-list in this cleanup follows that guidance.
- OWASP and node-postgres both favor parameterized queries over string-built
  SQL. All search text, limit, and offset values remain bind parameters.
- Express production guidance reinforces deriving scope from trusted server
  state. The admin oversight read derives its scope from operator monitoring
  rows, not from request parameters.

## Problem

Two exported functions in `src/server/metadata/metadata-repository.js` still read
from `metadata_artist_monitoring`:

1. `listMonitoredMetadataArtists({ limit })` — a global, de-duplicated list of
   monitored artists. Its only live consumer was the background artwork prefetch
   worker (`artwork-monitored-artist-prefetch-service.js`). It was also wired
   into `metadata-search-service.listMonitoredArtists`, but that service method
   was **not wired to any route** (the shared monitored-list route had already
   been retired and replaced by the operator-scoped projection endpoint).
2. `listAdminMonitoredMetadataArtists({ search, sort, limit, offset })` — the
   admin oversight list behind `GET /api/v1/metadata/artists/monitored/admin`.
   It read legacy `monitored_release_group_types`, `last_refreshed_at`,
   `monitored_by_user_id`, and `updated_at` directly from the legacy table.

That created three issues:

1. The two highest-traffic monitored-artist list reads still treated a deprecated
   global table as the source of truth.
2. The admin oversight list could report stale monitoring policy (release types,
   refresh timestamps) after operator-scoped policy changed, because the legacy
   table was no longer the canonical writer for those fields.
3. `last_refreshed_at` had already been relocated to
   `metadata_artist_refresh_state` by the metadata-refresh cleanup, so the admin
   list reading it from the legacy table was reading a stale copy.

## Scope boundaries

- The operator-scoped user-facing read (`GET /api/v1/metadata/artists/monitored/operator`
  via `listOperatorMonitoredArtistProjections`) was already completed in a prior
  batch and is out of scope.
- Both remaining consumers are legitimately **global** reads (admin oversight and
  a background prefetch), so this cleanup does not introduce per-user scoping.
  It repoints the reads at the canonical operator-scoped *table* while keeping
  the global aggregation semantics each consumer needs.
- No schema migration is required. All referenced tables, columns, constraints,
  and indexes already exist. `metadata_artist_monitoring` remains present for
  any remaining compatibility reads outside this batch.

## Options Considered

### Option A: Repoint The SQL In Place Inside `metadata-repository.js`

Pros:

- Smallest diff; no new files.

Cons:

- Keeps monitored-artist *store* SQL inside the 798-line singleton-style
  repository module, against the platform boundary rule that SQL belongs in
  dedicated `*-store.js` factories.
- Leaves the dead, un-routed `listMonitoredArtists` service method in place.
- Makes the legacy functions look like first-class citizens while they are being
  retired.

Decision: rejected.

### Option B: Add A Compatibility View Over Operator Monitoring

Pros:

- Gives the legacy SQL a stable name to read.

Cons:

- A view adds privilege/ownership/security-invoker complexity that this codebase
  does not need (it uses one server database role plus service-level
  authorization).
- It would hide the remaining call sites that should migrate explicitly, the
  same reason the prior Release Radar cleanup rejected a view.

Decision: rejected (consistent with the Release Radar decision).

### Option C: Extract A Dedicated Monitored-Artist Store And Rewire Both Consumers

Pros:

- Moves monitored-artist read SQL into a narrow, injectable `*-store.js` factory
  matching `library-release-radar-store.js`, `metadata-artist-refresh-state-store.js`,
  and `operator-artist-monitoring-store.js`.
- Gives each consumer a purpose-built read: a global de-duplicated list for the
  artwork prefetch, and an aggregated admin oversight list for the admin route.
- Removes the dead, un-routed `listMonitoredArtists` service method and the
  legacy repository functions as the natural conclusion of the migration.
- Keeps all SQL parameterized and the sort key behind an allow-list.

Cons:

- Introduces one new store file and touches three call sites.
- Requires updating the prefetch and search-service tests to the new shapes.

Decision: accepted.

### Option D: Show One Row Per Monitoring Relationship In The Admin List

Pros:

- Makes "who monitors what" fully explicit; one row per (artist, operator).

Cons:

- Changes the response cardinality and the admin client table (keyed by artist
  `localId`) would render duplicate artist rows.
- Breaks the established cleanup principle of preserving response shapes while
  repointing the source table.

Decision: rejected for this pass. The admin list stays one row per artist
(deduplicated) with an additive `monitoringOperatorCount`.

## Final Recommendation Stack

1. New store boundary — `metadata-monitored-artist-store.js`
   - Factory `createMetadataMonitoredArtistStore({ getPoolFn = getPool })`.
   - `listMonitoredArtistsForArtwork({ limit })`: global, de-duplicated by
     `metadata_artist_id` over `operator_artist_monitoring` joined to
     `metadata_artists`, filtered to `is_monitored = TRUE`. Returns one row per
     artist with `{ metadataArtistId, musicbrainzArtistId, name }`. Artists with
     a null MusicBrainz id are intentionally retained so the prefetch worker can
     keep its existing skip/summary semantics.
   - `listAdminMonitoredArtists({ search, sort, limit, offset })`: admin
     oversight, one row per monitored artist. Aggregates operators with two CTEs:
     an operator-scope CTE (`MAX(updated_at)` as `monitored_at`,
     `COUNT(DISTINCT app_user_id)` as `monitoringOperatorCount`, and a
     representative most-recent operator) and a release-type CTE
     (`ARRAY_AGG(DISTINCT ... ORDER BY ...)` over `CROSS JOIN LATERAL unnest`).
     `lastRefreshedAt` is read from `metadata_artist_refresh_state`.
     Pagination and search remain fully parameterized; the sort key is resolved
     through a code-owned allow-list `Map`.

2. Admin response contract — preserved, with one additive field
   - Every existing field is retained (`id`, `localId`, `name`, `sortName`,
     `disambiguation`, `artistType`, `country`, `monitoredByUserId`,
     `monitoredByUsername`, `monitoredReleaseGroupTypes`, `lastRefreshedAt`,
     `monitoredAt`, `limit`, `offset`, `total`).
   - `monitoringOperatorCount` is added so the multi-operator reality is
     explicit without changing cardinality. `monitoredByUserId` /
     `monitoredByUsername` represent the most-recent operator.

3. Consumer rewiring
   - `artwork-monitored-artist-prefetch-service.js` injects
     `listMonitoredArtistsForArtwork` from the new store and reads the camelCase
     `musicbrainzArtistId` field.
   - `metadata-search-service.js` delegates `listAllMonitoredArtists` to the new
     store's `listAdminMonitoredArtists` and drops the dead, un-routed
     `listMonitoredArtists` method plus the legacy repository import.

4. Legacy removal
   - `metadata-repository.js` drops `listMonitoredMetadataArtists`,
     `listAdminMonitoredMetadataArtists`, and the `ADMIN_MONITORED_SORT_COLUMNS`
     constant now that they have no callers.

5. Security and posture
   - All search text, limit, and offset values remain bind parameters.
   - The sort direction is never interpolated from user input; it is selected
     from a code-owned allow-list, satisfying the OWASP guidance for
     non-bindable SQL parts.
   - The admin route continues to require a fresh admin session; scope is derived
     from operator monitoring rows, not request parameters.
   - No `v-html`, no new injection surface, no change to auth, CSRF, or network
     calls. No schema migration.

## Implementation Outcome

Implemented files:

- `src/server/metadata/metadata-monitored-artist-store.js` (new)
- `src/server/metadata/metadata-search-service.js`
- `src/server/metadata/metadata-module.js`
- `src/server/metadata/metadata-repository.js`
- `src/server/artwork/artwork-monitored-artist-prefetch-service.js`
- `test/server/metadata-monitored-artist-store.test.js` (new)
- `test/server/metadata-search-service.test.js`
- `test/server/artwork-monitored-artist-prefetch-service.test.js`

Behavioral outcome:

- The monitored-artist list reads no longer reference
  `metadata_artist_monitoring`.
- The artwork prefetch reads a global, de-duplicated monitored-artist set from
  canonical operator monitoring rows.
- The admin oversight list reads aggregated operator monitoring state and pulls
  `lastRefreshedAt` from `metadata_artist_refresh_state`.
- The dead, un-routed `listMonitoredArtists` service method and the two legacy
  repository functions are removed.
- Latent legacy bug fixed: the prior repository query aliased the operator
  username column as `monitored_by_username` but the row mapper read
  `monitored_username`, so `monitoredByUsername` was always `null` and the admin
  "Monitored by" column always rendered the fallback dash. The new store aligns
  the alias and the mapper, so the representative operator's username now
  renders. The response field name is unchanged.

Note on migration dating: the in-flight `20260630_*` migration filenames are
intentionally retained. Migration names are a sort sequence, not a wall-clock
claim; the last committed migration is `20260629_000001`, so `20260630` is the
correct next slot and preserves ordering for migrations that depend on the
`20260625` operator-monitoring baseline. The host system clock (June 23) lags
the repository's migration timeline and must not be used to renumber them.

Validation performed:

- `node --test test/server/metadata-monitored-artist-store.test.js`
- `node --test test/server/metadata-search-service.test.js`
- `node --test test/server/artwork-monitored-artist-prefetch-service.test.js`
- `npm run lint:server`
- `npm run lint:test`
- `npm run check:esm`
- `npm run build:server`

## Remaining Cleanup

`metadata_artist_monitoring` is still present for compatibility. The remaining
known live readers are inside the legacy monitoring store/service and the
metadata artist payload compatibility read in `metadata-read-service.js`. Each
should be migrated in its own scoped pass.
