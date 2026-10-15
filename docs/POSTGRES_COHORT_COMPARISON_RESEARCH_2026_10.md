# Complete PostgreSQL cohort comparison research

Consulted 2026-10-15 through MCP search, official navigation and GitHub metadata.
Installed Node is 24.18.1 and npm 12.0.2. Opened Node 24 documentation identifies
24.22.0; use APIs supported by the installed version, not newly documented APIs.

| Primary source/status | Applicable guidance | Project application |
| --- | --- | --- |
| [Node 24 test runner](https://r2.nodejs.org/docs/latest-v24.x/api/test.html), maintainer documentation | Native events and final summaries expose cases/results; extraneous async work can outlive reported completion | Use a fixed custom reporter, require complete output and actual fixture/process cleanup |
| [Node 24 CLI](https://r2.nodejs.org/docs/latest-v24.x/api/cli.html), maintainer documentation | Process isolation is the default; concurrency controls files; force-exit can end with event-loop work remaining | Preserve process isolation and serial files; do not add force-exit or parallelism |
| [Node performance APIs](https://r2.nodejs.org/docs/latest-v24.x/api/perf_hooks.html), maintainer documentation | performance.now measures high-resolution time relative to the current process | Measure each full profile in the same controller, with separate source/artifact overhead |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/), Working Draft dated 2026-09-01 | Monotonic durations avoid wall-clock adjustments; different clock origins are not directly comparable | Report durations and qualified inclusive phase aggregates; do not add nested spans or compare absolute child timestamps |
| [Testcontainers lifecycle](https://node.testcontainers.org/features/containers/), maintainer documentation | Explicit bounded stop and reuse/automatic cleanup have distinct lifecycle semantics | Newly own each isolated server or shared parent; keep reaper enabled and await release |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude secrets/connection strings, sanitize input and verify logging failure behavior | Publish allowlisted numeric evidence and case hashes; bound parsing and preserve original failure through sink fallout |

The counterbalanced schedule, comparison thresholds and source fingerprint are
project engineering decisions, not W3C requirements. The timing document is a
Working Draft, not a Recommendation or endorsement of this benchmark. No browser
accessibility or blanket security conformance is claimed.

## Options, pros and cons

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Explicit fixed-cohort comparison command | Repeatable equivalent scope; exact completion/work evidence; keeps fast feedback independent | Four native executions and maintained evidence contracts | Implement |
| Change default scheduling based on the old two-file pair | Immediate startup amortization | Incomplete current-cohort comparison and order/host variance | Defer |
| Increase workers/share a mutable scenario database | Potential lower elapsed time | Changes contention/isolation and hides ownership failures | Reject |
| Parse human spec text/count exit zero as success | Simple tooling | Formatting drift, green skips and unmatched cases can invalidate comparison | Reject as evidence authority |
| Repeat the entire integration gate for each sample | Broad coverage | Expensive and includes unrelated owners; weakens attribution | Keep separate from this measurement |

Recommended stack: fixed audited cohort → serial isolated file processes → fresh
server ownership → native case/phase evidence → source and cleanup verification
→ counterbalanced descriptive comparison → separate default-promotion decision.

Opening GitHub MCP collection read found zero open PRs; refresh before commit.
See [design](POSTGRES_COHORT_COMPARISON_DESIGN.md) and
[outcome](POSTGRES_COHORT_COMPARISON_OUTCOME.md).
