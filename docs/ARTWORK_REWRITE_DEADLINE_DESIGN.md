# Artwork rewrite phase deadline design

Decision date: October 23, 2026. Supporting correction discovered while qualifying
[shared media admission](MEDIA_COMMAND_ADMISSION_DESIGN.md). See separate
[research](MEDIA_COMMAND_ADMISSION_RESEARCH.md) and [outcome](ARTWORK_REWRITE_DEADLINE_OUTCOME.md).

Two concurrent-work qualifications returned generic artwork worker failures. A
private instrumented control subsequently observed the rewrite phase timing out
after 3,238 ms, with zero OOM kills. This classifies that control, not every
historical generic failure. The worker's metadata/result framing and original
failure remain intact; new test diagnostics report only exit/signal/byte counts
and kernel peak/OOM counts after cleanup.

Increase the native rewrite phase allowance from three to ten seconds, within
the unchanged 15-second parent-owned child deadline. Best-effort statistics retain
three seconds. Metadata/startup also consume the outer budget; ten plus three is
not a guaranteed completion allowance. Parent timeout still kills and waits for
actual close. Keep single-thread Sharp, no cache, 1 GiB DATA limit, count/weighted
admission, all input/output/pixel caps and shell-disabled execution unchanged.

The gain is tolerance for CPU contention at the supported maximum pixel size.
The cost is potentially more native CPU time before a rewrite-phase refusal.
Retaining three seconds would preserve a tighter phase cutoff but keeps the
observed maximum-size refusal under concurrent media work. Increasing the whole
child deadline or weakening memory controls is unnecessary for this correction.

Qualify the full fast gate after this runtime change, then rebuild without cache.
Run the seven-case image corpus, native worker lifecycle/allocation cases and
both shared-container memory profiles on the rebuilt image. Do not infer a
general deployment minimum, throughput gain or diagnosis of unobserved failures.
