# Mixed artwork corpus research and recommendation

Consulted October 24, 2026 through connected Search MCP discovery, official
navigation and page reads. Actual packaged versions remain Sharp 0.35.5/libvips
8.18.7 and Node 24.22.1. Current vendor pages describe API contracts; native runs
qualify the installed binaries separately.

| Official source / status | Applied decision |
| --- | --- |
| Sharp [input metadata](https://sharp.pixelplumbing.com/api-input/) and [output options](https://sharp.pixelplumbing.com/api-output/), vendor documentation | Verify actual input depth/channels and output format/metadata. Compare the application's canonical eight-bit projection rather than assuming 16-bit preservation. |
| Sharp [global properties](https://sharp.pixelplumbing.com/api-utility/) and libvips [concurrency](https://www.libvips.org/API/current/func.concurrency_get.html), vendor documentation | Cache/concurrency settings are separate controls; do not turn them into a total-memory guarantee. Keep existing settings and measure actual composition. |
| Linux [v1 memory controller](https://cdn.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html), kernel documentation | Usage is approximate. Keep lifetime/sample peaks, failcnt and OOM kills separate; do not fabricate v2 counters. |
| [Node 24.22.1 process memory](https://r2.nodejs.org/docs/latest-v24.x/api/process.html), vendor documentation | RSS, heap, external and ArrayBuffers overlap in different ways. Retain separate fields and do not add ArrayBuffers to external. |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), security guidance | Emit bounded case ids, counts, hashes and numeric observations; exclude credentials, sessions, source paths and raw decoder output. |
| W3C [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), informative WCAG 2.2 guidance | Preserve actual checking versus queued status under the workload. HTTP state evidence remains separate from unchanged browser behavior and deferred assistive-device acceptance. |

## Alternatives

| Option | Pros | Cons / recommendation |
| --- | --- | --- |
| Keep only the solid-color maximum-dimension case | Cheap baseline | Omits entropy/sample-depth behavior; retain as regression |
| Enlarge synthetic input arbitrarily | Could stress memory | Loses the reviewed bounded corpus and increases generator cost; defer |
| Reuse one database/container for all cases | Less startup work | Accumulated peaks, bootstrap conflicts and cache hits obscure per-case scope; reject |
| Treat decoder capacity refusal as a successful image | Simplifies settlement | Could hide publication or partial success; reject |
| Existing fixed corpus, fresh case/profile, shared mixed owners, separate publication/refusal proof | Repeatable actual inputs and current pipeline behavior | More opt-in container runs and selected-scope limits; adopt |

Final stack: guarded disposable profile → exact corpus selector → bounded input
generation/metadata → existing TLS/fetch/ingestion/native admission → accepted
publication or owned refusal → actual review/media/SQL completion → separate
resource evidence → verified drainage. Change resource policy only if the evidence
shows a concrete fault; no corpus by itself establishes a deployment minimum.
