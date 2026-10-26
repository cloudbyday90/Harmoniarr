# Readiness diagnostics research and recommendations

Verified October 26, 2026 through connected MCP web search, opened official pages
and the Node documentation's actual Stream link. Applies to the deployed Node 24
baseline. The earlier HTTP 500's cause remains unknown.

| Official source | Applied practice |
| --- | --- |
| [OWASP error handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet) | Generic public failure responses; keep implementation details out of responses. Remove public database/path metadata and retain only safe diagnostic facts. |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Minimize sensitive data, prevent log injection and verify behavior when logging fails. Use a closed scalar record, fixed categories, bounded retention and rate/backpressure admission. |
| [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | Unexpected conditions remain 500; retain the application's existing 503 connection mapping. Do not reclassify unknown failures as temporary overload or infer host saturation from HTTP status alone. |
| [Node 24.22.1 streams](https://r2.nodejs.org/docs/latest-v24.x/api/stream.html) | A false write return requires waiting for drain before more output. Admit no further diagnostic lines while backpressured; retire the owned listener on close. |
| [Node 24.22.1 process I/O](https://r2.nodejs.org/docs/latest-v24.x/api/process.html) | stderr behavior depends on the destination/platform and may be synchronous. Rate/retention bounds are not a transport-latency guarantee. |
| [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Preserve the existing atomic diagnostic-refresh status and keyboard focus. Render history as bounded read-only information; do not add a noisy live region to every row. |
| [PostgreSQL 18 CREATE FUNCTION](https://www.postgresql.org/docs/18/sql-createfunction.html) | Function replacement changes an existing definition. Keep schema preparation out of the system observation reader. The concurrency failure is local evidence, not a claim made by this documentation. |
| [PostgreSQL 18 transaction access modes](https://www.postgresql.org/docs/18/sql-set-transaction.html?trk=article-ssr-frontend-pulse_little-text-block) | A read-only transaction disallows CREATE/ALTER/DROP. Use one as an actual database control for the new migration-status reader. |

The sixteen-record cap and fifteen-second logging interval are application policy,
not numeric requirements imposed by these standards. Stored codes identify observed
error classes. For example, PostgreSQL `57014` says a query was cancelled; the
classification does not assert why it was cancelled. A captured active-job-count
failure does not prove the cause of the previous uncaptured health error.

During qualification the new reference/log pair located a fresh HTTP 500 at
`migration_status`. The legacy helper executes schema-preparation writes. A
separate bounded experiment on the same immutable runtime produced PostgreSQL
`XX000` ("tuple concurrently updated") in 33 of 50 concurrent status calls.
This establishes a reproducible failure mechanism in that path; it does not prove
the cause of an earlier response whose original exception was not captured.

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Keep current check work and add request-owned stage observation | Preserves readiness/startup policy and attributes a recurrence | The broad overview still has non-core failure surfaces |
| Bounded process history plus throttled structured logs | Useful without writing diagnostics into a failing database; bounded retained data | History resets on restart; logs can be suppressed or delayed |
| Minimal public envelope and existing admin diagnostics | Reduces information disclosure without adding an endpoint | Admin auth/diagnostics may be unavailable during database failure |
| Read-only migration observation after fatal startup preparation | Removes unnecessary catalog writes and their reproduced race | Other legacy callers still need a separate preparation/read ownership review |
| Dedicated minimal readiness policy | Could reduce work and non-core failures | Requires a separate policy decision and failure qualification |

Recommended stack: existing health overview → per-check stage attribution → safe
classification/reference → bounded process history and backpressure-aware logs →
existing administrator Recovery diagnostics. Drain actual admitted checks through
the existing application-owner lifecycle. Keep required startup/schema checks
fatal and preserve the public API's successful status and migration count.
Use the new read-only migration reader within that overview. A separate minimal
readiness policy can be considered after the remaining read paths are audited.

See the separate [design](READINESS_DIAGNOSTICS_DESIGN.md) and
[outcome](READINESS_DIAGNOSTICS_OUTCOME.md).
