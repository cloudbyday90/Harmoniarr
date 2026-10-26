# Snapshot anchor outcome — October 26, 2026

## Delivered behavior

Fresh bootstrap now admits a reviewed expected contract before BEGIN, then checks
164 critical schema facts after complete migration-lineage verification and before
COMMIT. Missing or altered anchors roll back the full schema and ledger. Ordinary
nonempty-schema preparation and per-migration upgrade behavior remain intact.
Implementation uses small ESM policy, store and service modules in the existing
application. No new table, migration, dependency or runtime service is required.

The contract was generated from a fresh migration-only database and reproduced
byte-for-byte from another fresh source. Its SHA-256 is
`6873e241cf2a55c12c5d292abdb5c57a4f1e3185f46a35ab6d1a608e6e589d4f`.
The 115 raw migration files and raw snapshot remain unchanged. Two historical
64-byte reconciliation index anchor names were corrected to their actual 63-byte
PostgreSQL identities; historical SQL was retained.

## Stable candidate validation

The focused owner/transaction/bootstrap/anchor/script cohort passed 74 tests.
The complete fast gate passed 6,191 server, 4,497 client and 703 script tests,
without failures, skips or cancellations, plus all static checks, lint and build.
The npm audit reported zero vulnerabilities. The frozen source fingerprint covers
3,666 files; all 18 changed code/data files match the qualified candidate.

Unit coverage includes stale snapshot/lineage/specification bindings, incomplete
and unsafe contracts, ambiguous catalog results, same-name weakening, literal
whitespace changes, canonical context restoration and Error/null failure
precedence. Generation refuses incomplete sources and waits for the source
callback's completion before writing its artifact. The existing database-backed
checker passed fresh migration/snapshot/bootstrap comparison with 164 anchors.

## Immutable PostgreSQL evidence

Image `sha256:35b15ff5898fffb3dbe2498f1f3ec290575c806cde3e37e5802d989aedc8686e`
passed all 17 native snapshot scenarios. Ten deliberately corrupted, otherwise
matching-lineage snapshots refused before COMMIT:

| Corruption | Observed result |
| --- | --- |
| Missing critical table | Anchor refusal, complete rollback |
| Missing critical column | Anchor refusal, complete rollback |
| Required column made nullable | Anchor refusal, complete rollback |
| Same-name CHECK weakened to true | Anchor refusal, complete rollback |
| Unvalidated CHECK | Anchor refusal, complete rollback |
| Unenforced CHECK | Anchor refusal, complete rollback |
| Missing critical index | Anchor refusal, complete rollback |
| Same-name index replaced with different definition | Anchor refusal, complete rollback |
| Root-authority trigger disabled | Anchor refusal, complete rollback |
| Trigger function replaced with permissive body | Anchor refusal, complete rollback |

Independent connections observed the original fresh schema after each refusal;
no ledger or outside failed receipt survived. Owner retirement was observed
before reviewed retries, which succeeded with 115 applied receipts. The fixture
also retained held-tail visibility/commit, real backend termination, SQL error,
ledger error, provenance refusal and both real COMMIT dispatch/reply-loss cases.
All 17 acknowledged private databases were retired and absence verified.

The same immutable image passed the preparation-owner, migration transaction,
CLI reader, observation, startup recovery and fresh migration-only fixtures.
All seven native fixture containers retired. Live migration/checksum/diagnostic
commands preserved ledger/catalog identity. The seven production-entrypoint
preparation cases passed; all 15 owned containers and seven volumes retired with
absence verified. History incompatibility refused before DDL/application startup,
ordinary pending work upgraded healthy, and failed work required explicit retry.

All 18 process/container replacement checkpoints passed with production startup,
background services, same-volume WAL recovery, preserved pre-crash records and
repeated recovery. Owned containers, probes and matrix volume retired with
absence verified. This retains the existing backup/recovery boundary; hardware
power loss remains outside the qualification.

GitHub MCP found no open PRs in `cloudbyday90/Harmoniarr`; random local application
and stale cleanup/rebase were inapplicable. Work is on main with no new branch,
release, tag or PR merge. The healthy no-cache walkthrough retained its existing
administrator, data and five bind mounts.

## Recommendation and next item

Adopt the preparation owner → immutable SQL/contract provenance → one transaction
→ complete ledger → 164 critical facts → acknowledged COMMIT stack. Benefits are
pre-publication refusal and atomic recovery with no extra runtime infrastructure.
Costs are artifact maintenance, eight additional context/catalog queries during
fresh bootstrap, and exact PostgreSQL deparser compatibility qualification.

The contract is trusted packaged data, not external authenticity or a SQL sandbox.
It does not cover every schema property, object permission, function dependency,
hardware power loss or drift in existing nonempty databases. No markup changed;
manual screen-reader and physical-device acceptance remain deferred.

Next: add a bounded read-only anchor diagnostic for existing nonempty databases,
using the established observation/maintenance boundary and names-only output.
Distinguish lineage state from critical structural drift, offer no automatic
repair, and prove restricted-role/no-write behavior before broadening startup
admission. See [research and alternatives](SNAPSHOT_ANCHORS_RESEARCH.md),
[design](SNAPSHOT_ANCHORS_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_SNAPSHOT_ANCHORS_OUTCOME.md).

The next diagnostic item is implemented separately in the
[read-only schema drift design](SCHEMA_DRIFT_DESIGN.md) and
[outcome](SCHEMA_DRIFT_OUTCOME.md); this earlier qualification remains historical.
