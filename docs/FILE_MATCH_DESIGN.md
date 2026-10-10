# Acquisition-owned file-match design

Accepted October 9 local / October 10 UTC, 2026, on clean main
95cae708cf736490057fcb0769e79c89abb02e75. Separate
[research](FILE_MATCH_RESEARCH_2026_10.md) and
[outcome](FILE_MATCH_OUTCOME.md) record official sources and executed evidence.
Work stays on main without a branch, release, tag, deployment or PR merge.

## Problem, alternatives and recommended stack

File matching awaits metadata lookup, then reads caller-owned files and upserts
match projections by file ID. A superseded scan can overwrite a current match;
mutable caller tags can also change which source an earlier lookup appears to use.
Tag snapshot ownership does not authorize this later awaited write.

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Check in the scan worker before lookup | Small change | Lookup and SQL waits outlive the check | Insufficient |
| Check only the lease before the INSERT | Stops some old acquisitions | File/tag drift and expiry after waiting remain | Insufficient |
| Lock files while loading metadata | Serializes cooperating writers | Holds locks through lookup and matching work | Reject |
| Capture inputs, then guard a short atomic batch | Preserves source identity and refuses stale work | Batch locks/checks; one stale file refuses the batch | Implement |

Recommended stack: existing scan worker and original acquisition context; a narrow
ESM source/result policy, match owning service and guard store; existing batched
match SQL through one transaction, source/tag predicates and verified returned
identities. Preserve strategy precedence, confidence, evidence, ambiguity and
missing-tag outcomes. Add no schema migration, framework or dependency upgrade.

## Capture and matching boundary

Pass runId, original expectedLease, requested root, canonical walk root and verified
catalogue root UUID from the scan worker. Before the metadata lookup await, capture
all observed files with immutable UUID, root, path, size, nullable ISO mtime, tags
and optional release scope hint. Reuse tag-source/catalogue path validation,
including valid double-dot filenames and literal POSIX backslashes. Reject invalid
or duplicate source identities. Ignored files remain outside matching.

Clone and freeze JSON tags. Treat SQL NULL separately from an empty JSON object;
object key order is irrelevant while array order remains significant. Returned
extraction presentation stamps may predate a successful snapshot, so compare the
actual captured tag payload and catalogue source rather than those stale stamps.
The release hint is a captured matching input. Derive its current assignment from
the locked run's saved release hints, using the existing assignment helper on a
file without a preexisting scope. Compare the relevant assignment, preserving
unrelated hints rather than requiring an identical entire run summary.

The matcher requires writeOwnedLibraryFileMatchBatch and has no production raw
writer fallback. Compute results only from captured files and the returned lookup
rows. The owning writer captures result fields before awaiting SQL and requires
exactly one unique result per captured file. A refusal propagates out of matching
and stops subsequent release, wanted and request reconciliation for that call.
An empty validated batch performs no writes or transaction and grants no later
authority; the scan worker already skips matching when there are no input files.

## Transaction and persistence

Maintenance checks use the same transaction client first. Lock the scan run,
advisory lease key and lease row, then the captured root, then files in UUID order.
Require the running scan, unchanged requested-root frame, no cancellation and the
original current unreleased acquisition. Refresh database clock after lock waits.
Every file must still be observed, undeleted, in the captured canonical root and
have the same path, size, nullable mtime and tags. Its release scope must still
agree with the relevant saved run hint.

Recheck authority, source and fresh clock immediately before batch SQL. The INSERT
SELECT repeats file-source and JSONB tag predicates, upserts through that client,
and returns file IDs. Require complete, unique, exact identities; a missing or
unexpected row refuses the write. Recheck source/authority/time after writing,
before commit. Failure rolls back the entire match batch, including earlier rows
in that statement. The raw internal writer retains standalone transaction mode
and existing last-value deduplication; production scans use the owning service.

## Evidence and limits

Focused tests own capture, ordering, guard propagation and existing strategies.
Real PostgreSQL tests own stale acquisition/source/tag refusal, actual root/file
wait expiry, atomic batch rollback, zero-row CAS, SQL failure and current positive
matching. Preserve import post-apply scan and organize coexistence coverage.
Run the required full repository validation and dependency security check.

This protects persisted catalogue/tag source and captured scan authority. It does
not provide a physical file snapshot, content hash or metadata-candidate snapshot:
same-size/same-mtime physical edits and later catalogue metadata changes need
separate designs. Commit acknowledgement may cross a later expiry instant.
Earlier catalogue/tag commits remain committed. Sidecar artwork runs before this
matching boundary; its prior work is not rolled back. Embedded artwork ingestion
and assignment and later reconciliation remain separate owners. No UI change or
browser/assistive-technology conformance claim is made by this backend slice.
