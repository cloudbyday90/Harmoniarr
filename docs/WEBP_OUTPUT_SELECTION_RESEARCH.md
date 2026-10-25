# Bounded WebP output selection research

Reviewed October 25, 2026 through MCP search and primary-source retrieval. See
[design](WEBP_OUTPUT_SELECTION_DESIGN.md) and [outcome](WEBP_OUTPUT_SELECTION_OUTCOME.md).

| Official source | Application |
| --- | --- |
| [Sharp output/timeout](https://sharp.pixelplumbing.com/api-output/) | Explicit lossy/lossless output is supported. Default rewriting strips metadata. Processing timeout starts at input processing and excludes libuv queue wait; keep one shared monotonic budget and the whole-worker deadline. |
| [Sharp security](https://sharp.pixelplumbing.com/security/) | Bound untrusted dimensions and execution, retain isolation and current native dependencies. |
| [WebP container](https://developers.google.com/speed/webp/docs/riff_container) | VP8X flags are distinct from VP8L encoding. Validate bounded structure, geometry and metadata declarations; never classify by extension or a prefix alone. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Keep truthful success/refusal feedback without forced focus. Native publication evidence does not establish new UI accessibility acceptance. |

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Bounded sequential size comparison on confirmed small opaque lossless inputs | Retains graphic savings without photographic output inflation; no heuristic content classifier | Additional CPU and two retained outputs. Recommended with full reservation and one deadline. |
| Shrink reservation using prior single-encoder observations | More concurrency | Does not cover the simultaneous retained output and different native working set. Reject for this rollout. |
| Hold the full existing DATA-based reservation | Simple conservative ownership through publication | Selection jobs serialize under the active budget. Selected initial policy. |
| Global lossless switch or source passthrough | Simple implementation | Photographic growth or untrusted metadata retention. Reject. |
| Fall back after a native failure | May return an already encoded buffer | Changes failure/deadline ownership and hides incomplete selection. Defer; require both rewrites to succeed. |

Recommended stack: confirmed narrow eligibility; full DATA-based reservation before
grant; sequential sanitized encodes under one budget; bounded smaller-output choice;
actual close/publication fences; focused plus guarded native qualification. Numeric
eligibility limits and mapping allowance are project choices, not standards mandates
or universal native memory bounds.
