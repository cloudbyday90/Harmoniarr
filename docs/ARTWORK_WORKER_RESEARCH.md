# Artwork process worker research and recommendation

Official sources discovered through the search-service MCP on October 22, 2026.
Version-specific Node documentation was opened and reports Node 24.22.1. Sharp's
official navigation identifies 0.35.5, September 27, 2026. These are current checks,
not assumptions about later releases.

## Sources and application

- [Node 24 worker threads](https://r2.nodejs.org/docs/latest-v24.x/api/worker_threads.html):
  worker resource limits govern the JS engine, exclude external buffers and do
  not prevent process-wide out-of-memory failure. Therefore worker-thread heap
  limits cannot establish native image-memory containment.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  spawn accepts explicit arguments; close follows process termination and stream
  closure. Signals alone do not prove termination. Use asynchronous spawn, no
  shell, bounded streams and actual close before accepting or releasing work.
- [Sharp timeout](https://sharp.pixelplumbing.com/api-output/#timeout): its clock
  excludes waiting for libuv. Retain native limits and add a parent deadline.
- [Sharp global controls](https://sharp.pixelplumbing.com/api-utility/): cache
  limits cover the operation cache and concurrency controls per-image libvips
  threads. Neither is a total process-memory cap. Apply reductions only in children.
- [Sharp security](https://sharp.pixelplumbing.com/security/): keep warning/pixel
  refusal, current dependencies and control-group limits. It also advises PIE/ASLR
  hardening and cautions about official Node binaries. Our pinned binary is not
  changed by this round. Inspection of the actual packaged executable found ELF
  type ET_DYN (PIE); this does not certify other exploit mitigations or ASLR behavior.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints):
  explicit limits constrain containers; OOM can terminate processes. A shared
  app-container limit does not isolate worker memory from the server.
- [Linux cgroup v1 memory controller](https://github.com/torvalds/linux/blob/master/Documentation/admin-guide/cgroup-v1/memory.rst)
  and [cgroup v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html?highlight=freezer):
  verify the active kernel interface. V1 exposes memory-plus-swap and maximum usage;
  v2 has separate swap and peak files. The local Docker host uses v1. Qualification
  checks actual memory/CPU/PID values rather than assuming v2 or skipping limits.
- [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/):
  bound time, memory and incoming work. Our mapping is layered input/output,
  admission, deadline and deployment budgets, with each limit's scope recorded.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), Statement
  May 15, 2025: minimize data exposure. Sending bytes/numeric policy without source
  URLs, credentials or database state and returning fixed errors is our engineering
  application of that principle; this is not W3C conformance certification.

## Alternatives

| Option | Pros | Cons |
| --- | --- | --- |
| In-process Sharp plus admission | Lowest startup/copy cost; existing behavior | Native hangs/crashes share the server; no external retirement boundary |
| Worker threads | Lower startup cost; transferable buffers | Shared process/native memory; JS limits do not isolate native faults |
| Short-lived child per admitted image | External kill/close boundary; fresh native cache; small authority contract | Startup and byte-copy cost; shared user/container memory; output cap may refuse large rewrites |
| Separately constrained worker service | Independent cgroup and OS/network/filesystem policy | New authenticated delivery, availability, deployment and durable ownership contracts |

## Final recommendation stack

Retain fetch admission → shared ingestion admission → bounded original read →
short-lived child with raster/pixel/native limits → bounded result → successful
close → parent-owned hashes/file/asset publication. Preserve deployment CPU,
memory and PID controls. Implement the child now and qualify maximum cases
explicitly. Next assess a separate constrained worker and broader executable hardening
before describing the platform as containing malicious native code or guaranteeing
server survival under worker OOM. Avoid a permanent worker pool until measured
startup cost justifies its additional lifecycle and cache ownership.
