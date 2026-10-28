# Folder browsing measurement research

Consulted October 28, 2026 through MCP search and opened official sources.
Installed production baseline: Node 24.22.1/npm 12.0.2, Linux x64. Network storage
qualification is deferred at the user's request; mapped drives are not evidence
that a chosen mount is a representative or approved benchmark target.

| Official source / status | Applicable practice |
| --- | --- |
| [Node 24 process API](https://r2.nodejs.org/docs/latest-v24.x/api/process.html) — runtime documentation | RSS covers process resident memory; heap fields describe V8; ArrayBuffers are included in external. Report them separately. RSS-only sampling is cheaper than full memoryUsage. resourceUsage maxRSS is a lifetime high-water mark in KiB. |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html) — runtime documentation | opendir bufferSize trades memory for performance. A future controlled buffer experiment must keep page bounds and ownership guards intact. |
| [Node 24 performance API](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html) — preceding Node 24 release documentation; APIs exercised on installed 24.22.1 | Use performance.now for process-relative duration, not wall-clock timestamps. |
| [W3C High Resolution Time, September 2026](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/) — Working Draft, not a Recommendation | Monotonic measurement avoids wall-clock adjustments. Applying that principle to this Node benchmark is an application inference, not a claim of browser conformance. |
| [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints) — implementation guidance | Match CPU/memory limits, disable swap through equal memory/memory-swap limits and inspect actual resource settings. |
| [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) — implementation guidance | Docker Desktop binds cross the Linux VM/Windows host boundary. Label that topology separately from engine-local volumes and actual network storage. Mount consumer fixtures read-only. |
| [Docker runtime metrics](https://docs.docker.com/engine/containers/runmetrics/) — implementation guidance | Container counters and process RSS are different scopes. Cgroup v2 lifetime peak and current memory include charges that cannot be attributed solely to the service call. |
| [Linux cgroup v1 memory](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html) and [v2 controllers](https://docs.kernel.org/admin-guide/cgroup-v2.html) — kernel documentation | V1 usage_in_bytes is approximate; v2 memory.peak is historical. Keep version and precision in the evidence, without resetting host counters or caches. |

## Options and tradeoffs

The kernel's v1 page explicitly warns that parts are outdated. This benchmark
therefore labels v1 usage conservatively as approximate and verifies the actual
counter files and configured limits; it does not infer current implementation
details or exact service allocation from that documentation.

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Production endpoint instrumentation | Measures actual live traffic | Adds observer work and risks paths/data exposure; uncontrolled workload and cache state. Rejected for this task. |
| Repeated work in one Node process | Cheap startup and easy iteration | Retained allocator/JIT state and lifetime high-water marks confound samples. Rejected as the main comparison. |
| Fresh constrained process per sample | Separates process lifetimes, exact packaged code and matched resources | More startup/setup work; host and filesystem caches remain shared. Selected; setup is outside timing. |
| Heap snapshots/allocation profiling | Rich object attribution | Intrusive, potentially sensitive and poorly suited to initial RSS/rescan qualification. Deferred. |

## Final recommendation stack

Use an explicit ESM benchmark CLI with narrow policy, ownership, fixture,
measurement and workload modules. Run the unchanged packaged scanner and a
full-readdir comparator on owned synthetic directories. Use fresh read-only,
network-disabled consumers with equal resources; alternate algorithm order and
include sampling-off controls. Separate fixture creation, import/provenance,
GC and cleanup from measured work. Verify page data and actual handle retirement.
Retain signed memory deltas, sampled RSS peaks and independent lifetime/cgroup
observations; do not add overlapping memory fields or infer allocated bytes.

Compare first-page and three-page work at 1,000, 10,000 and the 50,000-entry
ceiling, including a mixed file/folder case. Preserve refusals as refusals,
not comparable successful timings. Do not change production scan/time/admission
limits from this local sample alone. Real network mounts remain a separate lane.
