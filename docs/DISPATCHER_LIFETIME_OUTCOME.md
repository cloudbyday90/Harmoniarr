# Dispatcher lifetime outcome

October 11, 2026. The baseline supervised stop completed while a queue claim was
held: true instead of expected false. The retained rejected unit log is
.tmp/dispatcher-lifetime-2026-10-11/rejected-unit.log. This reproduces the dispatcher
lifetime gap, not a historical PostgreSQL timeout or authority assertion cause.

## Implemented result

A narrow ESM lifetime factory reuses worker task ownership and work/cleanup error
precedence. Terminal stopAndDrain publishes canonical completion, synchronously
closes tick/claim admission, stops its timer, awaits admitted ticks, then seals
and drains launched handlers. Ordinary dispatcher stop still pauses only the timer;
ordinary start/manual tick can resume until terminal close. Late terminal start
refuses with the fixed dispatcher_closing code; late ticks launch no work.

Checks after readiness/recovery awaits and before every new claim stop further
SQL admission. A committed in-flight claim returning after closure still hands
off exactly once. Neither queued rows nor authoritative claim/lease SQL are
rewritten. Handler execution and optional acknowledgement completion are owned
separately from tick completion, preserving asynchronous dispatch throughput.

Existing queue handlers already return the acknowledgement. Apply supplies real
completion through lease/advisory finalization. Legacy handlers without completion
supply acceptance only; their actual worker work remains follow-up. An invalid
declared completion fails closed. Failed handlers/ticks are reported, observed
and retained for close; automatic timer callbacks consume the observed rejection,
while explicit ticks retain original rejection identity. Reporter fallout cannot
replace a handler error. Tick failure takes precedence over stop/drain fallout,
and every admitted handler still settles before close returns or rejects.

Startup supervision prefers a provided stopAndDrain with its receiver intact.
Reverse stop order remains; its other services keep their existing stop contract.
Dispatcher drainage therefore precedes the existing HTTP/apply-owner/pool teardown.
This is one ownership boundary, not complete application quiescence.

The [design and tradeoffs](DISPATCHER_LIFETIME_DESIGN.md) and
[MCP official research](DISPATCHER_LIFETIME_RESEARCH_2026_10.md) are separate documents.

## Executed evidence

- Final focused controls: 32/32 pass, no failures/cancellations/skips. They cover
  the held-claim reproduction, readiness/recovery closure, no second claim,
  canonical/reentrant close, pause/restart, overlap refusal, sibling drainage,
  original Error/null across reporter failure, stop failure, a failed tick still
  draining its earlier handler, invalid completion, receiver-safe supervision,
  acknowledgement propagation and existing startup/worker composition.
- Affected native group: 8/8 pass, no failures/cancellations/skips. Three new
  PostgreSQL controls prove committed claim handoff after closure, actual apply
  lease release held beyond persisted terminal status, retained null finalizer
  failure, and an unclaimed durable command after closure during readiness.
  The next pending row keeps attempt_count zero and claimed_at null. The
  supervisor waits before resource teardown and preserves the original null
  failure over reporter fallout. Existing operation recovery (3) and apply
  operations/routes (2) also pass. Native TAP elapsed time: 49.42 s.
- Complete fast gate: 4,670 server, 4,384 client and 552 script tests, 9,606 total,
  zero failures/cancellations/skips; static/schema/ESM/image/topology, full lint/
  test-hygiene and both builds pass. Monotonic wrapper elapsed time: 141.61 s.
  Scoped lint passed before the complete gate; npm audit reports zero vulnerabilities.
- Host Node 24.18.1, pg 8.23.0 and pg-pool 3.14.0 were read locally. No dependency,
  schema, route, claim SQL or test scheduling changed.

Commands from the repository root:

```powershell
node --test test/server/operation-dispatcher-lifetime.test.js test/server/operation-queue-dispatcher.test.js test/server/operation-queue-handlers.test.js test/server/startup-service-supervisor.test.js test/server/startup-runtime.test.js test/server/worker-task-lifecycle.test.js
node --test --test-concurrency=1 --test-reporter=tap test/integration/operation-dispatcher-lifetime.test.js test/integration/operation-recovery.test.js test/integration/import-apply-operations.test.js
npm run validate:fast
npm run validate:security:npm
```

These are separate focused/native/fast commands, not a complete native gate or a
matched whole-suite performance comparison. Native implementation inputs remained
unchanged after that passing group; the last added unit controls were included
by the final full fast gate. Raw logs, frozen source/index hashes and MCP responses
remain private under .tmp/dispatcher-lifetime-2026-10-11/.

## Recommendation and remaining scope

Selected stack: durable queue claims and lease fencing; modular ESM tick/launch
ownership; synchronous admission closure; returned worker completion; receiver-safe
supervision; native pool lifetime; bounded diagnostic evidence. Benefit: no
teardown under known dispatcher work and no dropped returning claim. Costs:
shutdown awaits cooperative completion and retains escaped failures; legacy
acceptance, other heartbeat work, HTTP admission and hidden callbacks remain
separate owners. No full-system security or browser/WCAG certification is claimed.

Next: own library-scan completion through its finalizers and expose a per-run
completion handle. Extend fixture/application closure at the actual worker owner,
then audit remaining consumers and periodic work before removing the 150 ms wait.
Use the existing owned-server diagnostics when intermittent failures recur;
historical failure causes remain unconfirmed. Assess exhaustive cohort/remainder
dispatch only with complete membership and matched measurements.

The [fresh PR assessment](OPEN_PR_APPLICABILITY_DISPATCHER_LIFETIME_2026_10_OUTCOME.md)
finds no eligible unreplayed patch. Standards/testing references are maintained
without a new standards entrypoint/metadata/invocation policy. Main only, no
new branch, PR merge or release.

Publication checks match all seven frozen code files in worktree and index.
Eleven changed Markdown documents have 404 resolving local links; whitespace
checks pass. Source/installed standards and the maintained testing skill pass
structural validation, and all four installed standards files match source.
No raw logs, private payloads or connection details are committed as evidence.
