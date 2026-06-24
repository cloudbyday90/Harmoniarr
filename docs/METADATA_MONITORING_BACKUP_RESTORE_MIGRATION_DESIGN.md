# Metadata Monitoring Backup/Restore Migration Design

Status: Implemented
Date: 2026-06-23
Owner: Backend architecture + recovery

## Purpose

This document records the design and implementation outcome for migrating
backup/restore off the legacy `metadata_artist_monitoring` table. This is the
final live consumer of the legacy table; after it, the only remaining artifact
is the table itself (dropped in a future schema migration) plus narrow dead
code. It also records the decision to treat provider refresh cadence
(`metadata_artist_refresh_state`) as rebuildable operational state.

## Official Source Review

The review used current official sources available in June 2026. URLs were
resolved through web search rather than assumed:

- Enterprise backup strategy / rebuildable vs. exported state, restore testing,
  and backward-compatible format evolution (Bacula Systems enterprise backup
  guide): https://www.baculasystems.com/blog/enterprise-backup-strategy/
- PostgreSQL `INSERT ... ON CONFLICT`, `DELETE`, and parameterized queries:
  https://www.postgresql.org/docs/current/sql-insert.html
- OWASP SQL Injection Prevention Cheat Sheet (parameterized values for restore
  payloads): https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html

Relevant takeaways applied:

- **Separate source-of-truth from rebuildable operational state in backups.**
  Source-of-truth data (operator monitoring policy) must be exported and
  restored; derived/operational state (refresh schedules, due-timestamps) that
  can be recomputed should not bloat the backup and should be rebuilt after
  restore.
- **Backward-compatible backup format evolution.** New backups may omit retired
  fields; restore must tolerate both their absence (new backups) and their
  presence (old backups) without failing. Retired fields in old backups are
  ignored.
- **Parameterized restore writes.** Restored rows are written with parameterized
  SQL; the existing operator-monitoring snapshot stores already follow this.

## Problem

The backup export assembled a `monitoring.artistMonitoring` snapshot from
`metadata_artist_monitoring` (the legacy table) and the restore path wrote it
back via `replaceMetadataArtistMonitoring`. That caused three issues:

1. **Redundant snapshot.** The canonical operator-scoped tables
   (`operatorArtistMonitoring`, `operatorReleaseGroupSelections`,
   `operatorTrackOverrides`) are **already** exported and restored. The legacy
   `artistMonitoring` snapshot duplicates monitoring state in a deprecated
   global shape that no product-facing code reads or writes anymore.
2. **Last live legacy surface.** Backup/restore was the only remaining reader/
   writer of `metadata_artist_monitoring`, blocking retirement of the table and
   its store.
3. **Refresh cadence was undecided.** `metadata_artist_refresh_state`
   (`last_refreshed_at`, `next_refresh_at`) was not exported, but the policy
   was never recorded.

## Scope boundaries

- The canonical operator-scoped monitoring snapshot is **unchanged** — it
  remains the source of truth in both export and restore.
- `metadata_artist_refresh_state` is treated as **rebuildable operational
  state**: not exported, not restored. After restore, the metadata refresh
  heartbeat recomputes `next_refresh_at` for monitored artists from
  `operator_artist_monitoring`; `last_refreshed_at` resets, which only causes
  the next refresh to run sooner (no correctness impact).
- Backup format is forward/backward compatible: new backups omit
  `monitoring.artistMonitoring`; old backups that include it still restore
  correctly (the field is ignored; canonical operator state is what is applied).
- This change does **not** drop the `metadata_artist_monitoring` table (a
  future schema migration does). It removes the legacy **store** and all of its
  consumers, leaving the table as an orphaned, code-free artifact until the
  DROP migration.

## Options Considered

### Option A: Keep Exporting The Legacy Snapshot Alongside The Canonical One

Pros:

- No backup-format change; maximal backward compatibility.

Cons:

- Continues to back up redundant, deprecated data.
- Keeps the legacy store alive (the last live consumer).
- Restoring the legacy snapshot writes a table nothing reads — pure waste plus
  a lingering legacy code path in the critical recovery flow.

Decision: rejected.

### Option B: Drop The Legacy Snapshot From Export/Restore; Keep The Store

Pros:

- Smallest diff to the recovery flow.

Cons:

- Leaves the legacy store + its wiring chain fully dead (zero consumers) — dead
  code in the module graph, exactly the state the prior batches documented as
  the thing to remove.

Decision: rejected.

### Option C: Drop The Legacy Snapshot From Export/Restore And Remove The Now-Dead Store Chain

Pros:

