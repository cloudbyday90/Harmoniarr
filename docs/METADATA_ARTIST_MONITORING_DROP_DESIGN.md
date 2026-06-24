# Metadata Artist Monitoring DROP TABLE Design

Status: Implemented
Date: 2026-06-23
Owner: Backend architecture + recovery

## Purpose

This document records the design and implementation outcome for the final step
of the `metadata_artist_monitoring` retirement: a dedicated schema migration
that drops the now-orphaned legacy table, and the corresponding schema-snapshot
refresh. This completes the retirement arc — after the read, write, and
backup/restore migrations, the table had zero code references and existed only
as dead state.

## Official Source Review

The review used current official sources available in June 2026. URLs were
resolved through web search rather than assumed:

- PostgreSQL `DROP TABLE`: https://www.postgresql.org/docs/current/sql-droptable.html
- `DROP TABLE ... CASCADE` semantics (drops dependent objects such as views and
  FK constraints that reference the table, not the referencing tables
  themselves): https://dba.stackexchange.com/questions/117233/drop-table-cascade-does-not-drop-any-dependent-table
- `DROP TABLE IF EXISTS` as a migration best practice (idempotent, safe across
  environments that differ): https://www.dbvis.com/thetable/sql-drop-table-if-exists-the-database-migration-lifesaver/

Relevant takeaways applied:

- **`DROP TABLE IF EXISTS` is the migration best practice.** It is idempotent —
  re-running (or running in an environment where the table is already absent)
  succeeds rather than aborting the migration. This migration uses it.
- **`CASCADE` is only needed when dependent objects exist.** `DROP TABLE` fails
  if another object (view, foreign key) depends on the table; `CASCADE` drops
  those dependents. A pre-flight dependency audit (below) confirmed
  `metadata_artist_monitoring` has **no** dependents — no foreign keys point to
  it and no views reference it — so a plain `DROP TABLE IF EXISTS` (no CASCADE)
  is correct and avoids silently destroying unintended dependents.
- **Wrap destructive migrations in a transaction** (`BEGIN; ... COMMIT;`) for
  atomicity. The migration follows the repo's forward-only transactional
  template.

## Problem

`metadata_artist_monitoring` is an orphaned legacy table:

- Every product-facing **read** was migrated off it (Release Radar, wanted
  reconciliation, metadata refresh, monitored-artist lists, artist-detail
  payload).
- The only product-facing **write** was consolidated onto the operator-scoped
  save surface (the legacy `PUT /monitoring` route is retired).
- **Backup/restore** no longer exports or restores it; the legacy
  `metadata-monitoring-store.js` and its entire wiring chain are deleted.

The table now has zero code references. It is pure dead state in the database,
confusing future maintainers and resisting the schema-snapshot/anchor
invariants. The remaining step is to drop it.

## Pre-flight dependency audit

Before writing the migration, the schema was audited for dependents:

- **Foreign keys into the table:** a search for `REFERENCES metadata_artist_monitoring`
  across all migrations and the schema snapshot returned **zero** matches. The
  table is a leaf (its own `metadata_artist_id` references `metadata_artists`;
  nothing references it back).
- **Views:** no `CREATE VIEW` references the table in the snapshot or migrations.
- **Code:** the legacy store and all consumers were removed in the prior batch;
  no source imports or queries the table.
- **Migration ordering:** the table is created (baseline) and altered by several
  later migrations; the `metadata_artist_refresh_state` migration
  (`20260630_010000`) backfills `FROM metadata_artist_monitoring`. The DROP
  must therefore sort **after** `20260630_010000`.

Conclusion: a plain `DROP TABLE IF EXISTS metadata_artist_monitoring;` (no
CASCADE) is safe.

## Scope boundaries

- This is a **schema-only** change: one new migration + a regenerated schema
  snapshot. No application code changes.
- There are **no schema anchors** for `metadata_artist_monitoring` in
  `criticalSchemaAnchors` (only canonical tables like
  `operator_artist_monitoring` and `metadata_artist_refresh_state` are anchored),
  so no anchor entries need removal.
- The historical migration files that create/alter the table (baseline,
  refresh-schedule, uuid-policy, monitored-by-user, refresh-state backfill) are
  **left untouched** — they are committed history; modifying them would break
  migration checksums. The snapshot retains those sections (the snapshot is the
  ordered migration lineage) and simply appends the DROP at the end, so the
  final applied state has the table created-then-dropped.
