# Acquisition-owned release reconciliation design

Client task date: October 10, 2026, America/New_York. Clean main baseline:
29fa665efcf050fd58612c1e5a0d67c408bbab39. Separate
[research](RELEASE_RECONCILIATION_RESEARCH_2026_10.md) and
[outcome](RELEASE_RECONCILIATION_OUTCOME.md) record guidance and execution.
Work stays on main without a branch, release, tag, deployment or PR merge.

## Problem and recommended stack

The current service awaits a global coverage query outside the transaction that
deletes absent reconciliation rows and upserts availability counts. It carries no
original scan acquisition. An older body can replace a newer projection, including
deleting all releases when an earlier query was empty. Coverage crosses library
roots and metadata/file/match producers; existing-row locks alone miss new rows.

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Worker or lease check before outside coverage lookup | Small patch | Waits and source changes outlive the check | Insufficient |
| Serializable isolation alone | Transaction serializability | Earlier snapshot is not necessarily latest after waits; needs retry design | Insufficient alone |
| Broad source-table barriers | Can fence ordinary source DML and phantoms | Blocks unrelated work; row/FK interactions need coordinated acquisition and retry | Defer |
| Serialize projection replacement, fresh reads and revalidation | Protects replacement ordering and rejects observed source drift without broad producer changes | Freshness is bounded to query snapshots; locks global replacement and scan authority | Implement |

Stack: existing scan worker/original acquisition; narrow ESM context/coverage
policy, coverage SQL store and guard store; existing service as transaction owner;
shared PostgreSQL transaction runner and a global transaction advisory lock; atomic
DELETE plus batch upsert with complete returned identities. Preserve complete,
partial and duplicate status rules, counts and evidence. No migration or dependency
upgrade is needed. Metadata lookups move into the owning SQL store.

## Context, ownership and global coverage

Before any await, capture runId, original expectedLease, requested root, canonical
walk root and verified catalogue root UUID. Reuse catalogue context/path validation
with an empty observation array. The API accepts scan context, not a previously
computed reconciliation payload. Required maintenance readiness uses the same
client. Lock run and advisory lease key/row, then the global projection key.
Read the captured root frame without acquiring dependency root/file/metadata row
locks. Refresh context and database clock after the global wait.

Require a writable running scan, no cancellation, the original current unreleased
acquisition, unchanged requested root and current captured root ID/path. Explicitly
use READ COMMITTED for the owning transaction before its first query: coverage
queries after waits must obtain new snapshots, even if the host default changes.

Read coverage only through that client after current ownership and global admission.
One query spans metadata artists/groups/releases/media/tracks and observed,
undeleted files with current matched associations. Validate and freeze the mapped
unique release rows. Compare relevant IDs/counts/status/evidence by value and
release identity, not result ordering. New files, other roots, new metadata tracks
and cascaded changes are included whenever they alter the aggregate. Equal
aggregate output is safe; unrelated tag/title/summary edits need not refuse it.

Re-read global coverage and refresh authority/time before DELETE, before the
batch upsert and after writes. Refuse changed aggregate output; do not adopt a new
source halfway through replacement or retry using cached rows. A fresh invocation
can recompute under the original/current command contract.

## Atomic replacement and failure behavior

All raw replacers acquire the same global transaction advisory key, including
standalone internal mode. A supplied client owns its transaction lifetime; no nested
BEGIN/COMMIT occurs. Capture persistence values before awaits. Read current target
release identities, delete all/absent rows with RETURNING and verify the exact
expected deleted set. Batch upsert all current rows with RETURNING and verify
complete, unique expected identities. Empty current coverage still performs
verified cleanup. Deduplicate standalone input by last value; production coverage
is unique. Two mutation statements keep full aggregate revalidation bounded.
Use database clock at SQL mutation for reconciliation/update stamps; transaction
start time must not make a later-admitted fresh replacement look older.

SQL failure, incomplete deletion/upsert, stale coverage, final authority loss or
expiry rolls back deletion and all upserts together. Refusal stops later wanted/
request reconciliation and completion from that worker invocation. Pause and
cancellation use existing worker handling. Deadlock/serialization failure is safe
rollback, not evidence of universal deadlock freedom or permission to replay stale
rows. No new automatic retry or operation system is introduced.

## Evidence and limits

Focused tests own context capture, snapshot setup, same-client ordering, mapping,
guard propagation, deletion completeness, batch cardinality and rollback wiring.
Real PostgreSQL owns replaced-acquisition refusal, stale empty cleanup, changes
after coverage lookup, other-root/new-row/metadata-track drift, real projection
waits crossing expiry, current status controls, DELETE/second-row SQL failure and
final rollback. A waiting reconciler must read source changes committed before
admission. Once a body holds admission, another replacement waits; test that
serialization rather than asserting that both can publish concurrently. Preserve
post-apply scans and catalogue/match/tag/organize coexistence coverage.

This is a derived read model with query-snapshot freshness, not strict latest
coverage at commit. Source writers remain free; a commit after the final source
read can leave availability needing another pass. Earlier catalogue/tag/match and
artwork commits are not undone; later wanted/request fulfillment remains a separate
owner. No physical-byte, external exactly-once, browser or WCAG conformance claim
follows. The next slice will be chosen from the remaining observed boundaries.
