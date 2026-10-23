# Shared native command ownership

Use for FFmpeg/FFprobe admission, command cancellation or execution refactoring.
Read the [design](../../../../docs/MEDIA_COMMAND_ADMISSION_DESIGN.md) and
[official research](../../../../docs/MEDIA_COMMAND_ADMISSION_RESEARCH.md).

Trace the one app-owned media command service through tooling, inspection,
preflight and spectral callers. Independent per-consumer FIFOs do not bound the
canonical aggregate. Keep policy in `media-command-admission.js`, request bounds
in the facade and actual process ownership in `media-command-process.js`.

Bound waiters and queue age separately from active count, execution time and
captured output. Snapshot bounded string arguments before queueing. Report fixed
capacity errors and numeric counts without paths/arguments. Count admission is
not a memory reservation, codec containment or an RSS limit.

Before spawn, cancel without launching. After a child is returned, own it through
actual process/stdio close. Preserve the first child Error/null, retain termination
escalation and never signal an already-exited PID. Exit, error, kill return and
an aborted caller are earlier boundaries. Diagnostic callback failures must not
escape into an early slot release or prevent termination.

Prove the canonical wiring, FIFO/full/expired/cancelled waiters, immutable args,
synchronous spawn refusal and held-close capacity. Use actual Node cancellation
and Linux descendant-held stdio separately from codec evidence. For actual media,
queue all four consumers behind one owned fixture process, then execute real
FFmpeg/FFprobe commands and verify output/source preservation after close.
Do not interpret a Windows pipe-inheritance setup as Linux close evidence.

The explicit lane is `validate:native-media-command-admission`. Keep shared
container sizing in `validate:native-deployment-media-memory`, using one shared
service for encoder/probe workers. Those lifecycle and selected-memory lanes
do not prove signals propagate from every durable worker or establish a general
deployment minimum. See the [outcome](../../../../docs/MEDIA_COMMAND_ADMISSION_OUTCOME.md).

## Durable cancellation propagation

For inspection/preflight cancellation, follow the
[cancellation design](../../../../docs/MEDIA_WORKER_CANCELLATION_DESIGN.md). Keep
durable operator/pause checks authoritative, with one serialized poll per owned
step and a fresh handoff check. Stop/drain the observer before terminal status;
do not reinterpret worker close as an operator cancellation request.

Propagate the same signal through readiness, preview file inspection, delivered-
track verification and native execution. Recheck abort outside generic warning
fallbacks. Null is a valid reason; use `throwIfAborted`, not a truthy reason test.
Drain all preview siblings and both tooling checks before returning an error.
Promise rejection alone does not establish native or lease retirement.

Use the default one-second policy with durable-store controls, plus actual Linux
held-SIGTERM close and real encoder cancellation in
`validate:native-media-worker-cancellation`. Its 25 ms codec control is a test
setting, not a production latency claim. SQL/filesystem reads still drain normally;
spectral accepts a signal but its separate job owner has no new durable polling.

## Lease observation and media interruption

Use the [lease interruption design](../../../../docs/MEDIA_LEASE_INTERRUPTION_DESIGN.md)
when media outlives ownership. Forward the existing heartbeat's signal into each
step scope; do not add a parallel lease watcher or infer current authority from
an unexpired local timestamp. Null renewal confirms loss; a thrown renewal reason
is uncertainty and must retain its original Error/null, separate from loss.

Retain the first observed failure, pre-abort refusal, one-shot removable listener,
pending-read drainage and actual native close. Confirmed loss skips terminal run
writes. Cleanup stops/drains the heartbeat then releases only the captured
acquisition; expiry permits own release, replacement refuses it. Preserve database
fencing even after notification. Shutdown remains a graceful drain.

Qualify both media owners through real PostgreSQL replacement during readiness,
queued admission and active execution; include expired-own release and unchanged
replacement/run rows. The explicit native lease lane uses an actual renewal tick
after replacement to interrupt Linux held-SIGTERM and real encoding. It does not
establish a 60-second detection bound or replace other workers' ownership proof.
