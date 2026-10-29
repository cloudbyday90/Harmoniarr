# Folder buffer comparison research

Consulted October 28, 2026 through MCP search and opened official sources.
This follows the [RSS/rescan qualification](FOLDER_BROWSE_PROFILE_OUTCOME.md).
See the separate [design](FOLDER_BROWSE_BUFFERS_DESIGN.md) and
[outcome](FOLDER_BROWSE_BUFFERS_OUTCOME.md). Network storage remains deferred
at the user's request.

| Source and status | Application to this experiment |
| --- | --- |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html), served as 24.22.2 when opened | Larger opendir buffers trade memory for performance. The default is 32 entries. A resolved close Promise acknowledges actual handle closure. Compare 32/128 without changing lifetime ownership. |
| [Node 24 process API](https://r2.nodejs.org/docs/latest-v24.x/api/process.html), served as 24.22.2 when opened | RSS-only sampling is cheaper than full memoryUsage; process maximum RSS is a lifetime measure in KiB. Keep scopes separate and preserve signed differences. |
| [Node performance API](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html), preceding Node 24 release | Use process-relative performance.now durations. All exercised APIs are tested on the immutable installed 24.22.1 runtime; this experiment does not upgrade it. |
| [W3C High Resolution Time, September 1, 2026](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), Working Draft | Use monotonic time for durations. Applying that principle to Node is an application inference, not browser-conformance or Recommendation status. |
| [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints), implementation guidance | Compare identical CPU/memory limits; equal memory and memory-swap limits disable swap. Verify actual kernel limits rather than relying on documented intent. |

## Options and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Immediately change production to 128 | Small code change; plausible lower read overhead | No measured storage/memory evidence; mixes qualification with rollout. Deferred. |
| Add an operator or environment buffer setting | Allows deployment-specific tuning | Adds unsupported combinations and configuration/security surface before a default is qualified. Rejected. |
| Fixed benchmark-only 32/128 variants | Same packaged service, guards and synthetic input; isolates one declared option | Still an instrumented workload, not actual HTTP or a concurrency/network qualification. Selected. |
| Automatically adapt buffer size from RSS/latency | Could react to conditions | Feedback noise, platform dependence and harder admission/retention reasoning. Rejected. |

## Recommendation stack

Keep the built-in guarded service and its current defaults during qualification.
Extend the existing explicit ESM CLI with a fixed buffers comparison; retain the
algorithm comparison as its default. Assert the original production options
before substituting only bufferSize at the injected filesystem boundary. Preserve
native read/stat Promise identity and actual close before admission release.

Use fresh, equal-resource, read-only consumers on an engine-local volume and
Windows host bind. Four repetitions balance which variant runs first, with
separate sampling-off controls. Report all successful/refused samples, page/data
parity, caller-visible reads, elapsed range/median, CPU and separately scoped
memory. Cache state and existing host load remain limitations. Select the next
qualification from measured results; do not infer whole-app RAM, NAS behavior,
four-consumer behavior or automatic production tuning from this experiment.

The [measured decision](FOLDER_BROWSE_BUFFERS_OUTCOME.md) keeps production at 32:
128 improved the local ceiling points, but the mixed-file first-page Windows-bind
observations varied substantially. Investigate that point before a default change.
