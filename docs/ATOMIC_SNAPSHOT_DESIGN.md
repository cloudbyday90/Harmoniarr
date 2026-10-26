# Atomic snapshot bootstrap design

## Contract and modules

Fresh snapshot DDL and complete applied history publish in one transaction under
the existing preparation session owner. Nonempty databases retain the skip and
ordinary pending-upgrade paths. Raw snapshot and all 115 migration bytes/checksums
remain unchanged.

`schema-snapshot-renderer.js` extracts the pure development renderer. The script
imports/re-exports it, preserving its API and exact output; production does not
import development Docker fixtures. `schema-snapshot-plan-service.js` validates
provenance and compiles recognized frames. `schema-snapshot-transaction-service.js`
owns snapshot body/lineage policy. `owned-sql-transaction-service.js` owns protocol
state for both snapshot and migration execution. The migration wrapper retains
its receipt/failure policy. All modules are ESM in the existing application.

## Admission and execution

Under the session lock, inspect bootstrap eligibility and capture the immutable
manifest. Require a fresh schema, read the artifact and compare it exactly with
the shared renderer's output. Missing, empty, changed or stale-prefix snapshots
refuse before BEGIN or DDL. Nonempty schemas return before reading the artifact.

Compile each migration with the established policy, preserving its raw checksum
and metadata. Render the compiled sections with prelude/receipt SQL, then validate
the complete body as unframed SQL. This removes 42 recognized frame pairs in
memory and retains procedural bodies. Unsupported controls refuse before writes.
This trusted-SQL policy is not a full parser or sandbox. Whole compiled-snapshot
error positions need not match raw artifact line positions.

On the captured idle client: BEGIN → require active status → set local ordinary
string interpretation and synchronous_commit → execute body → read every ledger
identity → require exact count/current filename-key-checksum-applied lineage →
COMMIT → require its acknowledgement and idle status. Existing owner cleanup then
unlocks/releases the session.

| Outcome | Behavior |
| --- | --- |
| SQL or lineage failure | Roll back entire snapshot; preserve Error/null |
| Failed/unacknowledged rollback | Discard; preserve primary failure |
| COMMIT explicitly reports rollback | `snapshot_commit_rolled_back`; no success |
| Missing/unrecognized COMMIT reply | `snapshot_commit_outcome_unknown`, cause retained; discard; no rollback/journal/retry |
| Unlock/release fails after commit | Existing cleanup policy; committed history remains intact |

No snapshot failed receipt is written outside the transaction: the ledger itself
may not exist after rollback. The shared protocol still invokes the migration
wrapper's failed-receipt policy only after confirmed per-migration rollback.
It does not apply that policy to snapshots.

## Recovery and limits

Server retirement rolls back an interrupted open transaction. A local pool count
does not establish that retirement. For uncertainty, stop writers, wait for the
discarded backend/key to settle and inspect via `npm run diagnose:migrations` on
an independent maintenance connection. Applied matching history means do not
replay; a confirmed fresh schema may enter reviewed bootstrap. Never drop user
schema or delete history to force retry.

Provenance is relative to trusted packaged source, not external authenticity.
The preparation key coordinates participants only; quiesce old binaries,
external SQL and live workers as required. Atomicity covers transactional database
effects, not arbitrary external SQL effects, consumed random values or hardware
power loss. Larger future snapshots need renewed resource/lock-space qualification.
Normal pending migration batches still commit per migration.

Receipt identity does not establish every live DDL property. The subsequent
[schema anchor contract](SNAPSHOT_ANCHORS_DESIGN.md) adds 164 independent critical
fact comparisons before COMMIT, with missing/altered-anchor rollback proof.
Unanchored schema properties remain outside that contract.

## Evidence ownership

Unit tests cover exact immutable provenance, 115 compiled sections, ordering,
invalid lineage and Error/null outcomes. The native seven-case fixture holds the
full snapshot at a real tail lock and observes no new DDL/receipts from another
connection, then commits or terminates it. It also exercises real SQL/lineage
failures, artifact refusal and real COMMIT dispatch/reply cuts. Reviewed replay
follows independent owner retirement. See [outcome](ATOMIC_SNAPSHOT_OUTCOME.md).

Before freezing source, include new files in staged whitespace checks as well
as tracked-file diffs so extracted modules receive the same style validation.
