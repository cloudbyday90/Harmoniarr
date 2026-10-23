# Media lease interruption design

Decision date: October 23, 2026. Follows the
[durable cancellation outcome](MEDIA_WORKER_CANCELLATION_OUTCOME.md). See separate
[research](MEDIA_LEASE_INTERRUPTION_RESEARCH.md) and
[outcome](MEDIA_LEASE_INTERRUPTION_OUTCOME.md).

Give each existing operation-run lease heartbeat a read-only AbortSignal. An
explicit null renewal or missing captured acquisition aborts with a fixed
`operation_run_lease_lost` error. A thrown renewal failure aborts with its original
reason, including null, before optional error reporting. Do not classify a failed
database call as confirmed lease loss. Keep the signal sticky and preserve existing
tick result/error-reporting contracts for other heartbeat consumers.

The inspection/transcode workers consume that signal in the existing step-owned
interruption scope, alongside durable operator/pause polling. Refuse an already
aborted step before work starts; retain the first observed failure and drain work
and pending checks after notification. Remove the step listener on settlement.
Check the heartbeat signal at worker handoffs before starting another step or
attempting completion. Worker shutdown still drains rather than aborting.

Do not add lease polling, change the heartbeat interval (60 seconds), or infer
expiry from a local timer. This is interruption after observed renewal refusal or
failure, not a lease-expiry or cancellation latency guarantee. Non-media consumers
keep their current behavior unless they explicitly consume the new signal.

Confirmed loss must not write an operation-run terminal status. Drain native
process/stdio close, stop and drain admitted heartbeat work, then attempt only the
captured acquisition's existing fenced release with cleanup status `failed`.
An expired acquisition can release itself; a replacement acquisition must remain
untouched. A renewal exception uses the ordinary fenced failure path. Database
locks and current acquisition/run checks remain authoritative in either case.

Prove immediate/pre-aborted loss, no-checker compatibility, Error/null identity,
first-failure ordering, observer cleanup and held native close. Use real PostgreSQL
to replace acquisitions during readiness/queued/active media work for both owners,
and retain replacement rows/run state after stale completion. Qualify Linux
SIGTERM-to-close and actual FFmpeg interruption separately. Run focused checks,
the full fast gate once stable, affected integration/native lanes and the local
no-cache preserved-state Docker walkthrough. No endpoint, migration, dependency,
new deployed service, release or branch is introduced.

## Native reproduction

Use the owned disposable Linux PostgreSQL/container command and guarded 3 GiB,
two-CPU, 256-PID profile in the
[deployment memory design](DEPLOYMENT_MEMORY_DESIGN.md). Retain its source,
`testing/server` and provider-HTTPS fixture mounts. Add read-only mounts for
`test/native/media-worker-lease-interruption.test.js` and
`testing/integration/fixture-lifecycle.js`; invoke
`npm run validate:native-media-worker-lease-interruption`. The profile guard
refuses live database/data bind mounts before opening a pool. The fixture replaces
the lease and explicitly invokes the real renewal tick to observe refusal; this
does not change production scheduling or establish a detection-time bound.
Retain failure logs and remove only the exact owned container, verifying absence.
