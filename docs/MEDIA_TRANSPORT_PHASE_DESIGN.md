# Owned media transport measurement design

The [inspection owner outcome](OWNED_MEDIA_EXECUTOR_OUTCOME.md) retained every
inspection but measured a slower small whole command. Separate actual Docker CLI
round trips before replacing that transport. This slice adds optional ESM
observation and a safe workload summary; it does not authorize removing checks.

Use twelve fixed phases for image lookup, create/start and startup inspections,
command before/exec/after, retirement before/stop/after and removal before/remove.
Measure only the returned CLI promise with one monotonic process clock. An exec
window includes CLI/daemon/codec/stdio work; it cannot isolate ffprobe CPU time or
attribute host process startup without a separate comparator. Serial transport
windows do not overlap; queued caller media spans can overlap and remain separate.

Keep twelve aggregate rows per owner, with bounded started/completed/failed/pending
counts and valid-duration total/min/max/untimed counts. Cap admitted observations
at ten thousand and report clipping. Never retain argv, paths, image/container IDs,
stdout/stderr or error prose. Invalid clocks leave timings unknown and preserve
the original Error/null. Snapshot copying and public capture whitelist only fixed
fields. Disabled observation does not read a clock or allocate per-command rows.

The explicit owned distinct/source workload records `--media-diagnostics on|off`.
Publish one summary after actual executor close, including failure, while retaining
the body/close original failure through optional sink errors. Reports hold at most
twelve owner summaries and mark clipping. Counters describe returned CLI calls,
not successful ownership verification: a completed inspect can still fail its
configuration checks, and final workspace safety is reported separately.

Validate held work, Error/null, unavailable clocks, bounds/privacy, snapshot
stability and observed counts matching native invocations. Run an off/on selected
canonical pair on frozen shared code to qualify diagnostic overhead. Keep pool,
deadline, generation, actual inspection and private comparison contracts. Retain
earlier failures and the incomplete largest matrix as independent evidence.

Recommend bounded phase evidence before an Engine API implementation. A persistent
connection could avoid host CLI launches but needs version/context, bounded HTTP
and multiplexed stream, cancellation and acknowledged cleanup proof. No broad
default promotion, new branch or release belongs to this measurement slice. See
the separate [official research](MEDIA_TRANSPORT_PHASE_RESEARCH_2026_10.md) and
[outcome](MEDIA_TRANSPORT_PHASE_OUTCOME.md).
