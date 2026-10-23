# Transactional spectral queue admission

Designed October 23, 2026. This implements the next item from the
[spectral ownership outcome](SPECTRAL_INTERRUPTION_OUTCOME.md). See the separate
[research](SPECTRAL_ADMISSION_RESEARCH.md) and [outcome](SPECTRAL_ADMISSION_OUTCOME.md).

## Failure and invariant

The two production INSERT owners are apply enqueue and retroactive library
enqueue in `source-user-spectral-job-store.js`. Both use COUNT followed by INSERT
within one statement. Concurrent statement snapshots can each see spare capacity;
retroactive NOT EXISTS can also miss another uncommitted insert. Real PostgreSQL
18.3 reproduced two open jobs at cap one for apply/apply and apply/retroactive,
and two open jobs for one retroactive library UUID at cap ten.

The reproducer held the first actual store INSERT uncommitted until the second
actual store INSERT finished. It changed no production SQL. Two earlier fixture
attempts failed: the first requested a third connection from a two-client pool,
and the second used a non-UUID library identifier. Those failures are retained
privately and do not count as race proof.

Cooperating producers must serialize capacity-increasing admissions. Pending and
active both consume capacity. Claim, retry, stale recovery and interrupted claim
release preserve that count; completion/final failure/pruning reduce it. Existing
open retroactive work suppresses another open job for that file; terminal history
does not. Apply jobs retain their current independent per-peer semantics.

## Implementation

A small ESM admission store owns one transaction per eligible insert. It uses the
existing database transaction runner and its original Error/null rollback policy.
Before reading data it explicitly selects READ COMMITTED, sets a local five-second
lock timeout, and acquires one database-scoped transaction advisory lock named
`harmoniarr.source-user-spectral-admission`. Only a separate subsequent INSERT
statement may inspect COUNT/NOT EXISTS, on that same transaction client.

Commit releases admission after the row is visible; rollback releases it without
publishing the row. The timeout propagates as the original database failure,
rather than masquerading as `backlog_full`. It bounds each lock acquisition wait,
not the entire request, pool checkout, SQL execution or a retroactive batch.
No hashing, native analysis, reputation callbacks or claim publication runs under
this admission lock. Workers retain SKIP LOCKED and their captured attempt fences.

Retroactive batches keep one short transaction per valid file and existing
partial-progress behavior. Invalid items skip before checkout. Backlog-full apply
results and retroactive enqueued/skipped summaries are unchanged. Duplicate checks
remain at the persistence boundary even when the catalog source prefilters them.

This is a cooperating-writer guarantee, not a constraint against arbitrary SQL,
an older running binary, a new unguarded producer or terminal-to-open restoration.
Existing duplicates/over-cap rows are preserved and drain normally. Instances must
use consistent cap configuration to claim one global configured maximum. No schema
migration, new service, new branch, release or automatic historical repair is needed.

## Alternatives

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Shared transaction lock plus fresh statement | Covers both cap and existing dedup rule; simple rollback; no migration | Serial producer critical section; all writers must participate | Implement |
| Partial unique index for open library UUID | Database enforcement for duplicate rows | Does not enforce total cap; historical duplicates need a deliberate migration policy | Consider if additional writers appear |
| SERIALIZABLE with bounded retries | Detects conflicting predicate reads | Retry/partial-batch policy and contention cost; every writer must follow it | Defer |
| Process mutex or external queue | Process mutex is cheap; external queue has independent scaling | Mutex misses other processes; new infrastructure duplicates the existing queue | Decline |

## Evidence plan

Use cheap unit tests for same-client ordering, commit/rollback/error identity and
existing return mapping. Real PostgreSQL must prove held admission, fresh state
after commit/rollback, mixed producers, duplicate UUIDs, active capacity, terminal
re-admission, per-file partial commits and bounded lock refusal. Observe lock waits
through an independent owned client when the fixture pool is occupied. Also test
a session default of REPEATABLE READ to prove the explicit isolation choice.

Run focused tests first, then one stable fast gate and selected PostgreSQL
regressions. Rebuild the existing walkthrough without cache, preserve all five
mounts/admin/data and verify packaged SQL behavior separately. Compare exact
runtime/source inventories before deciding which unchanged native memory/media
lanes need repeating. Selected timings do not establish a suite speedup.
