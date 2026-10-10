# Acquisition-owned scan catalogue design

Accepted October 9, 2026 local, on clean main
041458d3609912ae7b1fee87244c9c17a5800165. Separate
[research](SCAN_CATALOGUE_RESEARCH_2026_10.md) and
[outcome](SCAN_CATALOGUE_OUTCOME.md) record sources and actual results.
Work stays on main without a branch, release, tag, deployment or PR merge.

## Problem and recommendation

The scan worker awaits a filesystem walk, then passes only files and canonical
root to recordLibraryFiles. Its transaction enables/upserts the root, upserts
file batches and tombstones absent paths before the final lifecycle check can
detect lost ownership. An old observation set can overwrite replacement work;
an old empty set can tombstone its files.

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Worker-only check after walking | Small change | Later database waits and expiry remain unguarded | Insufficient |
| Guard only ON CONFLICT updates | Reuses one SQL clause | Inserts and tombstones remain outside the check | Reject |
| Hold locks throughout the walk | Serializes takeover | Long filesystem I/O inside a transaction | Reject |
| One guarded catalogue transaction after a successful walk | Root, batches and tombstones commit or roll back together | Holds ownership/root locks during catalogue SQL; expiry may require retry | Implement |

Final stack: existing scan queue/worker; narrow ESM capture policy, owning service
and authority store; existing transaction runner and maintenance/run/lease locks;
the current catalogue SQL through a supplied transaction client. Preserve the
5,000-row batches, deduplication, tag metadata and standalone catalogue API.
No schema, route, UI or parallel job system is added.

## Owning contract

The worker must require recordLibraryScanCatalogue and pass runId, the original
expectedLease, requestedLibraryRoot, canonical libraryRootPath and observations.
Capture the token and scalar observations before the first await, including Date
timestamps as immutable ISO text. Reject malformed/outside-root observations.
Preserve observed/ignored states and legitimate empty successful walks.
Containment checks parent path segments, preserving valid contained double-dot
names. Relative paths use the selected platform's separator; a POSIX filename's
literal backslash must not be reinterpreted as a directory separator.

The requested root is the original queued/started root in the run summary;
realpath may return a different canonical root. Carry both rather than equating
their strings or performing another filesystem lookup under SQL locks.

The service owns one transaction. Maintenance readiness uses its client first;
then lock the exact scan run, advisory lease key/row, existing canonical root,
and files through the catalogue's root-first writer. Require a running matching
run, unchanged requested-root frame, no cancellation, and the original current
unreleased acquisition. Refresh database clock after lock waits.

recordLibraryFiles gains optional queryable and beforeWrite parameters. With a
client it does not begin, commit, roll back or release another transaction. Its
awaited callback runs before root upsert, every file batch and tombstoning. The
owning service rechecks current authority/time at these boundaries and after all
catalogue SQL, immediately before returning to the transaction runner for commit.
Invalid/incomplete returned catalogue results also roll back; zero tombstones
and zero observed files remain valid for a genuinely current empty scan.
Completion's observedFileCount uses the confirmed deduplicated catalogue result;
the walk's filesSeen remains the separate observation count.

An absent root is still coordinated by the existing unique canonical_path and
root upsert. A wait inside SQL can produce provisional changes before the next
check; the final guard rolls back the entire transaction. Do not claim every SQL
statement stays unexpired throughout execution or that commit acknowledgement
cannot cross an expiry instant. No filesystem I/O occurs inside this transaction.

Typed lease-loss, pause and cancellation reach existing outer worker handlers.
Refused catalogue work returns no success and starts no downstream tag, artwork,
matching or reconciliation work. Effects after a successful catalogue commit are
separate owners and remain outside this slice's token guarantee.

## Acceptance evidence and limits

Use the actual walker and test-owned files: hold A after walking, change files,
let B acquire and commit a newer catalogue, then resume A. A must not change B's
root/file/tombstone state, completion or downstream work. Include stale empty A
and genuinely current empty scans. Exercise cancel/maintenance, actual root/file
lock waits with expiry, expiry after writes, batch/tombstone faults and complete
rollback, same-client execution, result completeness and organize coexistence.
Retain first failures; run focused checks and complete validation before push.

The filesystem walk is an observation, not a filesystem snapshot. Later file
changes remain possible. This transaction does not fence later tag/artwork or
reconciliation writers, certify media bytes, undo completed file operations or
provide cross-system exactly-once behavior. Existing HTTP/session/CSRF and truthful
Background Jobs status remain; no browser or WCAG conformance claim is made.
