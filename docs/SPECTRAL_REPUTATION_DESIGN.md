# Atomic spectral reputation publication

Designed October 23, 2026 from the [admission follow-up](SPECTRAL_ADMISSION_OUTCOME.md).
See separate [research](SPECTRAL_REPUTATION_RESEARCH.md) and
[outcome](SPECTRAL_REPUTATION_OUTCOME.md).

## Reproduced failure

An actual Node consumer was stopped after the prior store committed spectral
completion and entered the reputation callback. The child closed, its job was
done, no pending work remained, and the outcome ledger was empty. Separately,
the canonical evidence service swallowed an injected ledger failure: the job
completed and snapshot failure count became one, but the ledger remained empty.
Both cases used real PostgreSQL and unchanged production services. Private
baseline hashes and cleanup evidence are retained.

## Selected boundary

Cache, job, outcome ledger and trust snapshot all live in the same PostgreSQL
database. Publish those four effects in the captured spectral-claim transaction.
Use the job UUID as the ledger event's existing primary key and history identity.
The current active attempt fence prevents successful completion replay; a duplicate
event key refuses the whole transaction. Rollback removes ledger and counter
changes together. A returned commit is the durability boundary, even if the
consumer exits before receiving its result.

No additional service, queue, outbox table or migration is needed. An outbox would
be appropriate for required delivery to a different system; it would introduce
claim/retry/retention policy here without improving the same-database atomic write.
Do not backfill historical completed jobs: the old callback lacked a stable event
identity, so an automatic replay could duplicate already-recorded penalties.

A short-lived publication queryable belongs to the captured claim invocation.
Strict spectral recording refuses absent, expired or foreign publication authority
and verifies its job ID. Its internal calls carry that same queryable; no nested
pool checkout or swallowed durable-write failure is allowed.

## Shared snapshot ownership

The recovery trust snapshot currently replaces the entire set of JSON rows.
Atomic spectral increments alone would still race older read/modify/replace
writers. Route canonical outcome, manual trust override, block and unblock
mutations through one database transaction lock acquired before their fresh read.
Full restore/replacement participates in the same lock; an intentional full
replacement still replaces the snapshot. Read-only views do not need the lock.

Keep SQL and lock ownership in a narrow snapshot store. A service adapter retains
existing injected in-memory test contracts; strict spectral work requires the
transaction-capable mutation dependency and fails closed without it. Both ordinary
and borrowed publication transactions explicitly use READ COMMITTED before their
admission read. Keep global lock order spectral row → snapshot admission; snapshot
mutators must not acquire spectral rows. Bound lock waits, and keep native decoding
and advisory callbacks outside this section.

Notification and opt-in auto-ignore callbacks run only after successful commit.
Await their returned work in the spectral path, but do not promise durable or
exactly-once delivery of notifications or hidden descendant work. Retroactive,
authentic, suspicious and inconclusive jobs create no spectral penalty.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Same transaction for all durable effects | Immediate consistency; rollback/replay proof; existing infrastructure | Short global snapshot critical section; whole-snapshot rewrite remains costly | Implement |
| Transactional outbox and idempotent consumer | Durable delivery across system boundaries | More state, retries and cleanup; snapshot still needs atomic mutation | Defer until a required external sink exists |
| Retrying the old callback | Small change | Can duplicate partial ledger/counter writes and lose work after process exit | Reject |
| Ledger-only atomic write | Durable recency evidence | Operator counts/history can disagree permanently | Reject |

Stack: existing claim generation → scoped transaction queryable → atomic ledger,
snapshot, cache and job writes → post-commit advisory callbacks. Preserve existing
queue admission, native command limits and memory controls separately.

## Qualification

Prove actual child exit before and after commit, failure at each durable write,
Error/null rollback, stale-claim refusal, duplicate event-key refusal, concurrent
same/different-peer evidence and all cooperating snapshot mutation directions.
Observe real lock blocking through an independent owned connection; release and
drain every participant before fixture cleanup. Test explicit isolation defaults,
publication-scope expiry/reuse and both canonical app composition boundaries.
Use focused tests before one stable fast gate and selected PostgreSQL/native
checks. Rebuild the preserved walkthrough without cache and compare immutable
runtime artifacts before deciding whether unrelated allocation lanes need repeats.