- Backup/restore carries only canonical, source-of-truth monitoring state.
- Removes the legacy `metadata-monitoring-store.js` and its entire wiring chain
  (metadata-module, system-module, app.js, and the refresh-scheduler legacy
  fallback shim) — no dead code remains.
- Forward/backward compatible (retired field ignored on restore of old backups).
- Leaves the table itself as the only remaining artifact, isolated for a future
  DROP migration.

Cons:

- Larger diff across the recovery + metadata module wiring.
- Touches critical recovery code (backup/restore), requiring careful test
  coverage.

Decision: accepted.

## Final Recommendation Stack

1. Backup export — drop the legacy snapshot
   - `buildScopeSettings` no longer emits `monitoring.artistMonitoring`; the
     `monitoring` scope keeps only canonical state (`operatorArtistMonitoring`,
     `operatorReleaseGroupSelections`, `operatorTrackOverrides`).
   - `createBackupExportService` drops the `listArtistMonitoringForBackup`
     dependency and the corresponding `Promise.all` entry.

2. Restore apply — drop the legacy snapshot
   - The `monitoring` scope restore removes `normalizeMonitoringRows` and the
     `replaceMetadataArtistMonitoring` call; it restores only canonical state.
   - The scope-skip gate and `monitoringUpdated` flag consider only the
     canonical arrays.
   - `createBackupRestoreApplyService` / scope-apply drop the
     `replaceMetadataArtistMonitoring` dependency.

3. Refresh cadence — rebuildable operational state (policy)
   - `metadata_artist_refresh_state` is intentionally not exported or restored.
     The heartbeat rebuilds schedules for monitored artists after restore. This
     is recorded here as the accepted policy.

4. Legacy store + wiring removal
   - Delete `metadata-monitoring-store.js` (and its test).
   - `metadata-module.js`: remove the `createMetadataMonitoringStore` import,
     the `metadataMonitoringStore` parameter, the resolved-store creation, and
     the export.
   - `system-module.js`: remove the `metadataMonitoringStore` parameter and the
     two legacy backup/restore dependency lines.
   - `app.js`: stop passing `metadataMonitoringStore` into the system module.
   - `metadata-refresh-scheduler-service.js`: remove the legacy
     `metadataMonitoringStore` fallback shim (the scheduler requires the
     canonical refresh-state store, which is always injected in production).

5. Security and posture
   - Restore remains a maintenance-locked, admin-only, CSRF-protected operation;
     no auth or lock posture changes.
   - No new injection surface: restore writes are unchanged for the canonical
     stores (already parameterized); the legacy write path is removed, not
     added.
   - No schema migration in this batch; the `metadata_artist_monitoring` table
     is left in place as an orphaned artifact for a future DROP migration.

## Implementation Outcome

Implemented files:

- `src/server/recovery/backup-export-service.js`
- `src/server/recovery/backup-restore-scope-apply-service.js`
- `src/server/recovery/backup-restore-apply-service.js`
- `src/server/system-module.js`
- `src/server/app.js`
- `src/server/metadata/metadata-module.js`
- `src/server/metadata/metadata-refresh-scheduler-service.js`
- Removed: `src/server/metadata/metadata-monitoring-store.js`
- Removed: `test/server/metadata-monitoring-store.test.js`
- Tests updated: backup-export, backup-restore-scope-apply, backup-restore-apply,
  metadata-module, metadata-refresh-scheduler, app wiring.

Behavioral outcome:

- New backups no longer include `monitoring.artistMonitoring`; the monitoring
  scope carries only canonical operator-scoped state.
- Restore applies only canonical operator-scoped monitoring state; the retired
  `artistMonitoring` field in old backups is ignored (forward/backward
  compatible).
- `metadata_artist_refresh_state` is treated as rebuildable operational state
  (not exported/restored).
- The legacy `metadata-monitoring-store.js` and its entire wiring chain are
  removed; the metadata refresh scheduler no longer carries a legacy store
  fallback.
- `metadata_artist_monitoring` is now an orphaned table with zero code
  references, ready for a DROP migration.

Validation performed:

- `node --test test/server/backup-export-service.test.js`
- `node --test test/server/backup-restore-scope-apply-service.test.js`
- `node --test test/server/backup-restore-apply-service.test.js`
- `npm run test:server`
- `npm run lint:server` / `npm run lint:test`
- `npm run check:esm`
- `npm run build:server`
- `git diff --check`

## Remaining Cleanup

- Drop the `metadata_artist_monitoring` table in a dedicated schema migration
  (it is now orphaned, with zero code references), and remove its schema
  snapshot/anchor entries at the same time.
