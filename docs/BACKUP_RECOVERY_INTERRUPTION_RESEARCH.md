# Recovery job interruption research

Verified October 26, 2026 using connected MCP web search and opened official
sources, against the deployed Node 24/PostgreSQL 18 baseline.

| Source discovered and opened | Applied guidance |
| --- | --- |
| [Node 24 child process API](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html) | A successful kill request does not prove process termination. Verify SIGKILL and `close`, including stdio retirement. Use shell-free finite arguments, explicit child identity and bounded IPC/output. |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html) | Await actual handle work and close. The controlled sync checkpoint holds promise delivery after a real fsync; it does not claim to stall the operating system. |
| [PostgreSQL 18 administration functions](https://www.postgresql.org/docs/18/functions-admin.html) | Session locks last through their owning session. Observe original backend retirement and advisory-lock absence; do not infer it from a sent signal. Retain real lease expiry and exact acquisition checks. |
| [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Provide progress/status changes programmatically without moving focus. Preserve the existing atomic status region and clarify saved observations versus the current unfinished journal. |
| [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Keep public progress metadata separate from raw private paths/errors. Add only a boolean to the existing administrator status; bounded fixture diagnostics use isolated public fixture inputs. |

The sources define process, lock and status semantics. The seven scenarios,
30-second production lease, controlled fsync-result delivery and replay caveat
are application/qualification choices, not requirements imposed by those sources.
The fixture uses a 1 ms retry backoff after real lease expiry to bound test time;
production retry timing remains unchanged. Live takeover deliberately expires
one owned fixture acquisition, and is labeled separately from actual crash expiry.

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Real worker/process/database qualification | Exercises native handle lifetime, persisted phase, acquisition fencing and replay | Slower than unit tests; needs isolated Linux/embedded PostgreSQL |
| Fresh journal counts plus a durable replay caveat | Honest current status; avoids inventing exact historical accounting | Saved completion totals can omit work completed before a lost batch checkpoint |
| Keep existing queue/ownership/drain stack | Reuses qualified authority and deployment | Qualification must prove multiple lifetimes together |
| New exact outcome ledger | Could support exact per-run attribution | Adds schema, retention and recovery coordination without a present product requirement |

Recommended stack: bounded identity-bound fixture process → shipped dispatcher
and recovery worker → exact job acquisition plus pinned backup session → existing
journal/file reconciliation → live journal counts and qualified status messages.
Retain explicit confirmation and read limits, and do not introduce production test
switches, a separate service or promises of hardware power-loss durability.

See [design](BACKUP_RECOVERY_INTERRUPTION_DESIGN.md) and
[outcome](BACKUP_RECOVERY_INTERRUPTION_OUTCOME.md).
