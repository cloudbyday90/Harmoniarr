# Artwork admission research and recommendations

Consulted October 22, 2026 using MCP search and official-page retrieval. GitHub MCP
found zero open PRs at selection, so random PR implementation was inapplicable.
Sources below were discovered through search/navigation, not assumed URLs.

| Primary source and status | Applicable practice |
| --- | --- |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/?trk=article-ssr-frontend-pulse_little-text-block), informative security guidance | Bound concurrent work, batch operations, waiting time and per-image work; rate limiting alone does not bound outstanding work |
| [Sharp global properties](https://sharp.pixelplumbing.com/api-utility/), vendor API documentation; installed Sharp 0.35.5 | concurrency controls threads per image; cache memory concerns the libvips cache; neither replaces admission of whole image lifecycles |
| [Sharp performance](https://sharp.pixelplumbing.com/performance/), vendor guidance | Tune using the deployed stack; allocator/thread behavior differs across environments |
| [Node 24 globals](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html), Node 24.22.1 runtime documentation | Check pre-aborted signals and remove owned abort listeners; cancellation notification does not establish completed work |
| [WHATWG Streams](https://streams.spec.whatwg.org/), Living Standard | Backpressure describes stream queues, not the number of full image pipelines or process memory |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), Statement May 15, 2025 | Project inference: expose numeric admission counts and fixed safe errors without retaining endpoint or recipient details in diagnostics |

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Limit each batch only | Small change | Concurrent batches and single requests bypass the aggregate cap | Insufficient |
| Instance-owned gate across complete fetch lifecycle | Explicit ownership, no dependency, bounded waiting | Cached reads share capacity; slow publication occupies a slot | Adopt |
| Two lazy batch producers | Bounds eager admissions, retains result shape | Large batches take longer | Adopt with the shared gate |
| Unbounded semaphore wait queue | Preserves all requests | Retains arbitrary pending work and latency | Reject |
| Release on active timeout/abort race | Quick caller return | Native/download/publication work can continue after permit reuse | Reject |
| Change Sharp/global thread pool settings | Can affect CPU behavior | Does not bound downloads or retained input; affects unrelated consumers | Defer pending measurements |
| Per-process worker isolation and memory enforcement | Stronger failure containment | Larger IPC, publication and operational design | Follow-up if measured resource needs justify it |

Final stack: existing request limits → bounded lazy batch producers → one fetch
service's FIFO active/wait budget → existing provider/DNS/TLS/byte/pixel safeguards
→ awaited decode/storage/assignment completion → permit release. Preserve current
ESM/runtime/dependencies. Two active slots and 32 waiters are conservative initial
defaults; fixture measurements establish work counts, not production throughput,
safe maximum RSS, provider availability or cross-process coordination.
