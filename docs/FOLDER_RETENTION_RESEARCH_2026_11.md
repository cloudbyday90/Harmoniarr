# Persistent folder browse retention research

Consulted November 14, 2026 through MCP search, opened official documentation and
GitHub commit/file metadata. The executable baseline is Node 24.22.3, npm 12.0.2
and the previously qualified Alpine 3.23 image. This work measures the existing
built-in folder service. See the [design](FOLDER_RETENTION_DESIGN.md),
[Astra review](FOLDER_RETENTION_ASTRA_REVIEW.md) and [outcome](FOLDER_RETENTION_OUTCOME.md).

## Sources and applicable decisions

| Official source / status | Application and observable evidence |
| --- | --- |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html), vendor API documentation reporting 24.22.3 when consulted | `opendir` buffers entries; larger buffers trade memory for refill performance. Pass production 128 unchanged. Await fulfilled `Dir.close()` before counting retirement. Read-delivery and pre-close barriers qualify cooperative cancellation, without claiming interruption of kernel I/O. |
| [Node 24 process API](https://r2.nodejs.org/docs/latest-v24.x/api/process.html), vendor API documentation reporting 24.22.3 | Record RSS, heap used/total, external and ArrayBuffer bytes separately. ArrayBuffers are included in external. Full memory observation has overhead; use brief idle boundaries rather than a continuous full-memory observer. Active resource types describe event-loop liveness, not every descriptor. Pair them with successful owned closes and consistent `/proc/self/fd` totals. |
| [Node 24 V8 API](https://r2.nodejs.org/docs/latest-v24.x/api/v8.html), vendor API documentation reporting 24.22.3 | Heap snapshots block execution and can require roughly twice the heap memory. Exclude them from normal qualification. Forced GC is a separate diagnostic process and never production policy. |
| [Linux cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html), kernel interface documentation | Container current includes descendant accounting; lifetime peak is historical. Preserve the existing v1/v2 precision distinction. Keep container charge, process RSS and V8 allocations separate; do not add overlapping quantities. |
| [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints), vendor operational guidance | Inspect actual two-CPU/1-GiB limits and equal memory/swap settings. Observe OOM counters and actual worker exit before fixture cleanup. No shared-service restart or host-wide prune. |
| [W3C Performance Timeline](https://www.w3.org/TR/performance-timeline/), Candidate Recommendation Draft dated May 21, 2025 when consulted | Its observer lifecycle and bounded observation principles inform measurement ownership. The lane creates no ongoing observer and awaits each output callback. This is an engineering application of the guidance, not browser API implementation or a W3C conformance claim. |
| [GitHub secure use reference](https://docs.github.com/en/actions/reference/security/secure-use), vendor security guidance | Inspect published action bytes and pin the selected upstream commit. Current guidance prefers workflow dependency lockfiles where supported; evaluate adoption separately rather than assuming SHA pins cover transitive dependencies. |

Node's glibc fragmentation discussion is a diagnostic caveat, not an attribution
for this musl-based Alpine image. RSS growth alone cannot establish a JavaScript
leak, allocator defect or required production memory cap. The latest-v24 links
can advance; qualification records identify the actual 24.22.3 executable/image.

## Options, pros and cons

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Repeat the existing fresh-group benchmark | Reuses established controls | Reconstructs the service and cannot establish persistent admission or retention. Rejected for this question. |
| One persistent service with natural-GC idle observations | Exercises real reuse and avoids forced-GC distortion | Includes V8 growth and bounded harness bookkeeping; finite samples cannot prove a plateau. Selected primary lane. |
| Separate forced-GC diagnostic | Helps distinguish collectable allocations from idle heap | Changes GC behavior and still cannot explain all RSS/native growth. Selected supplementary lane. |
| Routine heap snapshots | Rich object-retainer investigation | Blocking, memory amplification and potentially sensitive data. Defer until a concrete unresolved symptom warrants an isolated diagnostic. |
| New daemon, forced production GC or adaptive buffer tuning | Could change resource behavior | Adds architecture or runtime policy without established cause. Rejected for this qualification. |

The recommendation stack is the existing modular ESM service, production buffer
128, four admissions held through close settlement, two explicit cancellation
controls, full-capacity recovery, fixed natural-GC checkpoints, separately labelled
GC diagnostics, bounded partial evidence and acknowledged disposable-resource cleanup.
Keep the long-name fixture local; network/NAS behavior remains deferred.

## Random PR research

A recorded cryptographic draw from open PRs 63–66 selected
[PR 66](https://github.com/cloudbyday90/Harmoniarr/pull/66). It updates nine login
action references from 4.1.0 to exact upstream commit
`81c6f93d4bc991e510b342a00b419b3bb4efc5c6` (4.7.0).
[Metadata](https://github.com/docker/login-action/blob/81c6f93d4bc991e510b342a00b419b3bb4efc5c6/action.yml)
retains Node 24, with main/post now using the published `dist/index.cjs` bundle.
This upstream packaging does not introduce CommonJS into Harmoniarr application code.

The [login implementation](https://github.com/docker/login-action/blob/81c6f93d4bc991e510b342a00b419b3bb4efc5c6/src/docker.ts)
uses password stdin. Its existing nonzero-exit/empty-stderr success behavior
remains a limitation. [OIDC selection](https://github.com/docker/login-action/blob/81c6f93d4bc991e510b342a00b419b3bb4efc5c6/src/dockerhub.ts)
does not replace explicitly supplied passwords. Benefits are reviewed upstream
maintenance and scoped-path fixes; costs are a larger dependency delta and
continued hosted-runner/real-registry validation. Adopt the exact reviewed PR
delta after synthetic entrypoint proof; no release or real login is needed.
