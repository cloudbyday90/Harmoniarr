# Track fingerprint streaming: official October 2026 review

Consulted October 13, 2026 through MCP search and primary-page navigation.
The separate [design](TRACK_FINGERPRINT_STREAM_DESIGN.md) and
[outcome](TRACK_FINGERPRINT_STREAM_OUTCOME.md) own implementation and actual proof.

| Primary source / status | Applicable guidance | Decision and evidence |
| --- | --- | --- |
| [Node 24 filesystem](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html), runtime documentation, opened 24.21 | Read-stream buffering is configurable; automatic close and emitted close have explicit semantics | Allowlisted sizes only; fixed autoClose/emitClose; observe actual close before returning file evidence. Keep current private-root and before/after stat checks |
| [Node 24.20 streams](https://nodejs.org/download/release/v24.20.0/docs/api/stream.html), runtime documentation | High-water mark is a threshold, not a strict memory limit; `finished` can clean its registered listeners | Separate stream completion and close observation. Prove held close and primary Error/null through secondary cleanup failure. Do not call configured buffer size a process-memory cap |
| [Node 24.20 process memory](https://nodejs.org/download/release/v24.20.0/docs/api/process.html), runtime documentation | RSS is resident process memory; ArrayBuffers include Buffers and are already included in external memory. Memory sampling may be costly | Report each field separately, baseline and sampled peak/delta, with explicit sampling/GC/process limits. Do not sum external and ArrayBuffers or claim sampled values are strict maxima |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Monotonic durations differ from wall time; timer precision has privacy implications | Use Node process-relative durations in private measurement records. This is application guidance, not browser conformance or a final W3C Recommendation |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive data and preserve operation through logging failure | Fixed buffer/profile/count/memory fields; omit paths, hashes, domain/provider IDs and raw child stderr. Existing diagnostic throw/reject and original Error/null controls stay |

The local runtime is Node 24.18.1; used APIs predate it. New experimental iterator
APIs shown in newer Node documentation are outside this change. No runtime,
dependency, schema, UI or HTTP contract upgrade is justified by this experiment.

## Recommendations and tradeoffs

| Option | Pros | Cons / limits | Decision |
| --- | --- | --- | --- |
| Retain 64 KiB with explicit stream ownership | Existing buffering behavior; smaller observed peak growth; unchanged fresh verification | More read/iteration steps on larger media | Keep default |
| 256 KiB buffer | Fewer steps and lower local hash median | Larger sampled RSS/ArrayBuffer peaks; other workers/platforms unmeasured | Internal experiment only |
| 1 MiB buffer | Lowest observed large-file median | Largest configured buffer; similar high sampled process peaks | Internal experiment only |
| Read entire media or reuse historical hashes | Less stream overhead or I/O | Unbounded file-sized allocation or stale byte authority | Reject |
| Bounded reusable read buffer | Potential allocation reduction while retaining fresh hashing | Needs independent handle/close/race and memory proof | Next experiment |

Recommended stack: owning guard → current private-root/before-stat evidence →
fresh 64 KiB SHA-256 stream → observed completion/close → after-stat/root evidence
→ unchanged receipt and publication rules. Performance decisions must use actual
hash equality, byte work, resource ownership and measured memory, not elapsed
time alone. WCAG/WHATWG/IETF UI/HTTP rules remain applicable when those flows
change; adding their checklists here would not validate server streaming.
