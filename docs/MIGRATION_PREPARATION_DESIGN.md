# Migration preparation: design

Date: October 26, 2026. See separate [research](MIGRATION_PREPARATION_RESEARCH.md),
[outcome](MIGRATION_PREPARATION_OUTCOME.md) and
[Docker outcome](LOCAL_DOCKER_MIGRATION_PREPARATION_OUTCOME.md).

## Owners and order

migration-preparation-service.js captures and freezes the manifest, classifies
public catalog relations through the SQL store, and evaluates existing rows using
the shared full-state report. It owns no pool or background process. The migration
writer supplies its checked-out client and reuses the validated manifest's SQL and
pending list, avoiding a second file read after validation. Only after admission
does it create the extension/function/ledger and execute pending SQL.

Snapshot bootstrap retains its nonempty-schema skip. Before writing a snapshot to
an apparently empty schema it also requires catalog-confirmed freshness; limited
information_schema visibility cannot authorize overwriting hidden relations.
prepareDatabase forwards the same getPool factory through bootstrap, apply and
verification. Captured-client cleanup preserves the primary Error/null over a
secondary release failure in both writer and bootstrap.

## Admission and retry policy

| State | Default preparation | Explicit --retry-failed |
| --- | --- | --- |
| Empty public relations, no ledger, nonempty manifest | Initialize | Initialize |
| Empty ordinary ledger alone | Apply known pending SQL | Same |
| Matching applied history plus absent repository files | Apply pending SQL | Same |
| Applied checksum/key drift or unknown applied row | Refuse before DDL | Refuse before DDL |
| Known failed row with matching filename, key and checksum | Refuse | Retry captured SQL |
| Running, unknown, malformed or incompatible failed row | Refuse | Refuse |
| Nonempty relations without an ordinary ledger, or populated schema with empty ledger | Refuse | Refuse |
| Empty manifest, catalog/ledger/file read failure | Refuse | Refuse |

The guard validates existing records; it does not distinguish a deliberately
deleted history row from a newly absent pending migration. Existing out-of-order
pending-file behavior is retained. It does not certify physical schema objects or
repair data. Unknown or blocked non-applied rows remain evidence for investigation.
No stored filename, checksum or error_message is copied into automatic refusal
logs; category counts and fixed guidance are sufficient to request explicit
privileged diagnosis.

For a reviewed retry, first stop writers, preserve a backup/evidence, inspect the
failure and verify matching SQL and expected objects. Then run:

```powershell
npm run migrate -- --retry-failed
```

With the packaged embedded database, the exact command
`node /app/server-dist/migrate.js --retry-failed` owns guarded preparation. The
Docker entrypoint starts PostgreSQL, then runs that command once, without first
running default preparation that would reject the failed row. Other commands,
including normal server startup, keep default preparation. This is an explicit
guarded migration path, not a bypass setting or an application startup override.
After success, ordinary startup still performs its default full-lineage checks.

The flag does not make SQL idempotent, remove leftover objects or prove that a
previous attempt rolled back completely. Transaction ownership remains unchanged
in this patch; audit the nested BEGIN/COMMIT arrangement next. Quiesce writers:
the read-only preflight and captured connection do not serialize independent
preparers or arbitrary external SQL.

## Qualification

Unit checks own fresh/nonempty classification, every blocked category, exact failed
consent, manifest capture, no-DDL ordering, pool propagation and Error/null cleanup.
Native CLI faults compare ledger/catalog hashes under a DDL tripwire, then exercise
a real missing index/pending migration and a reviewed failed-row retry.

A separate Docker runner owns labelled disposable volumes and validates runtime
limits and mounts before operating/removing them. Seed commands use the real
entrypoint/fresh snapshot. Normal replacements must reject checksum/key/unknown/
failed/missing history under the DDL tripwire before starting the application.
A valid pending upgrade must become healthy. An exact explicit retry command must
run once, exit successfully, and permit a later ordinary production startup.
The preserved live deployment receives no fault or history mutation.
