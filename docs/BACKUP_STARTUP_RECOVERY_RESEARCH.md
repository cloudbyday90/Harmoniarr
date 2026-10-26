# Startup backup recovery research and recommendations

Verified October 26, 2026 using the connected MCP web search service. Links below
were discovered by search and opened. This applies to the deployed Node 24 and
PostgreSQL 18 baseline; it does not recommend an unrelated platform upgrade.

| Official source | Applicable guidance and implementation |
| --- | --- |
| [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html) | LIMIT needs deterministic ordering for predictable subsets. Use `(created_at,id)` keyset pagination, a fixed cutoff and one lookahead. Preserve database timestamp precision rather than rounding through JavaScript Date. |
| [PostgreSQL administration functions](https://www.postgresql.org/docs/18/functions-admin.html) | Session advisory locks belong to the acquiring connection. Retain the qualified pinned backup ownership connection and existing acquisition-fenced job lease. |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html) | Read through an owned handle, await actual operations and close handles after their work settles. Chunk and bound automatic reads, including growth. A five-second admission budget stops new items between operations; it does not guarantee a five-second dispatch or interrupt fsync. |
| [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Present status changes programmatically without moving focus. Keep one `role=status`, atomic message, explicit refresh and canonical job navigation. Preserve refresh focus while requests run. Automated browser checks do not establish screen-reader conformance. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Enforce administrator access on every status request through the existing authorization boundary. Return no-store responses. |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Minimize sensitive operational data. Deliver whitelisted counts/states; omit internal continuation facts and raw file/database error text from public summaries. |

The numeric batch, read and admission limits are application policy choices, not
limits mandated by these standards. They bound automatic work without weakening
existing file identity, confirmation, durable intent or deletion rules. A 16 MiB
input cap bounds bytes read; it is not a whole-process memory guarantee because
verification also parses JSON and constructs objects.

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Reuse the existing durable queue inside the application | Existing jobs, cancellation, restart ownership and administrator UI; no extra deployment | Requires careful continuation and shutdown integration |
| Fixed scan cutoff, 25 items plus lookahead | Finite walk, no starvation from held rows, bounded result count | Newer journal entries wait for a subsequent startup scan |
| Same-handle 16 MiB cap and soft admission budget | Defers large inputs safely; never abandons owned filesystem work | Oversized artifacts require separate review; slow single I/O can exceed the budget |
| Stable status with explicit refresh | Predictable keyboard behavior and restrained announcements | Status is a snapshot rather than continuous progress |
| Separate service or synchronous full startup scan | Operational isolation, or simple sequencing | Extra lifecycle/deployment, or readiness blocked on arbitrary backlog; reject for this scope |

Recommended stack: existing startup supervisor → durable operation queue →
30-second acquisition-fenced lease with 10-second renewal → pinned backup
filesystem ownership → bounded journal page and same-handle verification →
whitelisted administrator status in Recovery and Background Jobs.

See the separate [design](BACKUP_STARTUP_RECOVERY_DESIGN.md) and
[outcome](BACKUP_STARTUP_RECOVERY_OUTCOME.md) documents.
