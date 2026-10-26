# Snapshot anchor design

## Expected contract and module boundaries

Fresh snapshot bootstrap must validate selected critical schema facts before
COMMIT, independently of matching migration receipts. Expected facts come from a
fresh migration-only PostgreSQL 18 source, never from the bootstrap being checked.
The checked-in `src/server/schema-anchor-contract.json` contains 164 anchors:
19 tables, 63 columns, 41 constraints, 35 indexes and six triggers.

- `schema-anchor-contract-policy.js`: immutable specifications from the existing
  critical list, deterministic JSON, exact shape/healthy-state checks and SHA-256
  bindings to raw snapshot, ordered filename/key/checksum lineage and specifications.
- `schema-anchor-catalog-store.js`: five sequential parameterized catalog batches;
  explicit public object lookup and qualified `pg_catalog` reads. Reject incomplete
  or ambiguous results instead of silently overwriting duplicate observations.
- `schema-anchor-catalog-service.js`: active-transaction/major-version requirement,
  temporary local `pg_catalog` deparser context and original-context restoration.
  Preserve the original rejection, including null, if restoration also fails.
- `schema-anchor-contract-service.js`: packaged artifact loading/provenance and
  actual-vs-expected policy. Failures expose a fixed code/count and approved anchor
  identities, not reconstructed SQL or function bodies.
- `scripts/schema-anchor-contract.js` and thin ESM entrypoints: development-only
  generation and static freshness check. No development Docker helper ships in
  the runtime import graph. The server build copies the sibling JSON artifact.

All code remains ESM inside the existing application. No table, migration,
dependency, second service, release version or HTTP command is added.

## Execution and recovery

Under the preparation session owner, nonempty schemas return before artifact
loading. Fresh schemas pass the existing manifest/rendered-SQL checks, then load
and validate contract provenance before BEGIN. Inside the shared transaction:
snapshot body → complete applied ledger verification → catalog inspection →
exact critical-fact comparison → COMMIT acknowledgement. Every read uses the
captured client; no reference database is started by production bootstrap.

Facts include table kind/persistence/RLS flags; column formatted type, nullability,
default, identity/generated mode and collation; constraint definition and enforcement,
validation and deferral flags; index definition/uniqueness/null semantics and
valid/ready/live flags; trigger enabled state, definition and full function definition.
SQL literal and function-body whitespace is preserved exactly.

| Failure | Outcome |
| --- | --- |
| Missing/stale/partial/unsafe expected contract | `snapshot_anchor_contract_invalid` before BEGIN/DDL |
| Unsupported PostgreSQL major | `snapshot_anchor_postgres_unsupported`; full transaction rollback |
| Incomplete/ambiguous catalog observation | `snapshot_anchor_catalog_invalid`; full rollback |
| Missing or changed critical fact | `snapshot_schema_anchors_invalid`; full rollback |
| SQL/inspection/restoration failure | Full rollback; original Error/null retained |
| Lost COMMIT acknowledgement | Existing `snapshot_commit_outcome_unknown`; discard, inspect independently, no automatic retry |

Rollback includes the schema and ledger; no outside failed-snapshot receipt is
written. Existing applied databases and ordinary per-migration upgrades retain
their existing behavior. This does not yet diagnose critical drift in those
nonempty databases.

## Maintenance and validation

After an intentional migration/specification change, update/review the raw snapshot
through its existing workflow, then run `npm run update:schema-anchor-contract`.
That command prepares a fresh migration-only Docker source, verifies current
lineage, observes its catalog under the preparation owner, validates healthy
facts and writes canonical JSON after the source callback completes. It never
learns expected facts from the live application database. Existing Docker-helper
cleanup behavior is unchanged; this command does not strengthen that helper's
legacy best-effort teardown contract.

`npm run check:schema-anchor-contract` performs a static provenance/shape check and
is included in `validate` and `validate:fast`. `npm run db:check-schema` retains
fresh source/snapshot comparison. Neither static checking nor catalog deparsing
proves semantic equivalence of arbitrary SQL.

Native tests deliberately retain baseline expected facts while rebinding only
fixture lineage metadata for a trusted synthetic tail migration. Public runtime
defaults offer no artifact-regeneration or bypass option. Independent connections
observe rollback, owner retirement and reviewed retry. Tests also retain real
backend termination and COMMIT protocol-loss cases.

The old comparison checker now uses PostgreSQL's actual 63-byte stored names for
two historical reconciliation indexes. No historical SQL or raw snapshot bytes
change. See [research](SNAPSHOT_ANCHORS_RESEARCH.md) and
[outcome](SNAPSHOT_ANCHORS_OUTCOME.md).
