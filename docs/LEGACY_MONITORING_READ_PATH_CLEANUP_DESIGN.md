# Legacy Monitoring Read-Path Cleanup Design

Status: Implemented Release Radar and wanted compatibility migrations
Date: 2026-06-13
Owner: Backend architecture + product architecture

## Purpose

This document records the design and implementation outcomes for moving legacy monitoring read paths away from `metadata_artist_monitoring`.

The accepted product model is operator-scoped monitoring. `operator_artist_monitoring` is the canonical policy table for current monitored artists, release scope, wanted automation, acquisition profile, and future reconciliation behavior. `metadata_artist_monitoring` remains a legacy compatibility table for older metadata refresh paths, but new product-facing reads should not treat it as the source of truth.

## Official Source Review

The review used current official sources available on 2026-06-13:

- PostgreSQL `CREATE VIEW`: https://www.postgresql.org/docs/current/sql-createview.html
- PostgreSQL partial indexes: https://www.postgresql.org/docs/current/indexes-partial.html
- PostgreSQL `LIMIT` / `OFFSET`: https://www.postgresql.org/docs/current/queries-limit.html
- OWASP SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- node-postgres queries and parameterized queries: https://node-postgres.com/features/queries
- Express production security best practices: https://expressjs.com/en/advanced/best-practice-security/
- Node.js test runner: https://nodejs.org/api/test.html

Relevant takeaways:

- PostgreSQL views are not physically materialized; the query runs when the view is referenced. That makes a view useful as a compatibility facade, but unnecessary when only one caller needs direct migration.
- PostgreSQL partial indexes are appropriate when only a subset of rows is queried frequently. The existing `operator_artist_monitoring_user_monitored_idx` already supports the current-user monitored-artist filter.
- PostgreSQL warns that limited queries need deterministic ordering. Release Radar keeps explicit date ordering before applying its limit.
- OWASP and node-postgres both favor parameterized queries over string-built SQL. The migrated query keeps the user id, date bounds, and limit as query parameters.
- Express security guidance says not to trust user input. The route continues to sanitize query params and now derives the operator scope only from the authenticated session.
- Node's native test runner is enough for focused service, route, and SQL-store contract tests.

## Problem

Release Radar still read from `metadata_artist_monitoring`, which created three problems:

1. It ignored the authenticated user's operator-scoped monitored profile.
2. It kept a product-facing read coupled to a legacy global table.
3. It left the route authenticated but effectively unscoped.

That contradicted the Discover recommendation model, where monitored artists are canonical and operator-scoped.

Wanted release reconciliation also still read from `metadata_artist_monitoring`, but it has a different constraint: `library_wanted_releases` is currently a global projection table without `app_user_id`. That makes a direct current-user rewrite unsafe without a schema migration and downstream route, backup, and discovery-request changes.

## Options Considered

### Option A: Leave Release Radar On The Legacy Table

Pros:

- No code churn.
- No short-term route behavior risk.

Cons:

- Keeps a user-visible read path on the wrong source of truth.
- Allows authenticated users to see radar results from globally monitored artists rather than their own monitored profile.
- Leaves the cleanup item open with no measurable progress.

Decision: rejected.

### Option B: Add A Compatibility View Over Operator Monitoring

Pros:

- Gives old SQL a stable name to read.
- Could help if many legacy read paths require the same derived global shape.

Cons:

- A view would still need careful security semantics and explicit scope handling.
- It could hide call sites that should migrate to current-user reads.
- It is unnecessary for a single Release Radar query.

Decision: deferred. Use only if several remaining read paths need the same transitional projection.

### Option C: Migrate Release Radar Directly To Operator Monitoring

Pros:

- Moves a high-value authenticated user-facing read to the canonical table.
- Keeps route, service, and store boundaries simple.
- Requires no schema migration because the needed index already exists.
- Makes the user scope explicit and testable.

Cons:

- Other legacy paths still need follow-up.
- The endpoint now requires an `appUserId` in its service contract, so tests and callers must be updated.

Decision: accepted.

### Option D: Rewrite All Legacy Monitoring Reads In One Pass

Pros:

- Could remove the legacy table faster.
- Avoids repeated audits.

Cons:

- Higher regression risk across metadata refresh, wanted reconciliation, and library workflows.
- Some legacy paths may still need shared/global refresh semantics until their owner modules are redesigned.
- Too large for a safe first cleanup.

Decision: rejected for this pass.

### Option E: Move Wanted Reconciliation To A Global Operator Compatibility Projection

Pros:

- Removes the legacy monitoring table from wanted reconciliation without changing the global wanted table contract.
- Lets background workers keep reconciling wanted releases without inventing a synthetic user id.
- Unions monitored release-group types across all operator monitoring rows for the same artist, preserving the current shared-library projection until wanted state becomes operator-scoped.
- Keeps the change small enough to validate at service and store boundaries.

Cons:

- Wanted releases remain global, not per-operator.
- `wanted_automation_mode`, `release_scope`, and future per-operator desired-state rules still need a dedicated schema-backed migration.
- If one operator monitors an artist, that artist can still contribute to the shared wanted projection until the global table is retired or scoped.

Decision: accepted as the second migration. Full per-operator wanted state remains the next schema-level cleanup.

### Option F: Add `app_user_id` To `library_wanted_releases` Immediately

Pros:

