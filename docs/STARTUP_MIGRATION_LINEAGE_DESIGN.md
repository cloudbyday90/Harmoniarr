# Startup migration lineage: design

Date: October 26, 2026. See separate [research](STARTUP_MIGRATION_LINEAGE_RESEARCH.md),
[outcome](STARTUP_MIGRATION_LINEAGE_OUTCOME.md) and
[Docker evidence](LOCAL_DOCKER_STARTUP_MIGRATION_LINEAGE_OUTCOME.md).

## Boundary and ownership

startServerRuntime bootstraps an empty schema as before, then calls
assertStartupMigrationStateCurrent with the same getPool owner. The assertion
must succeed before path/service readiness, createApp, listen, maintenance/recovery
composition or background startup. Its narrow ESM service depends on the existing
read-only full-state observer and owns no pool, timer or mutable singleton.

The observer loads the local manifest and selects ledger rows once through the
existing SQL store. The pure report compares applied filename membership,
checksums, migration keys and statuses. Migration-key drift is now an explicit
finding in both current-state computation and privileged diagnose output.
The existing schema-snapshot assertion also benefits from this stricter report;
template preparation retains its independent exact-row checks.

## Admission policy

| Observed prepared state | Server behavior |
| --- | --- |
| Nonempty manifest and complete matching applied rows | Continue to path readiness and normal startup |
| Missing repository filename or known failed/running row | Refuse before composition/listen |
| Unknown applied row | Refuse before composition/listen |
| Applied checksum or migration-key mismatch | Refuse before composition/listen |
| Missing ledger, denied query, failed manifest read | Propagate failure; no repair or retry |
| Empty manifest with an empty matching ledger | Refuse; empty packaging is not startup evidence |

Inconsistent reports produce startup_migration_lineage_invalid with fixed
remediation text and numeric category counts. Startup logs exclude stored filenames,
checksums and error_message values. Observation Error/null identities are preserved;
the existing CLI/index reporter, pool cleanup and exit-status ownership remain.
Detailed diagnose output stays an explicit privileged operator action. Status and
checksum commands retain their narrower exit policies; diagnose remains report-only.

The runtime's injectable assertion is now named assertStartupMigrationStateCurrent
to reflect its contract. All internal injected callers were updated. No old
pending-only assertion controls the new production default.

## Preparation and recovery

The Docker entrypoint still runs prepareDatabase before starting its application
command. That explicit phase bootstraps, applies pending migrations and verifies
pending filenames. This change validates the state that preparation produces; it
does not add a guard before preparation writes or change automatic retry of failed
rows by the existing migration writer. Direct application startup validates its
current prepared state without applying pending migrations.

On refusal, HTTP recovery and ordinary commands do not become available. Stop
application/migration writers, retain database/volume evidence and a backup, and
inspect using the existing diagnostic tooling with an independently available
maintenance database connection. For missing local files or historical checksum/key
drift, establish the matching application artifact and verified compatible database
before restarting. For legitimate pending/failed work, review the migration and
failure, then use explicit migration preparation/retry. Never rewrite ledger values
or delete unknown history solely to make startup pass. No new repair tool, recovery
endpoint or bypass mode is added.

The guard is a point-in-time lineage check, not a live schema hash or coordination
protocol. Deploy/migrate with writers quiesced. An external write after the SELECT
is outside its lifetime; a transaction around that SELECT alone would not protect
later application work. Pre-preparation applied-lineage validation is the next
bounded improvement, with its own pending-upgrade and failed-retry policy.

## Validation ownership

Unit checks prove shared-report key drift, empty-manifest refusal, bounded log
projection, supplied pool ownership, original Error/null and pre-composition order.
Native fault checks use the existing admitted disposable PostgreSQL fixture, DDL
guard and actual packaged child processes. Six startup refusals compare full ledger
hash and UUID function catalog identity before/after. Repeated concurrent diagnostic
cohorts and restricted-role access remain covered. Positive normal/recovery startup
and container replacement use the real preparation/entrypoint path with background
services enabled. No faults or fixture roles are applied to preserved live data.
