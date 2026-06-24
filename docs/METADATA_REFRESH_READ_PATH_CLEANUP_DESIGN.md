# Metadata Refresh Read-Path Cleanup Design

Status: Implemented
Date: 2026-06-14
Owner: Backend architecture + product architecture

## Purpose

This document records the design and implementation outcome for moving metadata refresh scheduling away from the legacy shared `metadata_artist_monitoring` read path.

The product model is now:

- operator monitoring policy lives in `operator_artist_monitoring`
- metadata provider refresh cadence is global per metadata artist
- refresh scheduling should read operator monitoring for eligibility and release-type policy, while storing provider cadence in a dedicated refresh-state table

## Official Source Review

The review used current official sources available in June 2026:

- PostgreSQL `SELECT`: https://www.postgresql.org/docs/current/sql-select.html
- PostgreSQL aggregate functions: https://www.postgresql.org/docs/current/functions-aggregate.html
- PostgreSQL array functions: https://www.postgresql.org/docs/current/functions-array.html
- PostgreSQL `CREATE INDEX`: https://www.postgresql.org/docs/current/sql-createindex.html
- PostgreSQL partial indexes: https://www.postgresql.org/docs/current/indexes-partial.html
- node-postgres parameterized queries: https://node-postgres.com/features/queries
- OWASP SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP Query Parameterization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html
- Express production security best practices: https://expressjs.com/en/advanced/best-practice-security/
- Node.js test runner: https://nodejs.org/api/test.html
- MusicBrainz API: https://musicbrainz.org/doc/MusicBrainz_API
- MusicBrainz API rate limiting: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

Relevant takeaways:

- PostgreSQL CTEs and aggregate functions are appropriate for deriving one global artist-refresh candidate from many operator rows.
- PostgreSQL array functions support `unnest(...)`, which keeps monitored release-group type aggregation in SQL instead of ad hoc string handling.
- PostgreSQL partial indexes are appropriate for the hot subset of `operator_artist_monitoring` where `is_monitored = TRUE`.
- OWASP and node-postgres both favor parameterized SQL over string-built SQL; the refresh-state store keeps `now`, operation type, artist id, and limit parameterized.
- Express security guidance reinforces deriving scope from trusted server state. This cleanup does not accept user-supplied refresh scope.
- MusicBrainz documents application rate limiting and identification expectations. Keeping one refresh schedule per metadata artist avoids duplicate provider calls for multiple users monitoring the same artist.
- Node's native test runner is sufficient for focused store, scheduler, module, and refresh-service contract tests.

## Problem

Before this change, the metadata refresh heartbeat selected due artists from `metadata_artist_monitoring`.

That created three issues:

1. The heartbeat treated a legacy global monitoring table as the source of truth.
2. Operator-only monitored artists could be invisible to scheduled refresh unless another path also updated legacy state.
3. Release detection during refresh could use stale legacy monitoring policy even after newer operator-scoped policy changes.

The refresh cadence itself should remain global. MusicBrainz refresh work is provider-facing and artist-level; multiple users monitoring the same artist should not create duplicate provider polling.

## Options Considered

### Option A: Leave Refresh Scheduling On `metadata_artist_monitoring`

Pros:

- No schema migration.
- No change to backup or route compatibility paths.

Cons:

- Keeps a core background read path on a deprecated global policy table.
- Can miss operator-scoped monitored artists.
- Makes release detection decisions depend on stale or absent legacy monitoring rows.

Decision: rejected.

### Option B: Add Refresh Columns To `operator_artist_monitoring`

Pros:

- All monitoring and refresh-related fields live in one current table.
- No extra join for operator refresh policy.

Cons:

- Refresh cadence is global per artist, not per operator.
- Multiple operators monitoring the same artist would duplicate scheduling timestamps.
- The heartbeat would need arbitration rules across per-user cadence rows.

Decision: rejected.

### Option C: Keep Legacy Table As A Compatibility Projection

Pros:

- Minimal change to existing scheduler code.
- Can bridge old and new monitoring models temporarily.

Cons:

- Continues to hide a legacy read behind a familiar name.
- Still requires dual-write or projection maintenance.
- Makes it harder to tell when the legacy table is truly retired.

