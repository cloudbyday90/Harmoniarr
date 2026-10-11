# Owned PostgreSQL failure evidence research

Consulted October 11, 2026 through connected MCP search and official navigation.
URLs were discovered and opened, not constructed from guessed documentation paths.
Installed API source is checked independently from latest documentation.

| Primary source | Applicable contract | Project decision / limit |
| --- | --- | --- |
| [PostgreSQL pg_isready](https://www.postgresql.org/docs/current/app-pg-isready.html) | Native exit codes distinguish readiness; correct credentials are not required; timeout zero disables the limit | Quiet readiness is separate from authentication; nonzero Docker CLI exits stay ambiguous command failures |
| [pg Client](https://node-postgres.com/apis/client) | Connect/query/end promises and independent client error handling | Capture config privately; short driver bounds; observe errors and await native end |
| [pg Pool](https://node-postgres.com/apis/pool) | Checked-out/idle clients and waiting requests have distinct lifetimes | Do not use the failed pool for an independent probe |
| [Testcontainers containers](https://node.testcontainers.org/features/containers/) | Started-container capability supplies an immutable ID and runtime access | Only the captured fresh server is eligible; no name-based resource discovery |
| [Testcontainers configuration](https://node.testcontainers.org/configuration/) | Container logging is an explicit DEBUG facility | Keep raw vendor logs private and opt-in |
| [Node 24.18.1 child processes](https://nodejs.org/download/release/v24.18.1/docs/api/child_process.html) | execFile avoids a shell; timeout and maxBuffer bound the child; termination signals alone are not completion | Use exact argv and observe CLI completion; a forced CLI stop does not prove remote PostgreSQL work has stopped |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Exclude secrets; validate/sanitize event fields; logging failure should not break the application | Approved enums/codes/numbers and opaque correlation; no raw payloads/messages |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Monotonic clocks measure elapsed time | Failure-to-probe and probe duration are observations, not wall-clock causal proof |

PostgreSQL/pg/Testcontainers are official vendor guidance. OWASP is informative
security guidance. The cited W3C document is a September 1, 2026 Working Draft,
not a stable Recommendation or a new browser conformance claim. The PostgreSQL
current document identifies version 18; actual native server version must be read
from the fixture rather than inferred from the documentation.

The architecture is a project inference: separate the failing connection from
independent host authentication and in-container readiness, retain each result,
and refuse unsupported ownership. A later successful probe cannot prove the
original socket or server was healthy when the failure occurred. No source
mandates our factory names or establishes a historical root cause.
