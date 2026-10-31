# Concurrent folder scan research and recommendations

Researched October 31, 2026 through MCP search and opened official sources.
See [design](FOLDER_BROWSE_CONCURRENT_DESIGN.md) and
[outcome](FOLDER_BROWSE_CONCURRENT_OUTCOME.md).

Node documents that larger opendir buffers trade memory for performance, with
32 as the default. Directory close returns a Promise fulfilled after resource
closure. Compare 32/128 through the real guarded service and retain admission
until that Promise settles. The current v24 documentation serves 24.22.2; the
qualified immutable runtime is 24.22.1.
[Node filesystem documentation](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html).

RSS covers the process, including native memory. Heap, external and ArrayBuffer
fields overlap; they must not be summed. Fast RSS sampling is preferable to
repeated full snapshots. Process maximum RSS is a lifetime high water mark in
KiB, including startup; immediate GC snapshots do not establish a leak bound.
[Node process documentation](https://r2.nodejs.org/docs/latest-v24.x/api/process.html).

Use actual inspected resource limits. Equal memory and memory-swap values disable
swap; CPU limits constrain capacity without isolating other host activity.
Retain the existing two CPUs, 1 GiB memory and zero-swap container configuration.
[Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints).

Container and process memory answer different questions. Kernel cgroup current
usage includes charged memory beyond process RSS; peaks include the container's
lifetime. On v1, current usage is approximate. Preserve that label and do not
interpret a lifetime peak as an exact work-window peak or add it to RSS.
The v1 documentation warns that it is outdated; the actual runtime interface
must determine which counters are used.
[Kernel cgroup v2](https://docs.kernel.org/7.0/admin-guide/cgroup-v2.html),
[Kernel cgroup v1](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html).

Use monotonic elapsed time for performance. W3C High Resolution Time explains
why wall-clock adjustments distort duration measurements. Its September 1, 2026
publication is a Working Draft, not a Recommendation. This informs measurement
practice; the benchmark's Node clock is not a browser conformance claim.
[W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/).

| Choice | Pros | Cons / decision |
| --- | --- | --- |
| Guarded built-in scanner, buffer 32 | Existing admission, deadlines, bounded selection and lifecycle | More native buffer refills; retain until qualification supports a deliberate change |
| Buffer 128 through a test adapter | Prior local elapsed/CPU benefit; measures four scans together | Larger internal buffers; host/cache/storage sensitivity; opt-in only |
| Four calls in one service/process | Exercises shared admission and aggregate process memory | Directory streams share OS caches and threadpool; not four isolated users |
| Separate controlled lifecycle lane | Verifies busy/cancel/close boundaries without timing the barriers | Held delivery is controlled instrumentation, not proof of kernel I/O cancellation |
| Fresh consumers and balanced adjacent pairs | Separates lifetime peaks and records order | Does not clear host caches or eliminate load variation |

Recommended stack: existing built-in service and hard guards; fixed opt-in
four-scan 32/128 experiment; independently checked pages and complete outcomes;
separate process/container scopes; explicit cancellation/close controls; one
stable fast gate and narrowly retained unrelated runtime proof. Keep every slow
success and refusal. Do not derive adaptive tuning or whole-app RAM requirements
from this local scanner experiment. Network/NAS checks remain deferred.