- Provides the cleanest long-term user-scope model.
- Allows wanted summary and wanted release reads to return only the authenticated operator's desired state.
- Unlocks stricter use of `wanted_automation_mode` and release-scope policy in reconciliation.

Cons:

- Requires a migration, backfill semantics, backup/restore updates, discovery request ownership decisions, route contract changes, and broader client validation.
- Changes global dashboard numbers and could break existing background worker assumptions.
- Too large for a read-path cleanup whose immediate goal is removing the legacy monitoring source.

Decision: deferred.

## Final Recommendation Stack

The first migration uses this stack:

1. Route scope
   - `GET /api/v1/library/release-radar` keeps requiring a session.
   - The route passes `session.appUserId` into the service.
   - Query parameters remain sanitized before they reach the service.

2. Service contract
   - `buildReleaseRadar({ appUserId, recentDays, upcomingDays, limit })`
   - The service rejects missing or blank `appUserId`.
   - Window and limit normalization remain in the service.

3. Store query
   - `library-release-radar-store.js` joins `operator_artist_monitoring`.
   - The query filters on `oam.app_user_id = $1` and `oam.is_monitored = TRUE`.
   - Date bounds and limit remain parameterized.

4. Compatibility posture
   - No view or materialized view is added yet.
   - `metadata_artist_monitoring` stays available for legacy metadata refresh paths.
   - Future migrations should move one bounded caller at a time unless a shared compatibility projection becomes clearly necessary.

The wanted reconciliation migration uses this stack:

1. Shared SQL projection
   - `operator-monitored-artist-scope-sql.js` exports a constant CTE, keeping SQL reuse explicit and ESM-only.
   - The CTE reads `operator_artist_monitoring`, filters `is_monitored = TRUE`, groups by `metadata_artist_id`, and unions monitored release-group types with `ARRAY_AGG(DISTINCT ...)`.

2. Reconciliation service
   - `library-wanted-release-service.js` reads from `operator_monitored_artist_scope` instead of `metadata_artist_monitoring`.
   - Existing release, track-count, reconciliation-status, and deterministic ordering behavior stays intact.
   - The service still writes to the existing global `library_wanted_releases` table.

3. Summary store
   - `library-wanted-summary-store.js` counts monitored artists from the same operator compatibility scope.
   - Release counts continue to come from `library_wanted_releases`.

4. Deferred schema posture
   - No migration is introduced in this pass.
   - Per-operator wanted releases should be handled as a separate schema-backed project, not hidden inside a read-path cleanup.

## Security Notes

- The route derives scope from the authenticated session, not from query parameters.
- The store uses parameterized SQL for user id, date range, and limit.
- Missing `appUserId` fails closed at the service boundary.
- The response shape is unchanged, so no new client parsing or rendering path is introduced.
- Wanted reconciliation does not accept user input in the migrated source query.
- The shared CTE is a static internal SQL constant, not dynamically assembled from request data.
- The compatibility projection avoids a PostgreSQL view for now so privileges, ownership, and security-invoker semantics do not become a hidden dependency.

## Implementation Outcome

Implemented files:

- `src/server/routes/library-routes.js`
- `src/server/library/library-release-radar-service.js`
- `src/server/library/library-release-radar-store.js`
- `test/server/library-routes.test.js`
- `test/server/library-release-radar-service.test.js`
- `test/server/library-release-radar-store.test.js`

Behavioral outcome:

- Release Radar is now scoped to the current authenticated user's monitored artists.
- The Release Radar SQL no longer references `metadata_artist_monitoring`.
- The service cannot be called without an explicit app user id.

Validation performed:

- `node --test test/server/library-release-radar-service.test.js test/server/library-release-radar-store.test.js test/server/library-routes.test.js`
- `npm run lint:server`
- `npm run lint:test`
- `npm run check:esm`
- `npm run build:server`
- `git diff --check`

## Implementation Outcome: Wanted Reconciliation Compatibility Projection

Implemented files:

- `src/server/library/operator-monitored-artist-scope-sql.js`
- `src/server/library/library-wanted-release-service.js`
- `src/server/library/library-wanted-summary-store.js`
- `test/server/library-wanted-release-service.test.js`
- `test/server/library-wanted-summary-store.test.js`

Behavioral outcome:

- Wanted release reconciliation no longer reads from `metadata_artist_monitoring`.
- The wanted summary monitored-artist count no longer reads from `metadata_artist_monitoring`.
- Both paths derive a global compatibility scope from canonical operator monitoring rows.
- `library_wanted_releases` remains global until a dedicated per-operator wanted-state migration is designed and validated.

Validation performed:

- `node --test test/server/library-wanted-release-service.test.js test/server/library-wanted-summary-store.test.js test/server/library-wanted-summary-service.test.js test/server/library-wanted-release-store.test.js`
- `node --test test/server/library-wanted-release-service.test.js test/server/library-wanted-summary-store.test.js test/server/library-wanted-summary-service.test.js test/server/library-wanted-release-store.test.js test/server/library-routes.test.js`
- `npm run lint:server`
- `npm run lint:test`
- `npm run check:esm`
- `npm run build:server`
- `git diff --check`

## Remaining Cleanup

Continue auditing legacy reads in smaller passes. Likely follow-up areas:

- metadata refresh scheduling and refresh heartbeat paths
- wanted release reconciliation paths
- metadata search or compatibility projections that still expose global monitoring state

Each follow-up should decide whether the caller truly needs current-user operator scope or a temporary global compatibility projection.
