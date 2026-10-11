# Apply worker lifetime design

October 11, 2026. This follows the [pool shutdown repair](DATABASE_POOL_SHUTDOWN_OUTCOME.md).
A controlled held release reproduces two acquisitions for the same run: the
existing worker deletes its active run marker before lease release settles.
Starting work and recording a terminal operation are distinct from completion.

## Selected architecture

Use a narrow ESM task-lifecycle factory for apply-worker admission, active-run
coalescing and completion. Register completion before scheduling. Preserve the
existing asynchronous queued acknowledgement; expose terminal `close()` to
seal new work synchronously and await every admitted task. Coalesce a run through
its entire finally path. Observe escaped failures immediately and retain the
first exact value, including null, for close without accumulating run history.
A refused start launches nothing; scheduler failure settles its registered work.

The queued acknowledgement contains a per-run `completion` promise. Awaiting
start still does not await execution; resource owners can retain the handle and
await it before mutating shared fixture state. The media fixture now reads one
terminal row after that actual completion instead of polling status every 100 ms.
A controlled native gate reproduced the old helper reading status before final
lease release. This gap is independently proved; it is not attributed as the
cause of an unreproduced full-run authority assertion.

The lease heartbeat gains additive `stopAndDrain()`: stop tick admission and
its timer, then await actual admitted renewal work. Existing ordinary `stop()`
behavior stays compatible for other owners. Apply cleanup awaits that drain
before releasing the captured lease, attempts release even after drain failure,
and retains an already escaping primary error over cleanup fallout.

Each run also owns returned advisory work: spectral enqueue, notifications,
release callbacks and activity fanout. A narrow advisory scope registers before
invoking callbacks, retains existing best-effort outcome policy, and drains at
cleanup after terminal domain status. The execution/cleanup adapter preserves
Error/null precedence without throwing from a finally block. Queued child scans
and effects hidden behind callbacks that do not return their work remain separate
owners; this slice does not cancel them or certify their completion.

App-fixture entry points await their actual application's apply-worker close
after HTTP closure and before pool/workspace/environment teardown. A small
fixture adapter preserves scenario Error/null failures over worker cleanup
failure. A distinct approved `app_worker_drain` phase observes this boundary.
Production shutdown also closes this worker before its pool. This is one worker
owner; the other workers and in-progress periodic dispatch remain separate.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| More fixed sleep | Small edit | No completion proof; reject |
| Return execution from start | Simple caller await | Changes the await boundary for existing queued-acknowledgement callers; reject |
| Return a queued completion handle | Preserves acceptance timing and lets reusable consumers await one run | Adds an internal acknowledgement field; select |
| Track actual completion behind start | Preserves durable queue behavior and coalesces cleanup | Adds explicit terminal close; select |
| Stop heartbeat timer only | Existing behavior | Leaves current renewal running; add observed drain for apply |
| Cancel arbitrary I/O on shutdown | Potentially shorter wait | Unsafe mid-mutation without cooperative ownership; defer |
| Replace the fixture delay globally | Removes overhead | Other workers remain unowned; defer |

Stack: existing durable operation queue and lease fencing; modular ESM task owner;
captured heartbeat renewal drainage; application-owned fixture drain; pg native
pool completion; bounded diagnostics; controlled gates and serial native tests.
Current primary sources and their status are in the separate
[research ledger](APPLY_WORKER_LIFETIME_RESEARCH_2026_10.md).

## Scope and evidence

The 150 ms delay remains for residual owners. Successful apply-worker close is
not a certificate that every app task, provider request or filesystem effect has
stopped. Domain failures already persisted by the worker stay domain outcomes;
escaped startup/finalizer failures must be observable at close. No arbitrary
error prose, task inputs, SQL or connection details are added to diagnostics.
There is no new job system, route, schema, release, branch or PR merge.

Prove held final lease release, duplicate admission, close before queued launch,
late refusal, scheduler failure, multiple tasks draining after one failure,
Error/null identity, and an actual held renewal before release. Native gates
must keep the scenario database and workspace available until release settles,
then reject late admission. Preserve original HTTP/scenario errors. Validate the
stable production candidate with the full serial gate using verified media
prerequisites; keep focused development tests smaller.
