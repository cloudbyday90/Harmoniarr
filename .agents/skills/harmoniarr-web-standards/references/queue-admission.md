# Durable queue admission

Use when changing backlog limits, enqueue deduplication or transitions that
increase open work. The current spectral example is in the
[design](../../../../docs/SPECTRAL_ADMISSION_DESIGN.md) and
[research](../../../../docs/SPECTRAL_ADMISSION_RESEARCH.md).

## Establish what must remain true

Inventory every INSERT and transition into counted states, including retry,
restore and recovery. Identify which transitions preserve or reduce capacity.
Name the actual deduplication identity and its lifetime; repeated apply jobs for
different peer evidence must not silently become one library-file job.
Read producer return contracts, batch partial progress and effective cap settings.

A prefiltered source or a COUNT/NOT EXISTS INSERT proves neither concurrent
capacity nor duplicate exclusion. A process mutex also misses other processes.
Reproduce through the actual store SQL with a held uncommitted insertion and
another independently owned client; do not replace the production query with a
synthetic equivalent and claim the original code was exercised.

## Select the authority boundary

Compare a database constraint, shared transaction admission and SERIALIZABLE
retry policy. A partial unique index can enforce a deduplication identity but
does not enforce a total backlog count. Historical duplicates require an explicit
data policy before adding it. Document whether the selected guarantee covers all
database writers or only cooperating application writers.

For cooperating admission, use the same fixed database lock key in all relevant
producers. Own BEGIN through commit/rollback on one client. Acquire a transaction
lock first, then read capacity/deduplication in a separate READ COMMITTED statement.
A CTE that puts locking and counting in one statement can retain an earlier
snapshot after waiting. REPEATABLE READ also defeats this fresh-read premise;
set isolation before data access rather than assuming a session default.
Session locks have different rollback lifetimes and are unsuitable substitutes.

Keep native work, callbacks and worker claim publication outside producer
admission. Bound lock waits in the owning scope and explain what the timeout
does not bound. Never relabel a SQL failure as ordinary backlog exhaustion.
Preserve per-file batch commit behavior unless a new atomic batch contract is
intentional. Do not prescribe spectral's five-second policy for unrelated queues.

## Prove the implementation

Use cheap ordering/error tests plus actual PostgreSQL contenders at the last
slot, mixed producer directions, duplicate identity with spare capacity,
commit/rollback handoff and Error/null. Change session isolation defaults to
expose accidental reliance on READ COMMITTED. Confirm active capacity, terminal
re-admission, worker progress during admission and partial batch failure.
`validate:native-spectral-admission` reuses these ten scenarios against packaged
PostgreSQL, guarded by the disposable deployment-memory profile. It is separate
from spectral native process interruption and does not measure memory sizing.

Observe actual lock waits with an independent owned-config client when the
fixture pool's two clients are occupied. Release every gate and settle contenders
before disposal; a failed wait assertion must not leave a blocked transaction.
Validate literal test paths before launch. Run focused tests before one stable
fast gate and affected native SQL lanes. Keep timing, cleanup and deployment
evidence separate; selected passing tests do not establish a faster full suite.

Record discovered official sources, consultation date, source status and the
project inference. W3C privacy guidance supports minimized evidence; it does not
certify SQL concurrency or accessibility. Keep paths, peer names and credentials
out of committed race evidence. Carry forward the actual remaining limitation,
including nonparticipating writers or conflicting instance cap settings.
