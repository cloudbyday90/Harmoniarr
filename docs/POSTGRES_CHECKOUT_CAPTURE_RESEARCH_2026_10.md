# PostgreSQL checkout capture: official October 2026 review

Consulted October 13, 2026 using MCP search and official-page navigation.
Separate [design](POSTGRES_CHECKOUT_CAPTURE_DESIGN.md) and
[outcome](POSTGRES_CHECKOUT_CAPTURE_OUTCOME.md) documents own implementation and
executed proof. Local runtime: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0.

| Primary source / status | Applicable practice | Project decision |
| --- | --- | --- |
| [node-postgres Pool API](https://node-postgres.com/apis/pool), maintainer documentation | Concrete clients must be released; total/idle/waiting counters describe pool state; end drains clients | Retain native pool/client/release ownership; sample counters before, after dispatch and settlement; do not increase capacity or call cleanup from telemetry |
| [node-postgres callbacks](https://node-postgres.com/features/callbacks), maintainer documentation | Callback APIs pass error/client/release and do not return a promise | Observe callback acquisition used by pool queries as well as promise acquisition; preserve receivers, values and return style |
| [Node 24 async context](https://nodejs.org/docs/latest-v24.x/api/async_context.html), vendor runtime documentation | AsyncLocalStorage run/getStore associate state with asynchronous work; run restores the outer context | One module-owned context carries only approved phase/fixture UUID; capture at admission, isolate concurrent/nested phases, keep context available with timing disabled |
| [PostgreSQL activity statistics](https://www.postgresql.org/docs/current/monitoring-stats.htm), PostgreSQL 18 vendor documentation | State and wait events are separate observations; transient views have timing limits | Counter evidence and bounded independent server probes are observations, not automatic diagnosis. Do not log raw query/activity rows or borrow a third failing-pool client |
| [PostgreSQL pg_isready](https://www.postgresql.org/docs/current/app-pg-isready.html), PostgreSQL 18 vendor documentation | Exit status describes acceptance, rejection or response of that connection check | Keep readiness separate from authenticated host query, container state and the earlier failing checkout |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), September 1, 2026 Working Draft | Monotonic elapsed measurement differs from calendar time; exposed timing precision has privacy implications | Use private Node process-relative durations; this is an application inference, not browser conformance or a final W3C Recommendation |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude connection strings/passwords and other sensitive values; logging failures must not replace application behavior | Fixed labels/counters/generated correlation IDs and approved code/class chains only; bound records/probes, preserve primary Error/null and do not serialize messages/SQL/driver options |

MCP navigation follows the Node page's 24.x link; only stable APIs supported by
the installed runtime are used. No dependency/runtime migration follows from a
newer documentation version. Installed pg-pool source confirms pool.query calls
its instance connect callback and its cold-connect timeout differs from a queued
waiter's timeout. A historical message is insufficient to diagnose host/server
health. No experimental context scope API or global prototype instrumentation.

## Recommendations and tradeoffs

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Scoped concrete-pool checkout observer | Captures direct schema and later query acquisition; accurate counters and correlated pre-cleanup probes | Explicit callback compatibility/restoration; bounded failure delay; hidden or ad hoc pools remain outside scope | Adopt with controlled/native proof |
| Higher-level scenario failure capture alone | Existing small surface; useful SQL/scenario failures | May run after internal cleanup, miss caught errors or lack dispatched queue state | Retain as separate fallback |
| First-schema observer alone | Existing stable record and startup coverage | Misses later claims and direct-fixture pools | Retain compatibility, supplement |
| Global prototype patch or full query logging | Broad apparent visibility | Changes unrelated pools and can expose SQL/credentials; more restoration/ownership risk | Reject |
| Automatic retry or larger pool/deadline | Can hide a transient red run | Changes pressure and loses evidence; does not establish a cause | Reject |

Recommended stack: fixture-local phase context → instance checkout observation →
bounded private record → first checkout failure's independent server capture →
original result/failure → owned work drainage → observer restoration → existing
pool/database cleanup. WCAG/WHATWG/IETF UI/HTTP practices apply when their flows
change; no unrelated UI audit or certification is implied by this fixture work.
