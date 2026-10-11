# Dispatcher lifetime design

October 11, 2026. A controlled baseline proves supervised shutdown completes
while a queue claim is held (true instead of expected false). Timer stop does
not own admitted SQL or launched handlers. Follow the
[previous outcome](POSTGRES_FAILURE_EVIDENCE_OUTCOME.md).

## Selected ownership

Add a narrow ESM dispatcher lifetime factory using existing worker completion
and primary/cleanup precedence services. Register ticks and launches before
execution. Preserve nonoverlapping ticks, ordinary timer stop/restart and queued
acceptance. Add terminal stopAndDrain: synchronously close admission, stop the
timer, await admitted ticks, then seal/drain launched handlers. Publish one
canonical close promise before invoking stop hooks.

Check admission after readiness and recovery awaits and before every new claim.
If an already admitted claim returns a committed run after closure, launch that
one run exactly once, then stop claiming. Do not discard committed claims,
rewrite durable pending rows or invent a shutdown retry policy. Keep PostgreSQL
claim SQL, leases, required audits and authorization unchanged.

Track handler invocation through its returned promise and an optional queued
acknowledgement completion promise. Existing queue handlers already return the
worker acknowledgement. The apply worker supplies completion; other legacy
workers currently supply acceptance only. Missing completion is not proof of
their native work stopping. Library scan and remaining consumers are follow-up.

The startup supervisor prefers stopAndDrain when provided, preserving receivers
and reverse stop order. Its ordinary stop contract remains compatible for other
services. Dispatcher drainage therefore precedes HTTP/apply-owner/pool teardown
in existing startup wiring. Other heartbeat work and HTTP admission have separate
owners; this is not whole-application quiescence.

Automatic timer calls consume retained tick rejections to avoid unhandled
promises. Explicit manual ticks still expose the original error. Handler errors
are reported through the existing callback, retained for close and observed
immediately; reporter fallout does not replace the handler error. Tick failure
wins over timer-stop and handler-drain fallout, while every admitted handler is
still drained. Error/null identity and close failure remain observable.

## Alternatives and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Stop only the timer | Compatible pause | Does not drain claims/handlers; keep for ordinary pause |
| Replace all stop behavior with terminal close | Smaller surface | Breaks restart/manual use; reject |
| Add terminal stopAndDrain | Explicit shutdown ownership | New lifecycle boundary; select |
| Drop a claim returning after closure | Fast exit | Leaves committed admission without handoff; reject |
| Await each handler during tick | Simple completion | Serializes queue dispatch and changes throughput; reject |
| Own launches separately through optional completion | Keeps asynchronous dispatch | Legacy acceptance remains a limit; select |
| Remove fixture sleep globally | Less fixed overhead | Other workers still unowned; defer |

Stack: durable PostgreSQL claims/leases; modular ESM tick and launch ownership;
synchronous admission closure; captured worker completion; receiver-safe
supervision; native pool completion; bounded failure evidence; controlled gates.
The separate [research](DISPATCHER_LIFETIME_RESEARCH_2026_10.md) records official
contracts and distinguishes project choices from standards requirements.

## Proof and limits

Prove held committed claim handoff with no second claim; readiness/recovery closure;
multiple handler drainage after Error/null failure; reporter fallout; timer stop
failure/reentrancy; startup manual/automatic tick failure; late start/tick refusal;
ordinary pause/restart; actual PostgreSQL claim and apply lease finalization
before pool closure. Keep original deadlines, durable queue semantics and the
150 ms fixture wait. No schema, route, release, branch or test scheduling change.
