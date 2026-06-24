# Per-Operator Wanted State Design

Status: Implemented
Date: 2026-06-14
Owner: Backend architecture + product architecture

## Purpose

This document records the schema-level follow-up that moves `library_wanted_releases` from a global release projection to a per-operator wanted-state projection.

The product model is:

- monitored artist policy belongs to an operator/user profile
- wanted or desired release state is derived from that profile
- acquisition and discovery dispatch may still deduplicate by release so one search/download can serve multiple users

## Official Source Review

The review used current official sources available in June 2026:

- PostgreSQL `ALTER TABLE`: https://www.postgresql.org/docs/current/ddl-alter.html
- PostgreSQL constraints and foreign keys: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL `INSERT ... ON CONFLICT`: https://www.postgresql.org/docs/current/sql-insert.html
- PostgreSQL `CREATE INDEX`: https://www.postgresql.org/docs/current/sql-createindex.html
- PostgreSQL row security policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- node-postgres parameterized queries: https://node-postgres.com/features/queries
- OWASP SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP Query Parameterization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html
- Express production security best practices: https://expressjs.com/en/advanced/best-practice-security/

Relevant takeaways:

- PostgreSQL supports adding columns, constraints, and foreign keys through explicit `ALTER TABLE` migrations.
- Foreign keys improve database quality by tying references to valid parent rows.
- `INSERT ... ON CONFLICT` is the supported PostgreSQL upsert path when unique constraints define the conflict target.
- Concurrent index builds reduce write blocking, but this repository's migration runner wraps each migration in a transaction, so regular indexed DDL is the correct local pattern here.
- PostgreSQL row-level security can provide database-enforced isolation, but this application already uses one server database role and route/service authorization. Adding RLS here would not replace service-level scoping and would require a broader connection-role strategy.
- OWASP, node-postgres, and Express all point toward parameterized SQL and explicit input handling for user-supplied values.

## Problem

Before this change, `library_wanted_releases` had one row per `metadata_release_id` and no `app_user_id`. The prior cleanup moved reconciliation off `metadata_artist_monitoring`, but the table remained a global compatibility projection.

That caused four concrete issues:

1. Wanted summary counts were user-authenticated but still shared.
2. `GET /api/v1/library/wanted-releases` could not return the current user's desired state.
3. `wanted_automation_mode` and release-scope policy could not be applied per operator.
4. Backup exports could not identify which operator profile produced a wanted row.

## Options Considered

### Option A: Keep Global Wanted Rows And Filter Only At Read Time

Pros:

- No migration.
- Low short-term risk.

Cons:

- Cannot represent two users wanting different release sets.
- Keeps the route authenticated but not truly scoped.
- Does not use the operator policy columns already present in `operator_artist_monitoring`.

Decision: rejected.

### Option B: Add `app_user_id` To `library_wanted_releases`

Pros:

- Directly models wanted state as derived operator/user intent.
- Lets route reads and summary reads scope by authenticated session.
- Preserves the existing table, API shape, backup scope, and discovery dispatch model with minimal churn.
- Allows discovery dispatch to stay release-global while carrying a representative user id for preference lookup.

Cons:

- Requires data backfill and unique-constraint replacement.
- Existing backup payloads without `appUserId` cannot restore wanted rows directly; wanted is a projection and can be rebuilt from monitoring state.
- Discovery requests remain release-global, so multiple users wanting the same release still collapse into one dispatch row.

Decision: accepted.

### Option C: Create A New `operator_wanted_releases` Table

Pros:

- Clean table name for the new model.
- Allows a long compatibility period for old global reads.

Cons:

- Requires dual reads/writes or a view during migration.
- Increases backup/restore and discovery complexity.
- Leaves old table semantics alive longer than necessary.

Decision: rejected for this pass.

### Option D: Also Scope `library_discovery_requests` By `app_user_id`

Pros:

- Fully separates search lifecycle per user.
- Simplifies exact provenance from wanted state to discovery state.

Cons:

- Breaks the current cross-user deduplication strategy.
- Causes duplicate Soulseek searches for the same release when several users want it.
- Requires larger dispatch, recovery, retry, and download-candidate ownership changes.

Decision: deferred. Discovery stays release-global for now.

## Final Recommendation Stack

1. Schema
   - Add `library_wanted_releases.app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE`.
   - Replace the old unique release constraint with `UNIQUE (app_user_id, metadata_release_id)`.
   - Add user-scoped indexes for status and artist lookups.
   - Backfill existing rows by duplicating each global wanted row for every monitored operator row on the same artist.

2. Reconciliation
   - Generate wanted rows directly from `operator_artist_monitoring`.
   - Include `appUserId` in the mapped wanted row.
   - Exclude `wanted_automation_mode = 'manual_only'` and `release_scope = 'track_only'`.
   - Treat `release_scope = 'future_only'` and `wanted_automation_mode = 'future_matching'` as release-date gated by the operator monitoring row's `created_at` date.
   - `release_scope = 'current_and_future'` plus `wanted_automation_mode = 'current_and_future_matching'` keeps existing current-catalog behavior.

3. Authenticated read path
   - `GET /api/v1/library/wanted-summary` passes `session.appUserId`.
   - `GET /api/v1/library/wanted-releases` passes `session.appUserId`.
   - Service methods reject missing or blank `appUserId`.
   - Store reads filter on `lwr.app_user_id = $1`.

4. Discovery compatibility
   - `library_discovery_requests` remains release-global.
   - Discovery reconciliation deduplicates per-operator wanted rows by `metadata_release_id`.
   - The selected wanted source carries `source_requested_for_user_id` from `library_wanted_releases.app_user_id` so downstream preference lookup still has user context.

5. Backup/restore
   - Backup exports include `appUserId` on wanted rows.
   - Restore accepts wanted rows with `appUserId`.
   - Old backup wanted rows without `appUserId` are intentionally skipped; wanted state can be rebuilt from monitoring policy.

## Security Notes

- Route scope comes from the authenticated session, not query parameters.
- SQL that uses `appUserId`, status, and limit values remains parameterized.
- The schema-level foreign key deletes wanted rows when a user is deleted.
- The unique constraint prevents cross-user row collisions while keeping duplicate rows for different users valid.
- RLS was reviewed but not selected because this codebase does not yet use per-request database roles; service-level authorization remains the enforceable boundary.

## Implementation Outcome

Implemented files:

- `src/server/migrations/20260630_000000_per_operator_wanted_state.sql`
- `src/server/library/library-wanted-release-service.js`
- `src/server/library/library-wanted-release-store.js`
- `src/server/library/library-wanted-summary-service.js`
- `src/server/library/library-wanted-summary-store.js`
- `src/server/library/library-discovery-request-service.js`
- `src/server/routes/library-routes.js`
- `src/server/schema-anchor-service.js`
- `src/server/recovery/backup-restore-scope-apply-service.js`
- `src/server/recovery/backup-restore-apply-service.js`
- wanted-state server tests and route tests

Behavioral outcome:

- Wanted reconciliation now writes one wanted row per app user and release.
- Wanted summary and wanted release reads are scoped to the authenticated app user.
- Wanted reconciliation follows operator `release_scope` and `wanted_automation_mode` gates.
- Discovery request reconciliation remains release-global, deduplicates operator wanted rows by release, and carries the selected operator source user in evidence.
- Backup exports preserve wanted row ownership through `appUserId`.
- Restore apply forwards operator monitoring, release selection, track override, and wanted-state snapshot dependencies.
