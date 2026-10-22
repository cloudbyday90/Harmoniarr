# Built-in native worker memory

Use for decoder allocation budgets and memory evidence within Harmoniarr. Preserve
the requested deployment boundary: built-in memory management does not require a
new app, daemon, network API or Docker socket. Reuse the current queue/child owner.

## Decide from actual evidence

1. Discover primary Linux, Node, native-library, distribution and OWASP sources
   through MCP. Check versions and distinguish official contracts from inference.
   W3C privacy/data minimization informs exposure; it does not specify an RSS cap.
2. Separate compressed input, decoded pixels/sample depth, retained copies, V8
   reservations, native allocations, RSS and whole-cgroup memory. Heap/cache/thread
   flags and observed peaks are different controls. Do not add external and
   ArrayBuffers counters as independent allocations.
3. Measure the actual pinned runtime with its minimal child environment. A low
   RSS can coexist with large DATA reservations. Treat JIT-less behavior as an
   experimental child-only choice requiring output/deadline upgrade qualification,
   not a general app performance recommendation.
4. Apply Linux soft/hard DATA limits before exec and verify the effective kernel
   limits before intake. Missing limiter/proc evidence must refuse Linux work.
   Non-Linux development does not inherit this kernel guarantee. Account for any
   new maintained OS package separately from unchanged npm dependencies.
5. Use metadata/sample-depth estimates to refuse expensive combinations before
   rewrite, with conservative unknowns. The estimate is admission, not proof of
   allocator behavior. Retain the kernel allocation guard and original close fence.

## Prove the distinction

Keep small policy/framing/consumer tests in the fast gate. Put large allocation
controls and concurrent maximum-policy images in explicit native lanes. Check
actual cgroup profile, original child DATA limits, touched/retained external
buffers, unchanged OOM-kill counters, retired PIDs and exact output hashes.
Drain all siblings before cleanup on both success and failure.

Emit a valid result before a controlled allocation failure and prove zero file/
repository publication until successful close. Refuse combined maximum bytes and
pixels as an owned temporary capacity error, not provider absence/backoff. Native
rewrite messages do not offer reliable structured resource classification; keep
opaque failures temporary and private rather than matching arbitrary error text.

Preserve failed candidate limits/profiles. A later successful run with more CPUs
does not diagnose an earlier opaque error or establish a speedup. Kernel maximum
RSS and whole-container peak have different scopes. DATA is not total RSS, an
independent cgroup, a RAM reservation or a hostile-native-code sandbox. Parent
survival in the allocation control does not prove survival under every host OOM.

Scenario checks: heap-only cap → insufficient for native buffers; low startup RSS
→ inspect DATA reservations; max bytes and max pixels independently pass → test
their combination; valid output then allocation failure → no publication; shared
container → keep aggregate OOM limitation explicit. Do not require a second service.

See [design](../../../../docs/ARTWORK_MEMORY_DESIGN.md),
[research/tradeoffs](../../../../docs/ARTWORK_MEMORY_RESEARCH.md) and
[outcome](../../../../docs/ARTWORK_MEMORY_OUTCOME.md).
