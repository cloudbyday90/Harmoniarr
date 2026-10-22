# Aggregate artwork fetch admission

Decision: October 22, 2026. Follows [connection-time egress](ARTWORK_EGRESS_OUTCOME.md).

The application already shares one artwork fetch-service instance between routes
and monitored-artist prefetch. Give that instance a FIFO admission owner with two
active resolutions, at most 32 waiting resolutions and a 15-second queue wait.
These conservative defaults are project choices, not vendor-prescribed limits.
No process-global singleton, new dependency, database setting or Sharp-global
tuning is required. Separate service instances and application processes have
independent budgets.

Admit before policy/cache/provider work so waiting closures hold request metadata,
not downloaded images. Read policy after admission. Hold each slot through all
returned provider retries, image download, inspection/rewrite, filesystem and asset
publication, assignment, stale-assignment cleanup and backoff/quota completion.
Never release a slot just because an abort or timeout won a race against active
work. Existing image deadlines remain separate from queue deadlines.

Queued AbortSignals remove waiting work without dispatch. Once admitted, work
retains its original completion contract; cancellation does not undo publication
or abandon unreturned native work. This round adds the service-level queued
cancellation capability, not HTTP-disconnect or worker-cancellation propagation.
Timers/listeners are removed on queued refusal or admission. Monotonic expiry is
also checked at handoff so an overdue queued task cannot beat its delayed timer.

Replace eager batch Promise.all with two lazy producers and retain the existing
50-item limit at the service boundary as well as the route. Individual calls and
overlapping batches use the same gate. Ordinary per-item failures keep existing
empty-result behavior. Capacity/cancel errors escape after all batch workers drain;
they must not look like an empty provider catalogue or record provider backoff.
Some earlier batch items can already have completed when capacity refusal occurs.

The cap bounds outstanding provider resolutions and their concurrent byte/pixel
work. It is not a hard RSS/native-memory cap. Original buffers, rewritten buffers,
Sharp statistics, caches, allocators and other artwork ingestion/derivative owners
can consume additional memory. Keep existing per-image byte/pixel limits and
deployment resource controls. Do not change Sharp.concurrency or UV_THREADPOOL_SIZE
as a substitute for application admission.

Validate FIFO, overflow, monotonic expiry, cancellation and Error/null release,
then actual service composition across download/decode/publication and overlapping
batch/single calls. Qualify real TLS/Sharp/files separately in an owned fixture,
with controlled database sinks. See [research](ARTWORK_ADMISSION_RESEARCH.md) and
[outcome](ARTWORK_ADMISSION_OUTCOME.md).
