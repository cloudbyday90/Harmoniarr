# Artwork ingestion research and recommendation stack

Consulted October 22, 2026 via MCP official-source discovery/retrieval. GitHub MCP
found zero open PRs at selection. No random local PR implementation was applicable.

| Primary source/status | Applicable decision |
| --- | --- |
| [Sharp global properties](https://sharp.pixelplumbing.com/api-utility/), vendor documentation | Threads per image, libvips cache and native task counters are separate from admission of full ingestion lifecycles |
| [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/), vendor documentation | Preserve warning refusal and pixel limits; metadata-based limits are not process-memory guarantees |
| [Sharp security](https://sharp.pixelplumbing.com/security/), vendor guidance | Retain safety features and supported installed native libraries; no relaxed untrusted-image options |
| [Sharp processing timeout](https://sharp.pixelplumbing.com/api-output/#timeout), vendor API documentation | Native processing time excludes the libuv wait; a three-second setting is not a whole-ingestion deadline |
| [Node 24 filesystem](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html), Node 24.22.1 runtime documentation | Read/stat/close the same file handle; file read completion and descriptor retirement are separate responsibilities |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/), informative guidance | Bound active work, queued bytes/counts and per-file reads; request rate alone does not bound resource retention |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), Statement May 15, 2025 | Project inference: retain numeric work/resource measurements and fixed errors without paths, image bytes or recipient telemetry |

The immutable preceding Linux image measured six overlapping 1024×1024 PNG
ingestions (three file, three buffer): all six entered native inspection/publication
work. Installed versions were Node 24.22.1, Sharp 0.35.5 and libvips 8.18.7. The fixed
fixture uses actual decode/rewrite/files with controlled asset sinks. Its sampled
RSS and elapsed time are observations, not safe limits or throughput benchmarks.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Share one ingestion gate across provider/local paths | Covers the actual common decoder/publication owner | Independent factories/processes still have separate budgets | Adopt |
| Reuse fetch's same gate for nested ingestion | One count | Fetch could hold every slot while waiting to reacquire | Reject |
| Bound waiter count only | Simple | Large buffers can dominate retained waiting memory | Add a queued-byte allowance |
| Stat then ordinary readFile | Simple | A growing file can still allocate beyond admission | Replace with bounded handle reads |
| Global Sharp cache/thread tuning | Could affect CPU/cache behavior | Changes unrelated consumers and does not bound input retention | Defer |
| Isolated image workers with memory limits | Stronger native-failure containment | Adds IPC, publication and lifecycle complexity | Separate follow-up for worst-case qualification |

Final stack: existing provider admission → shared ingestion active/wait-byte budget
→ bounded same-handle file input or bounded supplied buffer → existing raster/pixel
checks → native rewrite/bounded statistics → awaited file/asset publication → slot
release. Two active slots/four waiters/32 MiB are conservative project choices;
their counters do not establish a hard process-memory ceiling or a future derivative
generation contract.
