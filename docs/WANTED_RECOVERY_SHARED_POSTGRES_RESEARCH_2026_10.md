# Wanted and recovery shared PostgreSQL research

Consulted October 12, 2026 through connected MCP search and official navigation.
The separate [design](WANTED_RECOVERY_SHARED_POSTGRES_DESIGN.md) maps applicable
guidance to implementation owners; source guidance is distinct from local proof.

| Official source | Status and applicable practice | Project decision |
| --- | --- | --- |
| [Node 24 CLI](https://r2.nodejs.org/docs/latest-v24.x/api/cli.html) | Official CLI reference consulted as v24.21.0; process isolation is the default and the relevant flags predate installed v24.18.1. | Keep serial file subprocesses and the existing native reporter adapter; verify actual host behavior instead of adopting newer-major test features. |
| [Testcontainers containers/lifecycle](https://node.testcontainers.org/features/containers/) | Maintainer documentation distinguishes explicit lifecycle and container reuse. | One newly owned parent server per run; no persisted/reused server state. |
| [PostgreSQL CREATE DATABASE](https://www.postgresql.org/docs/current/sql-createdatabase.html) | Consulted server reference identifies PostgreSQL 18; templates require no other source connections at copy start. | Keep verified sealed per-file templates and fresh scenario databases. Recovery's migration path stays empty. |
| [PostgreSQL template databases](https://www.postgresql.org/docs/current/manage-ag-templatedbs.html) | Consulted PostgreSQL 18 reference separates pristine template0 and site-local additions; connection rules matter. | Parent OID/ownership reconciliation remains independent of schema preparation. No cross-run schema cache. |
| [node-postgres Pool API](https://node-postgres.com/apis/pool) | Maintainer documentation specifies checkout/client return and pool disposal. | Returned worker/tasks drain before pool disposal; independent observers keep their own connection ownership. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Informative guidance excludes secrets/connection strings, sanitizes data and preserves work through logging failure. | Parent captures allowlisted bounded fields, preserving native failure and avoiding raw CLI/SQL/credentials. |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Working Draft, September 1, 2026; work in progress. Describes monotonic durations and timing privacy. | Compare monotonic command durations; keep overlaps and host/cache variance explicit. This testing-only pilot makes no browser/WCAG conformance claim. |

The project stack is an inference from these practices and existing resource
owners. Neither standards nor vendor documentation promises a local speedup,
authorizes resource deletion, or certifies the cause of intermittent resets.
Node process-isolation documentation and actual host/runtime versions are
recorded in the outcome when verified. Do not transfer advice from the current
Node major to this repository's Node 24 profile without checking compatibility.
