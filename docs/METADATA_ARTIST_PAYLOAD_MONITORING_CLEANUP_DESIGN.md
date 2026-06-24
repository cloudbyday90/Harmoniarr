# Metadata Artist-Payload Monitoring Read-Path Cleanup Design

Status: Implemented
Date: 2026-06-23
Owner: Backend architecture + product architecture

## Purpose

This document records the design and implementation outcome for moving the
artist-detail payload's `monitoring` field off the legacy
`metadata_artist_monitoring` table and onto the canonical operator-scoped
monitoring model.

This is the next bounded step in the rolling retirement of
`metadata_artist_monitoring`, following the Release Radar, wanted, metadata
refresh, and monitored-artist list migrations. It removes the last
user-facing **read** of the legacy table from the metadata read service.

## Official Source Review

The review used current official sources available in June 2026. URLs were
resolved through web search rather than assumed:

- PostgreSQL aggregate functions: https://www.postgresql.org/docs/current/functions-aggregate.html
- PostgreSQL array functions (`unnest`): https://www.postgresql.org/docs/current/functions-array.html
- PostgreSQL table expressions (`LATERAL`, scalar subqueries): https://www.postgresql.org/docs/current/queries-table-expressions.html
- PostgreSQL `EXISTS`: https://www.postgresql.org/docs/current/functions-subquery.html
- OWASP SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP Query Parameterization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html
- node-postgres parameterized queries: https://node-postgres.com/features/queries
- Express production security best practices: https://expressjs.com/en/advanced/best-practice-security/

Verified community reference for combining aggregation with optional related
rows (a `LEFT JOIN` over an aggregated subquery, or scalar subqueries in the
`SELECT` list, both avoid row multiplication and guarantee a single result
row): https://stackoverflow.com/questions/2577174/join-vs-sub-query

Relevant takeaways applied:

- PostgreSQL scalar subqueries in the `SELECT` list (with no `FROM`) always
  yield exactly one row, even when the underlying tables have no matching row.
  Each scalar subquery returns `NULL` when no row matches. This is the cleanest
  way to assemble a single-artist status that must not fail when refresh state
  is absent.
- `EXISTS (...)` is the idiomatic way to project a boolean "is any operator
  monitoring this artist" without row multiplication.
- `ARRAY_AGG(DISTINCT ... ORDER BY ...)` over a `CROSS JOIN LATERAL unnest(...)`
  remains the supported way to de-duplicate and order a unioned release-type
  array across multiple operator rows.
- OWASP states that values must be bound parameters; the only value in this
  read (the metadata artist id) is a bind parameter. There are no
  user-supplied identifiers or sort directions, so no allow-list is required.
- Express production guidance reinforces deriving scope from trusted server
  state; the artist id reaches the store from the route's resolved metadata
  artist, not from a raw request parameter.

## Problem

`metadata-read-service.js` assembled the artist-detail payload's `monitoring`
field from `metadataMonitoringStore.getArtistMonitoring(artist.id)`, which read
directly from `metadata_artist_monitoring`. That caused two concrete issues:

1. The artist-detail payload reported the **legacy global** monitoring state.
   An operator who monitors an artist via the canonical operator-scoped surface
   (`operator_artist_monitoring`) gets no legacy row, so the payload's
   `isMonitored` read `false` and `monitoredReleaseGroupTypes` fell back to
   `['album', 'ep']`, even though the artist is monitored and the operator may
   have chosen other release types. The artist page therefore showed stale /
   wrong monitoring state on a primary surface.
2. `lastRefreshedAt` and `nextRefreshAt` had already been relocated to
   `metadata_artist_refresh_state` by the metadata-refresh cleanup, so reading
   them from the legacy table read a stale copy that was no longer the canonical
   writer.

## Scope boundaries

- The artist-detail payload route `GET /api/v1/metadata/artists/:artistId` is
  session-protected but not per-operator, and its `monitoring` field is a
  global artist monitoring status (is this artist monitored, with which release
  types, and what is its refresh cadence). This cleanup preserves that
  **global status** semantic and the exact response shape; it does not
  introduce per-operator scoping on this route (the dedicated operator
  projection endpoint already serves per-operator policy).
- The legacy `metadata-monitoring-store.js` and its `getArtistMonitoring` /
  `upsertArtistMonitoring` are **retained**: the legacy mutation path
  (`PUT /api/v1/metadata/artists/:id/monitoring`, used by the library browser)
  and the backup/restore snapshot still depend on them. Consolidating that
  write path is a separate, scoped follow-on (see Remaining Cleanup).
- No schema migration is required. All referenced tables, columns, and indexes
  already exist.
- No client contract change: the `monitoring` field keeps its shape
  (`isMonitored`, `monitoredReleaseGroupTypes`, `lastRefreshedAt`,
  `nextRefreshAt`).

## Consumer analysis

The payload `monitoring` field is consumed by:

- The **library browser** (`MetadataArtistSummary.vue`): renders `isMonitored`,
  `monitoredReleaseGroupTypes`, `lastRefreshedAt`, and `nextRefreshAt`, and
  drives the legacy "Monitor artist / Unmonitor artist" toggle.
- The **artist detail composable** (`useArtistDetail.js`): kept as a fallback.
  The modern artist detail page already prefers the operator projection
  (`operator.monitoring.isMonitored`); its base-payload fallback even
  references a non-existent `monitored` field, so it is effectively inert.
  This cleanup makes the fallback correct (canonical source) without changing
  client code.

