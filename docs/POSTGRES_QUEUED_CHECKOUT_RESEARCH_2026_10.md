# PostgreSQL queued checkout official research

Consulted: 2026-10-16 through MCP search/open and GitHub repository metadata.
Versions installed locally: pg 8.23.0 and pg-pool 3.14.0. Current online guidance
does not establish compatibility with a different installed implementation.

| Source and status | Applicable practice | Project decision and limit |
| --- | --- | --- |
| [node-postgres pool API](https://node-postgres.com/apis/pool), framework documentation | Idle handoff may use nextTick; full pools queue FIFO; release returns or destroys the borrowed client | Track actual pending-item promotion. Counter snapshots alone do not identify a leak or stall |
| [node-postgres pool source](https://github.com/brianc/node-postgres/blob/master/packages/pg-pool/index.js/), upstream implementation | PendingItems pass through newClient and _acquireClient | Review installed source too; guard exact versions and native methods instead of assuming master matches |
| [Node 24 async context](https://nodejs.org/download/release/v24.16.0/docs/api/async_context.html), runtime documentation | AsyncLocalStorage scopes work through asynchronous resources | Existing phase spans remain; release-time context is insufficient evidence of waiter identity (project inference) |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/), September 1, 2026 Working Draft | Monotonic elapsed measurement avoids wall-clock adjustments; clocks have distinct domains | Use Node performance offsets within each checkout. Do not compare client offsets directly to PostgreSQL log clocks or claim W3C conformance |
| [PostgreSQL protocol overview](https://www.postgresql.org/docs/current/protocol-overview.html), PostgreSQL 18 documentation at consultation | Startup/authentication and ordinary query operation are separate stages | Keep startup dispatch, authentication and backend readiness separate; a successful later query does not locate an earlier startup failure |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Minimize sensitive logging, correlate interactions and preserve application behavior when logging fails | Output only approved stages, durations, opaque IDs and enums; retain original Error/null through optional diagnostics |

The final stack is bounded owned-instance instrumentation, fixed resource limits,
actual native adverse controls, and minimized failure evidence. The tradeoff is
explicit driver-version maintenance rather than broad global tracing. No blanket
WCAG, W3C or OWASP certification follows from these infrastructure checks.

MCP repository discovery identified cloudbyday90/Harmoniarr and its canonical
pulls API. The opening open-PR collection was empty: random selection, local PR
implementation, stale closure and rebase were inapplicable. No PR was merged.

For the standing local rebuild request, MCP lookup also rechecked current
[Compose build](https://docs.docker.com/reference/cli/docker/compose/build/),
[docker-container driver](https://docs.docker.com/build/builders/drivers/docker-container/)
and [cache mount guidance](https://docs.docker.com/build/cache/optimize/).
Use --no-cache with a fresh acknowledged builder and default-load=true, preserving
the selected builder and walkthrough state. No-cache does not itself establish
empty persistent cache mounts or a base-image refresh. This follows the existing
[rebuild design](LOCAL_DOCKER_REBUILD_2026_10_DESIGN.md); deployment evidence is
separate from test and release evidence.
