# Selected WebP mixed-workload research

Reviewed October 25, 2026 using MCP search and primary-source retrieval. See
[design](WEBP_SELECTION_MIXED_MEMORY_DESIGN.md) and
[outcome](WEBP_SELECTION_MIXED_MEMORY_OUTCOME.md).

| Official source | Application |
| --- | --- |
| [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints) | Enforce finite CPU/memory; equal positive memory/swap values disable swap. A fresh bounded fixture supplies workload evidence, not a universal capacity promise. |
| [Kernel cgroup v1 memory](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html) | Current usage is approximate. Record kernel lifetime peak and available events separately from process memory and logical reservations; do not add overlapping categories. |
| [Sharp task counters](https://sharp.pixelplumbing.com/api-utility/) | Distinguish queued work from a sampled active native task. An active marker supports a bounded overlap/cancellation observation; it does not establish uninterrupted CPU activity. |
| [Sharp processing timeout](https://sharp.pixelplumbing.com/api-output/) | Native processing time excludes libuv queue wait. Preserve the existing shared acceptance budget and whole-worker deadline/actual-close fence under contention. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Verify truthful checking/queued states through real HTTP. This resource fixture does not replace rendered status/focus or human assistive-technology acceptance. |

The kernel explicitly marks its legacy v1 reference as outdated. Use its limited
accounting explanation alongside the actual detected version and kernel controls;
do not infer current behavior from obsolete tuning guidance. Unavailable v2-style
event fields remain null rather than being reported as zero on this v1 host.

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Extend existing controlled app workload with fixed selected inputs | Reuses actual ownership and comparable controls; isolates the new evidence gap | Instrumentation and fixture setup contribute to peaks. Recommended. |
| Separate application/service for resource management | Separate lifecycle | Duplicates authority and does not prove built-in admission. Reject. |
| Shrink reservation after small observed peaks | Could admit more selected jobs | Finite samples do not bound future allocator/native working sets. Reject for this task. |
| Repeat every unrelated full validation lane | Broad repeated execution | High cost without evidence of affected runtime/driver paths. Retain exact unchanged proof; rerun affected fixture controls. |

Recommended stack: existing built-in admission and full reservation; pinned
inputs; fresh finite container limits; real HTTP/SQL/media owners; active-task
observation and cancellation; publication/queue/actual-close assertions; explicit
measurement limits and evidence retention. This is an engineering inference from
the sources and repository boundaries, not a standards-mandated memory formula.
