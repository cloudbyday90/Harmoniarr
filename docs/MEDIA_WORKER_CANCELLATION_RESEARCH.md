# Durable media worker cancellation research

Consulted October 23, 2026 through Search Service MCP discovery and official page
reads. Apply the runtime contracts to Node 24.22.1, not the default Node 26 manual.

| Primary source/status | Applied decision |
| --- | --- |
| [WHATWG DOM](https://dom.spec.whatwg.org/), living standard | AbortSignal carries a reason; abort is notification to participating operations. Forward the same signal and retain explicit cleanup ownership rather than treating notification as completion. |
| [Node global AbortSignal](https://r2.nodejs.org/docs/latest-v24.x/api/globals.html), runtime documentation | Check already-aborted signals and retain reasons, including null. Avoid accumulating abort listeners. |
| [Node child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), runtime documentation | Kill/exit/error can precede process/stdio close. Retain capacity and worker/lease ownership until actual close. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/), security guidance | Stop obsolete expensive work while retaining independent time, output, process-count and container bounds. Cancellation alone is not containment. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement | Record fixed outcomes and numeric resource/lease counts, not command arguments, paths or credentials. This engineering application does not establish standards conformance. |

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Serialized polling during owned media steps | Works with durable flags across app instances and existing pause gate; bounded observers | Additional reads; delay includes DB/event-loop latency | Implement one-second polling and drain pending reads |
| In-memory controller registry only | Fast local notification | Misses cross-instance/restart authority and adds registry lifecycle | Reject as sole authority |
| Race cancellation against the callback | Fast promise rejection | Can orphan admitted siblings/children and release leases early | Reject |
| Stop every worker during shutdown | Appears simple | Changes graceful drainage semantics and conflates shutdown with operator intent | Keep separate |

Recommended stack: durable operator/pause authority → serialized step-owned check
→ one propagated signal → bounded shared admission/native termination → complete
sibling/process/read drainage → terminal status and captured lease release. Retain
container/memory/output/deadline controls. Extend to other job owners only with
their own native and persistence proof.