Decision: rejected for this pass.

### Option D: Add Dedicated `metadata_artist_refresh_state`

Pros:

- Separates global provider-refresh cadence from operator monitoring policy.
- Lets due-artist eligibility read directly from `operator_artist_monitoring`.
- Backfills existing `last_refreshed_at` and `next_refresh_at` values from legacy rows.
- Keeps the change narrow: scheduler, refresh-state store, refresh-service detection monitoring, migration, schema anchors, and tests.

Cons:

- Introduces a new table and schema snapshot update.
- Backup/restore still treats refresh cadence as operational state rather than a first-class backup section.
- Legacy metadata monitoring reads remain for compatibility routes and broader metadata artist payloads.

Decision: accepted.

## Final Recommendation Stack

1. Schema
   - Add `metadata_artist_refresh_state` keyed by `metadata_artist_id`.
   - Store `last_refreshed_at` and `next_refresh_at` separately from monitoring policy.
   - Backfill refresh timestamps from `metadata_artist_monitoring`.
   - Add `metadata_artist_refresh_state_due_idx` for due-order reads.
   - Add `operator_artist_monitoring_refresh_eligibility_idx` as a partial index for monitored operator rows.

2. Store boundary
   - Add `metadata-artist-refresh-state-store.js`.
   - `listArtistsDueForRefresh()` derives candidate artists from grouped `operator_artist_monitoring` rows.
   - `getArtistRefreshMonitoring()` aggregates monitored release-group types with `ARRAY_AGG(DISTINCT ...)`.
   - Schedule mutations upsert the dedicated refresh-state row.

3. Scheduler boundary
   - `metadata-refresh-scheduler-service.js` depends on the refresh-state store.
   - It keeps a compatibility fallback for injected legacy stores in older tests or callers.
   - Completion scheduling uses operator-derived monitoring state before computing the next interval.

4. Release detection boundary
   - `metadata-refresh-service.js` accepts `getArtistRefreshMonitoring`.
   - Detection decisions prefer operator-derived monitoring over the legacy `artist.monitoring` payload.
   - If the aggregate read fails, detection falls back to the cached payload so refresh does not fail after successful provider work.

5. Security and provider posture
   - All SQL values remain parameterized.
   - Refresh scope is derived from internal operator state, not request parameters.
   - One refresh-state row per artist prevents duplicate provider polling across users.

## Implementation Outcome

Implemented files:

- `src/server/migrations/20260630_010000_metadata_artist_refresh_state.sql`
- `src/server/metadata/metadata-artist-refresh-state-store.js`
- `src/server/metadata/metadata-refresh-scheduler-service.js`
- `src/server/metadata/metadata-refresh-service.js`
- `src/server/metadata/metadata-module.js`
- `src/server/schema-anchor-service.js`
- `src/server/schema-snapshot.sql`
- `test/server/metadata-artist-refresh-state-store.test.js`
- `test/server/metadata-refresh-scheduler-service.test.js`
- `test/server/metadata-refresh-service.test.js`
- `test/server/metadata-module.test.js`

Behavioral outcome:

- The metadata refresh heartbeat no longer reads due artists from `metadata_artist_monitoring`.
- Due refresh candidates are derived from canonical operator monitoring rows.
- Refresh cadence is persisted once per metadata artist in `metadata_artist_refresh_state`.
- Release detection during refresh now prefers operator-derived monitoring policy.
- Schema anchors cover the new refresh-state table and indexes.

Validation performed:

- `node --test test/server/metadata-artist-refresh-state-store.test.js test/server/metadata-refresh-scheduler-service.test.js test/server/metadata-refresh-service.test.js test/server/metadata-module.test.js`
- `npm run migration:check`
- `npm run check:schema-snapshot`

## Remaining Cleanup

`metadata_artist_monitoring` is still present for compatibility. Remaining follow-ups should be separate and scoped:

- metadata artist payload compatibility reads in `metadata-read-service.js`
- metadata search compatibility projections in `metadata-repository.js`
- backup/restore policy for whether refresh cadence should become an explicit operational snapshot or remain rebuildable state
