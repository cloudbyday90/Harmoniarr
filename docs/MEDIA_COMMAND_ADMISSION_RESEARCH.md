# Shared media command admission research

Consulted October 23, 2026 through Search Service MCP discovery and official page
reads. The opened Node documentation reports 24.22.1, matching the packaged runtime.

| Official source and status | Application |
| --- | --- |
| [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), runtime documentation | `error` can precede close; exit can precede stdio closure. Keep the admission slot through actual close and retain kill escalation. A kill request does not prove termination. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/), security guidance | Bound operations/processes separately from time, output and memory. Combine a shared bounded FIFO with existing per-command and container controls. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement of May 15, 2025 | Keep admission errors and state numeric/fixed, without catalogue paths, command arguments or credentials. This is an engineering application of minimization, not a conformance claim. |
| [Sharp output timeout](https://sharp.pixelplumbing.com/api-output/), vendor documentation | Processing timeout excludes waiting for a libuv thread. Keep native phase timing distinct from the parent-owned whole-child deadline. The [supporting correction](ARTWORK_REWRITE_DEADLINE_DESIGN.md) retains the outer deadline and memory controls. |

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Shared count-bounded FIFO in the app | Covers all canonical callers; bounded waiting and fair handoff; reuses existing policy | Queue delay; count is not RAM; long jobs can delay tooling | Implement two active/16 waiting/15-second wait, qualify callers |
| Independent limits per consumer | Simple local tuning | Aggregate remains unbounded across consumers | Reject for canonical wiring |
| Free-memory-based admission | Appears adaptive | Snapshot races, shared memory and native allocations defeat reservation claims | Defer |
| Separate worker service | Can isolate resources | Adds deployment/queue/credential complexity and conflicts with built-in scope | Reject this round |

Recommended stack: container limits → one app-owned bounded FIFO → immutable
allowlisted commands with existing time/output bounds → termination escalation →
actual process/stdio close → caller result. Do not lower memory limits based on
the preceding selected catalogue. Defaults require broader operational evidence
before tuning; queueing should not be presented as a throughput improvement.