Because the library browser's toggle updates its displayed state from the
**write response** (not a re-read), migrating only the read keeps that surface
internally consistent within a session. The cross-table dual-write divergence
(that surface's write still targets the legacy table) is the explicit
write-path follow-on and is documented below.

## Options Considered

### Option A: Read Per-Operator Monitoring For The Current User

Pros:

- Most precise: the payload reports "am *I* monitoring this artist".

Cons:

- Changes the route contract: the base artist-detail route would need
  `session.appUserId` threaded into the read service.
- Breaks the library browser's "last refresh / next refresh" display, which is
  a global per-artist cadence, not per-operator.
- The base route is a general metadata lookup; making it operator-scoped is a
  larger semantic change than this read-path cleanup warrants.

Decision: rejected for this pass.

### Option B: Keep The Legacy Read And Only Retire It Later With The Write Path

Pros:

- No read/write divergence for the library browser toggle.

Cons:

- Leaves a known stale-data hazard on the artist-detail payload (wrong
  `isMonitored` / release types / cadence for operator-monitored artists).
- Delays the retirement of the last user-facing legacy read for a larger,
  unrelated write-path batch.

Decision: rejected.

### Option C: Aggregated-Global Status From Canonical Tables, Preserving Shape

Pros:

- Stops reading the legacy table on the primary artist-detail surface.
- Preserves the exact response shape, so no client change is required.
- Reports correct canonical monitoring state: `isMonitored` from
  `operator_artist_monitoring`, cadence from `metadata_artist_refresh_state`,
  and release types unioned across monitoring operators.
- Bounded to one new store method + a read-service rewiring; proven pattern
  from the monitored-artist list and refresh-state cleanups.

Cons:

- The library browser's legacy toggle writes the legacy table while the read
  now comes from canonical tables, so a legacy-monitor action would not persist
  across a reload until the write path is also consolidated. This is a known,
  documented follow-on, not a regression on the primary (operator-scoped)
  monitoring surface.

Decision: accepted.

## Final Recommendation Stack

1. New store method — `getArtistMonitoringStatus(metadataArtistId)`
   - Added to the existing modular `metadata-monitored-artist-store.js`
     (factory `createMetadataMonitoredArtistStore`), completing its set of
     monitored-artist reads (list-for-artwork, admin-list, single-artist
     status).
   - One query, single round-trip: scalar subqueries in the `SELECT` list with
     no `FROM`, so it always returns exactly one row.
     - `isMonitored` via `EXISTS (... operator_artist_monitoring ... is_monitored = TRUE)`.
     - `monitoredReleaseGroupTypes` via
       `ARRAY_AGG(DISTINCT ... ORDER BY ...)` over
       `CROSS JOIN LATERAL unnest(monitored_release_group_types)`, filtered to
       monitoring operators.
     - `lastRefreshedAt` / `nextRefreshAt` via scalar subqueries on
       `metadata_artist_refresh_state`.
   - Returns the exact legacy shape
     `{ isMonitored, monitoredReleaseGroupTypes, lastRefreshedAt, nextRefreshAt }`,
     defaulting the release-type array to `['album', 'ep']` when null/empty.

2. Read-service rewiring
   - `metadata-read-service.js` depends on `metadataMonitoredArtistStore`
     instead of the legacy `metadataMonitoringStore`, and `buildArtistPayload`
     calls `getArtistMonitoringStatus(artist.id)`.
   - The `createMetadataMonitoringStore` import is removed from the read
     service.

3. Module wiring
   - `metadata-module.js` resolves a shared `metadataMonitoredArtistStore` and
     injects it into the read service. The legacy `metadataMonitoringStore`
     is still created and exported (the legacy mutation path and backup/restore
     still need it).

4. Security and posture
   - The only value in the new query (the metadata artist id) is a bind
     parameter; there are no user-supplied identifiers or sort directions.
   - The artist id reaches the store from the route-resolved metadata artist,
     not from a raw request parameter.
   - No `v-html`, no new injection surface, no auth/CSRF/network change, no
     schema migration. The response shape is unchanged.

## Implementation Outcome

Implemented files:

- `src/server/metadata/metadata-monitored-artist-store.js` (new method)
- `src/server/metadata/metadata-read-service.js`
- `src/server/metadata/metadata-module.js`
- `test/server/metadata-monitored-artist-store.test.js` (new coverage)

Behavioral outcome:

- The artist-detail payload `monitoring` field no longer references
  `metadata_artist_monitoring`.
- `isMonitored` and `monitoredReleaseGroupTypes` now reflect canonical
  operator-scoped monitoring (aggregated across operators).
- `lastRefreshedAt` and `nextRefreshAt` now come from the canonical
  `metadata_artist_refresh_state`.
- The response shape is unchanged; the library browser and artist-detail
  composable continue to work without client changes.
- The legacy `metadataMonitoringStore` remains for the legacy mutation path and
  backup/restore.

Validation performed:

- `node --test test/server/metadata-monitored-artist-store.test.js`
- `node --test test/server/metadata-module.test.js`
- `npm run lint:server`
- `npm run lint:test`
- `npm run check:esm`
- `npm run build:server`
- `git diff --check`

## Remaining Cleanup

`metadata_artist_monitoring` is still present for compatibility. With this
read migrated, the remaining live legacy surface is the **write path** plus
backup/restore:

- Consolidate / retire the legacy monitoring mutation path
  (`metadata-monitoring-service.updateArtistMonitoring`,
  `PUT /api/v1/metadata/artists/:id/monitoring`, and the library browser
  toggle) onto the operator-scoped save surface, so the dual-write divergence
  is removed.
- Decide backup/restore policy for refresh cadence (export explicitly vs.
  rebuildable operational state) and the legacy monitoring snapshot.
- The refresh-scheduler legacy store fallback shim
  (`metadata-refresh-scheduler-service.js`) is likely now dead and can be
  removed in a focused pass.

Each should be migrated in its own scoped batch.
