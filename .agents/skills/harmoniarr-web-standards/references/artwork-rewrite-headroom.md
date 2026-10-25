# Artwork rewrite accounting and native abort diagnosis

Use for child admission or native rewrite memory changes. Read active-repo
docs/ARTWORK_REWRITE_HEADROOM_DESIGN.md, research/outcome and
[worker memory](worker-memory.md).

- Reproduce with the pinned runtime and unchanged limits. Keep private stderr
  bounded and phase records fixed; never add raw native diagnostics to HTTP or
  worker result frames. Sampling itself can change timing/allocations. A passing
  instrumented run cannot locate an earlier opaque failure.
- Distinguish observed failure stage/message, actual child limit, kernel counters
  and inferred cause. GLib allocation abort bypasses a JS catch. Without a stack
  or syscall trace, do not name the backing allocation or claim which limit denied it.
- Reuse `artworkWorkerMemoryEstimate` in child and parent. Its runtime, original,
  output and decoded allowances are planning values, not independent RSS promises.
  Do not restore a smaller child formula or raise limits just to pass an image.
- Inspect metadata, then refuse before its frame/grant handshake, rewrite and
  statistics. Require the actual memory
  refusal frame, exit 1/no signal, no publication and owned close/reservation/lease
  retirement for the fixed maximum regression. Historical SIGABRT containment
  evidence does not satisfy the repaired regression.
- Pair exact-boundary/owner-order checks with the existing lifecycle, allocation,
  strict corpus and mixed profile lanes. Preserve accepted maximum-pixel RGB and
  maximum-byte behavior. Keep heavy work opt-in and acknowledge the two changed
  production modules when retaining unrelated SQL/browser/provider evidence.
- For the two large maximum fixtures, release the first scan-tag gate at actual
  artwork spawn. Keep ordinary scheduling and the real encoder unchanged; cleanup
  releases unconditionally. A timed scan completing before a large TLS body must
  not be repaired by removing overlap assertions or by retrying until it passes.
