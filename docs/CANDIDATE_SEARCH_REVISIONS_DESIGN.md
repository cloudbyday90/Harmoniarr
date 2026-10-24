# Durable candidate search revisions

Date: October 24, 2026. This increment implements revision-bound browsing and
establishes the writer invariant needed to design bounded restart qualification.

## Decision and boundary

Keep one durable UUID revision per source search in PostgreSQL. Four statement
triggers rotate affected revisions atomically with candidate INSERT, UPDATE,
DELETE and TRUNCATE. Backfill existing searches while holding the candidate table
against writers. UPDATE invalidates both old and new searches; no-op updates may
invalidate conservatively. Distinct search IDs are visited in sorted order within
each statement. Revisions have no provider/user payload and never enter responses.

The six current SQL writer modules are import-candidate-repository,
import-candidate-release-recheck-store, import-execution-handoff-store,
music-queue-recovery-store, operator-track-acquisition-store and
operator-track-delivery-progress-store. Database triggers also cover direct SQL,
upsert conflict updates and cascading deletes. Candidate files are not pagination
eligibility inputs: the narrow candidate projection owns that policy. Selection
continues loading current full details through its existing guard.

An ESM store performs one primary-key revision read before a bounded page scan and
one after it. The context digest binds the first revision into the signed cursor.
A changed or missing revision yields the existing 409 refresh contract. A commit
after the final read invalidates the next continuation; an in-flight uncommitted
write remains invisible until commit. No revision read takes a row lock. Existing
first-page retry, focus/status behavior and explicit continuation remain in use.

## Locking, rollback and retention

Candidate writers acquire their existing locks, then affected revision rows in
their AFTER STATEMENT trigger. No command acquires revision locks in this change.
Two writers for one search serialize at that row. Statement-local sorting does
not establish a global transaction order: multi-statement or prelocked candidate
writers can deadlock, and PostgreSQL aborts a participant atomically. Tests must
observe actual blocking and rollback, including this inversion; do not hide it
with automatic retries around provider effects. This contention cost is a reason
to qualify a future command protocol before granting cached authority.

Transition tables let a bulk statement rotate each affected search once. They
also materialize changed rows inside PostgreSQL; this is not a constant-memory
writer guarantee. Migration backfill scans candidate history and blocks writers.
The narrow revision table retains one row per historical search, including deleted
searches. UUID replacement prevents counter reset/ABA reuse if maintenance later
recreates a search; retention policy and privileges must precede pruning. Normal
application writers must not disable triggers or edit the revision table directly.

## Bounded restart qualification design

The current complete transactional restart scan remains the authority. A browser
walk is advisory. Durable source revisions alone cannot authorize an empty-search
certificate: participant quality, wanted state, failed candidate, track scope and
actor authority must also remain current.

The next protocol should persist bounded qualification progress under the existing
platform operation-run ownership, keyed by failed search, policy/recipient digest
and revision. Each step checks at most the existing 200 candidate facts and records
an exclusive anchor; a full budget requires a separate EOF step. Revision changes
discard progress. Found, incomplete, exhausted and invalidated are distinct states.
No client-submitted anchor or boolean grants completion. Progress requires TTL,
coalescing and one bounded record per active qualification, with no page history.

Before a command can consume completion, prove a consistent writer/command lock
order or a serializable protocol covering candidate predicates and revision reads,
including writers that already hold candidate locks. Locking a revision first and
then the failed candidate in the current architecture can invert writer ordering.
Check current actor, participants, quality and track scope inside canonical locks;
commit intent, consumed proof and required audit together. Qualify in-flight insert,
status/policy changes, rollback, replay, TTL, deadlock handling and continuous-write
starvation. Only then replace the full guard. This built-in design adds no service.
