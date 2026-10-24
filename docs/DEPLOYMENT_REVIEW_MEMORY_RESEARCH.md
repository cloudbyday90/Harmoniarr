# Mixed workload research and recommendations

Consulted October 24, 2026 through connected Search MCP search and official page
reads. URLs were discovered from search or re-opened from previously researched
official sources. Actual deployed Node is 24.22.1, PostgreSQL 18.6 and FFmpeg 8.0.1.
The selected host exposes cgroup v1; v2 guidance is not substituted for v1 counters.

| Official source / status | Applied decision |
| --- | --- |
| [Node 24.22.1 process memory](https://r2.nodejs.org/docs/latest-v24.x/api/process.html), vendor documentation | RSS, heap, external and ArrayBuffers have different meanings; ArrayBuffers is included in external. Record them separately. |
| [Linux cgroup v1 memory](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html), kernel documentation | Label usage approximate, keep failcnt and OOM kills separate, retain hierarchical categories without summing shared pages. |
| [Linux cgroup v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html?highlight=freezer), kernel documentation | Current/peak/events include cgroup workloads; distinguish sampled current from lifetime peak and verify actual version. |
| [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints), vendor documentation | Verify configured memory, swap, CPU and PID constraints rather than relying on a declared profile or treating a limit as a reservation. |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), security guidance | Keep measurement output bounded and exclude session identifiers, credentials and private source data. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), informative WCAG 2.2 guidance | Observe actual checking versus queued status through existing authenticated routes. HTTP status evidence does not prove screen-reader announcements; existing browser evidence and deferred human acceptance remain distinct. |

## Alternatives

| Option | Pros | Cons / recommendation |
| --- | --- | --- |
| Infer memory from serialized facts or Node RSS alone | Cheap | Omits native children, PostgreSQL and page cache; reject |
| Launch independent component benchmarks and add peaks | Reuses measurements | Shared counters overlap and peaks need not coincide; reject |
| Add a second deployed app or auto-tune limits from free RAM | Simple apparent isolation/control | Changes architecture or policy before evidence; reject |
| Measure actual bounded app/HTTP/owned-worker/native composition | Exercises current policy, transport and resource owners together | Synthetic catalogue, selected concurrency, host scheduling and sampling limit extrapolation; adopt |
| Fake children or delays for resource measurements | Deterministic | Cannot qualify actual native memory/overlap; retain only for observer unit tests |

Final stack: guarded disposable profile → existing single app and embedded database
→ bounded real HTTP and owned worker operations → existing media/artwork admission
→ actual response/spawn/close observations → separate kernel/process/logical/latency
evidence → verified drainage and retirement. Retain current controls unless these
measurements or a broader workload demonstrate a concrete need to change them.