- The migration is forward-only and irreversible (it drops a table). The
  platform's backup/restore and the fact that the table holds no
  product-referenced data make this safe; the table's data was a legacy
  projection of operator-scoped monitoring that is fully captured by
  `operator_artist_monitoring`.

## Options Considered

### Option A: `DROP TABLE metadata_artist_monitoring` (plain, no IF EXISTS)

Pros:

- Minimal.

Cons:

- Not idempotent; fails if the table is already absent (e.g., partial
  re-apply), aborting the migration.

Decision: rejected.

### Option B: `DROP TABLE IF EXISTS metadata_artist_monitoring CASCADE`

Pros:

- Tolerates any undiscovered dependent.

Cons:

- `CASCADE` would silently drop dependents if any existed — a hidden,
  destructive side effect. The dependency audit found none, so CASCADE adds
  risk (masking a future regression) with no benefit.

Decision: rejected.

### Option C: `DROP TABLE IF EXISTS metadata_artist_monitoring` (idempotent, no CASCADE), transactional

Pros:

- Idempotent (best practice for migrations); safe across environments.
- No hidden CASCADE destruction; an unexpected dependent would surface as a
  clear error rather than being silently dropped.
- Matches the repo's forward-only transactional migration template.

Cons:

- None material (the audit confirmed no dependents).

Decision: accepted.

## Final Recommendation Stack

1. Migration — `20260630_020000_metadata_artist_monitoring_drop.sql`
   - Sorts after `20260630_010000_metadata_artist_refresh_state.sql` (which
     backfills from the table), preserving correct ordering.
   - Forward-only, transactional:
     ```sql
     -- forward-only migration
     BEGIN;
     DROP TABLE IF EXISTS metadata_artist_monitoring;
     COMMIT;
     ```
   - Filename timestamp follows the repository's migration timeline (the last
     committed migration is `20260629_000001`; the in-flight operator-monitoring
     lineage is `20260630_*`). It is **not** dated to the host system clock
     (June 23), which would sort it before its dependency.

2. Schema snapshot — regenerate from the migration manifest
   - `schema-snapshot.sql` is rendered from the migration manifest
     (`renderSchemaSnapshot`), so the DROP section is appended in order with the
     correct checksum and `schema_migrations` history record. The historical
     CREATE/ALTER sections remain (they are the migration lineage); the final
     applied state has the table dropped.

3. Schema anchors — no change
   - `metadata_artist_monitoring` has no entries in `criticalSchemaAnchors`, so
     nothing is removed. The dropped table is simply absent from the final
     schema, consistent with the anchors.

4. Security and posture
   - No application code change; no auth/CSRF/network change.
   - The dropped table held a legacy projection of operator-scoped monitoring;
     its data is fully represented by the canonical `operator_artist_monitoring`
     table. No product-referenced data is lost.
   - The migration is transactional and idempotent.

## Implementation Outcome

Implemented files:

- `src/server/migrations/20260630_020000_metadata_artist_monitoring_drop.sql` (new)
- `src/server/schema-snapshot.sql` (regenerated from the manifest)

Behavioral outcome:

- `metadata_artist_monitoring` is dropped from the database schema.
- The schema snapshot reflects the drop as the final state of the migration
  lineage.
- No anchors referenced the table, so the anchor inventory is unchanged.
- This completes the `metadata_artist_monitoring` retirement: the table, its
  store, its service, its route, and all reads/writes/backup-restore are gone.

Validation performed:

- `npm run migration:check` (filename + id policy)
- `npm run check:schema-snapshot` (snapshot matches the migration manifest)
- `npm run lint:server`
- `npm run check:esm`
- `npm run build:server`
- `git diff --check`
- DB-backed checks (`npm run validate:schema-bootstrap`,
  `npm run check:schema-anchors`) require a live PostgreSQL and run in CI;
  the pure checks above cover the migration/snapshot integrity locally.

## Retirement arc — complete

This is the final batch. Across the arc, `metadata_artist_monitoring` was
retired in bounded passes: Release Radar read, wanted reconciliation read,
metadata refresh scheduling read, monitored-artist list reads, artist-detail
payload read, the legacy write path, backup/restore, and finally this table
drop. The operator-scoped model (`operator_artist_monitoring` +
`metadata_artist_refresh_state`) is now the sole monitoring source of truth,
end to end.
