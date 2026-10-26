# Migration CLI readers: design

Date: October 26, 2026. See the separate
[research](MIGRATION_CLI_READERS_RESEARCH.md) and
[outcome](MIGRATION_CLI_READERS_OUTCOME.md).

## Ownership

schema-migration-status-service.js owns status and pending assertions.
migration-checksum-service.js owns applied-row checksum verification and its strict
assertion. schema-migration-state-service.js owns manifest/ledger lineage reporting;
its SQL now lives in schema-migration-store.js. Each observer uses SELECTs against
an already prepared ledger. No observer calls ensureSchemaTable.

migrations.js retains applyPendingMigrations and reexports the same diagnostic API
objects for existing consumers. The writer still prepares its schema explicitly.
Database preparation/bootstrap order remains unchanged; startup still refuses
pending migrations or an unreadable/missing ledger before listening.

Captured clients are released with their receiver intact through
withWorkerTaskCleanup. A query failure, including throw null, takes precedence over
a secondary release failure; a release failure after a successful read propagates.
No module owns a second pool or global service instance.

## Commands and compatibility

check-migrations.js and check-migration-checksums.js import their narrow observer
modules. diagnose-migrations.js is now a packaged server entry point using the
existing runMigrationCli reporter/cleanup. The repository script imports that
entry point through source; the npm script remains compatible. Packaged operators
can run `node /app/server-dist/diagnose-migrations.js`.

| Ledger state | Status exit | Checksum exit | Diagnose exit |
| --- | --- | --- | --- |
| Current | 0 | 0 | 0 |
| Pending/non-applied repository row | 1 | 0 when remaining applied checksums match | 0, report says not current |
| Applied checksum drift | 0 when no filenames pending | 1 | 0, report says not current |
| Unknown applied row | 0 when no repository filenames pending | 1, file_missing | 0, report says not current |
| Ledger missing or SELECT denied | 1 | 1 | 1 |

These retain command-specific policy. A diagnostic report is not a new readiness
gate. Missing schema is an error requiring explicit preparation, not an invitation
for a read to repair the database. Current startup does not enforce full checksum
or unknown-row lineage; that policy remains the next recommendation.

## Qualification boundaries

Unit tests exercise SELECT-only access, exact compatibility exports, captured
client release and primary Error/null precedence. The native entry first admits
the deployment memory profile and prepares its own temporary PostgreSQL cluster.
It creates a fixed fixture-only observer role with SELECT on the ledger,
NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT, and a role-default read-only mode.

The fixture installs the existing DDL event guard, proves explicit preparation is
rejected while guarded, then starts actual packaged CLI children. Each cohort
hashes all ledger rows and records UUID function OID/xmin/definition before/after.
Three-command concurrent cohorts cover current, pending, drift, unknown-row,
permission-denied and missing-ledger cases, plus repeated current waves. Real
startup children separately prove pending/missing state exits before listening.
The guard is disabled only for owned fixture setup/repair and explicit writer
qualification. Child timeout/signal termination cannot count as passing.

The event guard is a DDL tripwire, not proof against every PostgreSQL write. The
restricted role/read-only mode, exact SQL unit boundary and ledger/catalog identity
checks provide complementary evidence. The entire fixture role and database retire
with their isolated container; no live deployment faults or role edits are used.
Unchanged HTTP/onboarding/backup readers and normal startup/recovery have native
regressions because they share the extracted APIs. Container replacement recovery
qualifies the changed startup path against the final packaged image.

This change does not alter browser markup. Existing W3C status/focus requirements
continue to apply to onboarding; manual speech/device acceptance remains deferred.
