# Guarded Wanted publication with no changes: next proposal

This production design candidate follows diagnosis of the seed-phase timeout in
the separately labeled [workload replay](WANTED_WORKLOAD_REPLAY_OUTCOME.md).
Fixture seeding investigation takes priority. No publication check or DML
is skipped by the command improvements in that slice.

## Current owners and observed work

`library-wanted-release-write-store.js` holds the library-request projection
advisory lock, reads target keys, rechecks the complete projection before DELETE,
before a nonempty upsert batch and before link synchronization. The service then
rechecks the complete projection after replacement and retains source lifecycle
guards. An empty DELETE or already-synchronized links can still incur complete
hashing. The upsert always updates `last_reconciled_at` and `updated_at`; equal
business fields alone do not make that statement a no-op.

The canonical Wanted write store owns active INSERT/DELETE of Wanted rows;
schema/migration backfill is a separate path. Discovery reconciliation invokes
link synchronization, while quality/reset and initial-search/rediscovery stores
can update link evidence. Parent deletes can remove links through foreign-key
cascades. A membership-only comparison cannot authorize discarding that evidence.

The root-input statement-trigger contract protects different inputs from Wanted
target and discovery/link membership. Observing that one publisher owns an
advisory lock does not establish that every target, discovery and cascade writer
participates, especially for an absent target/link. Row locks cover existing rows,
not the missing rows a concurrent insert can introduce.

## Proposed first boundary

Evaluate a strictly transaction-owned empty-delete proof before a broader
whole-replacement optimization. Audit every target/link/discovery/cascade writer
and the common lock order first. Prefer one existing cooperating lock contract
where it can cover membership and absence; if a statement-level migration is
needed, prove installed/enabled trigger bodies through migration and snapshot
paths, current-transaction capability and fresh post-admission reads. Decline
unsupported/busy/expired proofs and retain the current guarded path.

For link work, compare the complete intended relationship and retained evidence
inside that authority. Keep required audit atomic, actual mutation guards, the
service's final complete projection and current lease/cancellation checks. Host
bytes still require opening/closing full hashes; SQL authority cannot cache them.

## Tradeoffs and promotion evidence

Pros: avoid a full pre-DML projection where no statement can change rows; potentially
reduce hashing on satisfied work. Cons: new all-writer/absence proof, more queries
and possible contention, migration/lock-order risk, and a narrower supported shape.
Changing reconciliation timestamps is a separate product contract decision.

Before promotion, hold a real publisher after the proposed final no-change read;
prove same-target insert/delete/cascade and link/evidence writers are coordinated,
unrelated readers still progress, and commit/rollback releases authority. Verify
writer-first freshness, missing/disabled trigger refusal, rollback of required
events, same-size/time byte mutation, lease/cancellation and complete private
durable equality. Profile selected shapes first, then collect the explicit full
matrix at a stable milestone. Do not change pool/deadline policy to pass it.

Recommendation: implement the empty-delete boundary only after those proofs;
defer upsert timestamp suppression and link skipping until their own evidence
exists. The [official research](WANTED_WORKLOAD_REPLAY_RESEARCH_2026_10.md)
informs this proposal; this source audit is not a reproduced security finding.
