# Concurrent media memory research

Consulted October 23, 2026 through Search Service MCP discovery and official page
reads. Installed FFmpeg/FFprobe were verified as 8.0.1; Node is 24.22.1. The FFmpeg
web manual tracks current development, so actual packaged arguments/results are
qualified separately. Fixture sizes and coordination are engineering choices.

| Primary source | Applied decision |
| --- | --- |
| [FFmpeg command documentation](https://www.ffmpeg.org/ffmpeg.html) | `max_alloc` limits an individual allocation block, not aggregate process/container memory. Do not present it as a total-memory safeguard. Retain the application's existing command bounds/thread settings. |
| [FFmpeg null muxer](https://www.ffmpeg.org/ffmpeg-all.html) | The null muxer discards output. Qualify real decode/encode readiness and original-file preservation without claiming an output-file conversion. |
| [Node 24.22.1 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html) | Spawn and actual close have different meanings; exit alone does not retire stdio. Record overlap after actual spawn, then wait for normal close and original worker completion. |
| [Linux cgroup v2](https://docs.kernel.org/7.0/admin-guide/cgroup-v2.html) | Current/peak include descendants; retain lifetime versus sampled scope. Do not sum overlapping process/category counters. |
| [Linux cgroup v1 memory](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html) | The documentation warns about its age; actual host controls are verified. Label usage approximate, retain hierarchical categories and distinguish failcnt/OOM kills from unavailable v2 counters. |
| [PostgreSQL 18 advisory locks](https://www.postgresql.org/docs/18/functions-admin.html) | Transaction locks last until transaction end. Keep native SQL ownership and concurrent rollback drainage from the preceding lane. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/) | Time, memory, processes and operation counts are distinct controls. A follow-up shared native-command admission limit complements per-command time/output bounds. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/) | W3C Statement, May 15, 2025. Apply data minimization to evidence: numeric counters/hashes rather than tags, paths or credentials. This is an engineering application, not certification. |

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Actual worker/store/native composition | Exercises real parsing, command arguments, guarded writes and retirement | Controlled selection and small catalogue limit extrapolation | Implement as an explicit lane |
| Fake child or callback delays | Cheap lifecycle tests | Cannot measure codec/parser memory or native overlap | Use only for focused observer tests |
| Start tasks and assume overlap | Simple | Adjacent launches can execute serially or finish before observation | Require actual spawn/lifetime evidence |
| Convert media during this change | Could exercise file-output costs | Changes current product behavior and adds mutation scope | Defer; qualify existing preflight |
| Derive a deployment minimum from one peak | Immediate operator number | Excludes broader catalogue, job and storage behavior | Retain measured scope and continue sizing work |

Recommended stack: existing container limits and admission → real run/lease owners
→ bounded fixture catalogue/native commands → observed lifecycle overlap → actual
catalogue/tag/result persistence → completion/close/release → separate memory
evidence. Keep runtime defaults until broader, representative measurements justify
a deployment sizing policy.
