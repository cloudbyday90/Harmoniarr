# Acquisition-owned tag snapshot design

Accepted October 9 local / October 10 UTC, 2026, on clean main
cab4e73507c116f3ea14f02589e59d6d8fda806c. Separate
[research](TAG_SNAPSHOT_RESEARCH_2026_10.md) and
[outcome](TAG_SNAPSHOT_OUTCOME.md) record sources and executed results.
Work stays on main without a branch, release, tag, deployment or PR merge.

## Problem, alternatives and final stack

Tag extraction awaits metadata parsing, then inserts snapshot history and
updates the current file by ID. Source size/mtime are stamps, not write guards.
An old result can replace newer file metadata. The broad catch also includes
persistence and artwork, converting write refusals into a second failed snapshot.

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Worker-only check before parsing | Small patch | Parsing and later SQL waits can outlive authority | Insufficient |
| Guard only the file UPDATE | Protects one write | History may already be appended; failure fallback remains | Insufficient |
| Hold SQL locks through parsing | Serializes cooperating writers | Long filesystem/parser work under locks; no physical snapshot | Reject |
| Capture before parsing, guard history and source CAS together | Both local writes commit or roll back under current authority | Per-file transactions, current-row checks and expiry refusal | Implement |

Final stack: existing scan queue/worker; original acquisition and root context;
narrow ESM tag-source policy, owning service and authority store; the existing
snapshot SQL through one caller-owned transaction. Preserve actual parser
behavior, metadata normalization, sequential files and genuine per-file failures.
No schema, route, UI, parser upgrade or parallel job system is added.

## Capture and extraction boundary

The worker supplies runId, original expectedLease, requested root, canonical walk
root and the verified catalogue root UUID. Before the first parser await,
extraction prepares every observed file's immutable source frame: file UUID,
root UUID/path, canonical path, observed state, size and nullable mtime as ISO
text. Clone presentation fields separately; mutable Date or caller objects cannot
change authority. Reuse the catalogue capture policy's platform path semantics,
including valid double-dot names and literal POSIX backslashes.

The extraction service requires writeOwnedLibraryFileTagSnapshot; it has no raw
writer fallback. Catch parser/metadata-normalization failures separately from
persistence. A genuine parser failure can produce one failed payload, but it
must pass the same original ownership and source guard. Typed ownership,
cancellation, pause or source refusals propagate rather than becoming failed
metadata. Persistence errors occur outside the parser catch and are never retried
as a failed snapshot. Artwork starts only after successful guarded persistence.

## Transaction and source comparisons

The owning service copies the payload before awaiting SQL and owns one short
transaction per file. Maintenance uses that client first, then run→advisory lease
key/row→captured root→file locks. Require matching running scan, unchanged requested
root frame, no cancellation and the original current unreleased acquisition.
Refresh database clock after all waits.

The locked file must still belong to the captured root, have the same canonical
path, size and nullable mtime, be observed and not deleted. Snapshot history and
the current file update use the same client. The UPDATE repeats those source
predicates and returns one row; a zero-row CAS is refusal and rolls back history.
Require exactly one returned snapshot and file identity. Recheck current
authority/time and source after writes, before commit. No parser/filesystem I/O
occurs under these locks. The raw internal snapshot writer retains a standalone
transaction mode for existing callers/tests; production extraction uses its owner.

Current extracted results preserve source stamps. Current parser failures retain
their existing null tag/quality read-model behavior and preserve prior successful
source stamps; they do not reset ignored or deleted files into observed state.
SQL or final-check failures roll back both writes, return no extracted success
and start no artwork, matching or later reconciliation from that call.

## Evidence and bounded guarantees

Use real PostgreSQL and test-owned media. Hold A after reading/parsing, replace
its acquisition and let B persist newer file/tag state, then resume A: no extra
snapshot, tag/quality overwrite, failed fallback or artwork. Current successful
parsing and current parser failure must each persist once. Exercise root/path,
size/mtime, ignored/deleted and requested-frame drift, cancellation/maintenance,
actual root/file lock waits with expiry, INSERT/UPDATE failure, zero-row CAS,
final expiry rollback and scan/organize coexistence. Focused doubles own ordering
claims; actual SQL/rows and native parser fixtures own executed database/media claims.

This compares the saved catalogue source, not a content hash or an atomic
filesystem snapshot. Same-size/same-mtime physical changes may remain invisible.
Commit acknowledgement can cross a later expiry instant. Successful earlier
per-file commits are not undone by a later refusal. Artwork's later ingestion/
assignment, sidecar capture, matching and reconciliation remain separate owners;
this slice suppresses their handoff when tag persistence refuses. Existing HTTP,
session/CSRF and truthful job-status behavior remains; no browser, speech or whole
WCAG conformance claim is made.
