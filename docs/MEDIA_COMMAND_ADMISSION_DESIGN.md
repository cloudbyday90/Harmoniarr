# Shared media command admission design

Decision date: October 23, 2026. Follows the [media memory outcome](DEPLOYMENT_MEDIA_MEMORY_OUTCOME.md).
See separate [research/tradeoffs](MEDIA_COMMAND_ADMISSION_RESEARCH.md) and
[outcome](MEDIA_COMMAND_ADMISSION_OUTCOME.md).

Keep the canonical app-owned media command service used by tooling checks,
inspection, preflight encoding and spectral analysis. Reuse `createWorkAdmission`
with an instance-owned FIFO: two active commands, 16 queued commands, a 15-second
queue deadline. These are conservative engineering defaults, not measured RAM
reservations or a deployment minimum. No new service, HTTP endpoint, operator
setting, dependency or schema change is needed.

Validate and snapshot bounded string arguments before admission. A queued caller
cannot mutate the admitted argument array. Refuse already-aborted input before
spawn; queued abort removes only that waiter. Queue saturation/expiry returns a
fixed capacity error without paths or arguments. Existing consumers retain their
current unavailable/failed result contracts. Queue time is separate from the
execution timeout, which begins when the admitted command launches.

Arguments are at most 256 strings and 64 KiB of UTF-8 bytes. Keep the existing
canonical callers' positive execution deadlines and per-stream output bounds;
the internal API still accepts zero to disable its execution timer. This does
not add a universal end-to-end timeout or force-close descendant-owned pipes.
Runtime configuration reports the fixed admission policy without a new setting.

Split admission policy, command facade and native execution into small ESM files.
Every successfully returned child belongs to the executor until actual `close`.
Neither `error`, `exit`, abort, timeout nor a kill request releases capacity.
Remember the first child error, request termination where a process exists and
retain escalation while close is pending. Synchronous spawn failure has no child
to drain. Preserve bounded stdout/stderr capture, shell-disabled execution and
the configured allowlist. Diagnostic hooks cannot escape and orphan execution.

Use deterministic focused tests for FIFO, full/expired/cancelled waiters,
pre-abort, immutable arguments, spawn failure and held-close capacity. Add real
Node process/stdio proof and native FFmpeg/FFprobe consumer qualification. Keep
the larger shared-container codec/scan/artwork/SQL memory lane explicit and run
it against the rebuilt image. Compare packaged changes with reviewed source;
preserve the existing Docker admin/data and all mounts during the no-cache rebuild.

Admission limits command count in one app instance. It does not cap codec memory,
threads, input duration, child descendants or unrelated Sharp/PostgreSQL work.
Canonical consumers currently do not propagate worker cancellation signals down
to every command; this change makes the existing command signal boundary correct
without claiming whole-worker cancellation coverage.

Concurrent native validation also prompted a separate, bounded
[artwork phase deadline correction](ARTWORK_REWRITE_DEADLINE_DESIGN.md). Its
evidence and unchanged whole-child/memory controls are documented separately.

## Reproduction

Run `npm run validate:fast` and the two affected inspection/transcode worker
lifetime integration files once after focused tests. For Linux native commands,
mount `src/server` and `test/native/media-command-admission.test.js` read-only in
the rebuilt image and invoke `npm run validate:native-media-command-admission`.
Use the Node entrypoint (no database initialization), network none, read-only
root, UID 1000, two CPUs, 64 PIDs, 512 MiB memory/equal swap and a 64 MiB `/tmp`
tmpfs. Remove the exact owned container and verify its absence on every outcome.

The larger [shared-container lane](DEPLOYMENT_MEDIA_MEMORY_DESIGN.md) keeps its
separate 2/3 GiB profiles, actual database and four cases. Its encoder and probe
now share one default command service. Neither lane substitutes for the other.
