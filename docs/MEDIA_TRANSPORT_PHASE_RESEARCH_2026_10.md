# Media transport phase research, October 2026

Consulted October 14, 2026. GitHub MCP repository search/metadata discovered the
pulls collection; the initial refresh contained zero open PRs. Web search supplied
official Docker/Node/OWASP pages after MCP search failed; MCP opened primary pages.
W3C official navigation identified its latest published draft. The Node 24 child
process page's actual HTML navigation supplied the perf_hooks URL, then MCP opened
it. No documentation URL was constructed from an assumed filename. Engine's
interactive/OpenAPI link was unavailable to the reader; its primary API overview
and reference search text support the staged proposal, not a tested API adapter.

| Official source/status | Applied practice | Pros | Limits |
| --- | --- | --- | --- |
| [Docker Engine API](https://docs.docker.com/reference/api/engine/), platform documentation | Treat CLI calls as HTTP/control round trips; an API candidate must honor actual daemon versions. | Can preserve checks while avoiding CLI process launches. | No API client performance or context/security compatibility has been proved here. |
| [Engine API 1.56](https://docs.docker.com/reference/api/engine/version/v1.56/), versioned platform reference | Preserve complete acknowledged owner identity and running/exec state checks in a future read adapter. | Explicit contract rather than guessed ownership. | Actual host is Engine 29.8.2/API 1.56; do not infer it from an example/version matrix. |
| [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), runtime documentation | Await returned execFile work; retain shell-free argv, timeout and output limits. | Measures the existing host/stdio boundary without changing execution. | CLI closure does not prove in-container process retirement; an exec window includes more than codec work. Docs are 24.21.0; host is 24.18.1. |
| [Node 24 performance APIs](https://r2.nodejs.org/docs/latest-v24.x/api/perf_hooks.html), runtime documentation | Use process-relative performance.now durations, with unavailable clocks left untimed. | Consistent local phase timing. | Process origins cannot identify a cross-run time or isolate CPU/daemon latency. |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1 Working Draft | Compare monotonic durations within an owner, keeping overlapping scopes separate. | Avoids wall-clock adjustment and misleading sums. | Working Draft, not a Recommendation or application certification; elapsed comparisons still need matching work/order. |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Fixed phases/counts/durations, bounded reports and tests for diagnostic failure. | Useful evidence without private source/command output. | Aggregates do not certify successful ownership validation or diagnose historical failures. |

## Recommendation stack and alternatives

Implement optional bounded evidence first: current owned command -> fixed native
round-trip phase -> immutable aggregate -> post-close safe report -> controlled
comparison. Keep current file/identity checks, retirement and workspace guards.

Per-command and owned CLI paths remain comparators; owned reuse remains opt-in.
A persistent API connection can reduce host-client overhead but adds endpoint,
version, HTTP body/stream and cleanup contracts. Prefer a first read-only container
inspection prototype if current control-read measurements justify it; keep CLI
exec and lifecycle mutations until separate proofs. Do not skip configuration
checks, cache inspection, expose an unauthenticated daemon, or convert failed
collections to green by changing limits. See [design](MEDIA_TRANSPORT_PHASE_DESIGN.md),
[outcome](MEDIA_TRANSPORT_PHASE_OUTCOME.md) and
[next read-adapter proposal](MEDIA_CONTROL_READ_API_PROPOSAL.md).
