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
