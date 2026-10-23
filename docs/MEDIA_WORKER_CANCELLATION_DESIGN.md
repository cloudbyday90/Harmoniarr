# Durable media worker cancellation design

Decision date: October 23, 2026. Follows the [shared admission outcome](MEDIA_COMMAND_ADMISSION_OUTCOME.md).
See separate [research](MEDIA_WORKER_CANCELLATION_RESEARCH.md) and
[outcome](MEDIA_WORKER_CANCELLATION_OUTCOME.md).

Keep the existing inspection/transcode workers, durable cancellation flag,
maintenance interruption gate, captured leases and shared command FIFO. Add an
instance-owned interruption scope around each media preview/preflight. Poll the
existing cancellation/pause gate once per second while work is pending, with at
most one gate check in flight per scope. The gate can perform multiple SQL reads.
Do not race an abort promise against still-owned work.
Stop the timer and drain an admitted check before returning, then perform a fresh
handoff check. Poll/read failures stop media work and retain the first observed
Error/null. This is an engineering polling default, not a cancellation latency SLA.

Forward each step's AbortSignal through preview file inspection, tooling readiness,
FFprobe, FFmpeg preflight and delivered-track verification. Keep spectral's
optional signal boundary consistent, without claiming its independent durable
job owner is covered. Before any native dispatch, refuse an aborted signal.
After dispatch, retain command capacity through actual process/stdio close.
Cancellation/pause reasons must escape generic media-warning fallbacks.

Preview fan-out must settle all admitted file tasks before returning or throwing;
otherwise an early rejection could allow worker lease release while a sibling
command still runs. Tooling checks similarly retain both binary checks. Preserve
ordinary non-cancellation warnings, current source/target verification and no-signal
call compatibility. Filesystem/SQL calls without native cancellation support are
awaited, with signal checks around subsequent media dispatch and result handoff.

Only after drainage may workers persist cancelled/paused status and release their
captured lease. Worker close remains a graceful drain, not an operator cancel.
No new cancellation endpoint, global controller map, deployed service, dependency,
schema change, memory setting or release is introduced.

Prove queued cancellation without spawn, active cancellation with held native
close, concurrent sibling drainage, pause details, polling cleanup and ordinary
successful behavior. Use real durable stores and the existing cancellation API
where practical; distinguish controlled Node lifecycle evidence from real codecs.
Use the full fast gate once on the stable runtime candidate, affected PostgreSQL
tests and explicit native media qualification. Rebuild local Docker without cache
using the preserved-state walkthrough and verify all mounts/admin/data.

## Reproduction

Use the owned disposable PostgreSQL/container command from the
[shared-container design](DEPLOYMENT_MEMORY_DESIGN.md), with the 3 GiB/two-CPU/
256-PID profile, read-only root and app/database tmpfs. Retain its source and
`testing/server` mounts. Mount `test/native/media-worker-cancellation.test.js`
and `testing/integration/fixture-lifecycle.js` read-only as well; fixture files
are excluded from the runtime image. Invoke
`npm run validate:native-media-worker-cancellation` in that container. The guard
refuses a live database/data bind mount before acquiring a pool.

The two native cases use the production one-second polling policy for held
readiness cancellation, and an explicit 25 ms test policy for active FFmpeg
interruption. Neither establishes a cancellation latency SLA. The existing
command-admission lane and four-case 2/3 GiB shared-memory lane remain separate.
Retain logs on any failure, remove only the exact owned container and verify
its absence before disposing of local evidence.
