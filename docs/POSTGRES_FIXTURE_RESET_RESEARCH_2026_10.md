# PostgreSQL fixture reset research

Consulted October 12, 2026 through the connected MCP search service. Search
results and official navigation supplied URLs; links were opened before use.
This supports the separate [design](POSTGRES_FIXTURE_RESET_DESIGN.md), not a
claim that official guidance explains the observed connection resets.

| Official source | Status and applicable guidance | Project decision |
| --- | --- | --- |
| [node-postgres Pool API](https://node-postgres.com/apis/pool) | Maintainer library documentation. Pools are lazy; connection limits/timeouts are explicit, and checked-out clients must be returned. Pool end drains clients. | Both fixture entrypoints use one policy; tracked work finishes before pool end. Independent observers do not compete for the failing pool. |
| [Testcontainers lifecycle](https://node.testcontainers.org/features/containers/) | Maintainer library documentation; explicit started-container lifecycle and stopping. | Only the acknowledged fresh container is automatically inspected. No container discovery or unrelated cleanup. |
| [Docker container inspect](https://docs.docker.com/reference/cli/docker/container/inspect/) | Vendor CLI reference supports a fixed output template. | Read only selected numeric/boolean state, with bounded child execution and serialization. |
| [PostgreSQL 18 logging](https://www.postgresql.org/docs/18/runtime-config-logging.html) | PostgreSQL 18 server reference. Connection/disconnection logging is configurable and can include identities. Sensitive log access needs care. | Do not enable or copy raw logs as a blanket diagnostic. Historical reset cause remains unresolved. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Informative security guidance: exclude secrets/connection strings, validate and sanitize data, preserve application behavior if logging fails. | Allowlisted structured records; omit raw CLI/SQL/error messages; telemetry cannot replace the original rejection. |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Working Draft, September 1, 2026; work in progress. Describes monotonic duration measurement and timing privacy. | Existing monotonic phase timings support observation only. This testing-only change makes no browser/WCAG conformance or deadline-authority claim. |

## Recommendations and limits

The final stack combines maintainer pool/lifecycle contracts, Docker's targeted
inspection, OWASP data minimization and W3C draft measurement guidance. The
tradeoffs and alternatives are in the design. Standards prescribe neither this
repository's two-client policy nor its test architecture: those are project
decisions justified by existing bounded fixture contracts.

Healthy readiness, a successful query or a running container cannot reconstruct
a previous socket failure. A deliberate backend-termination control proves the
observer and fixture failure path; it does not reproduce an unexplained
`ECONNRESET`. No runtime/dependency upgrade or blanket certification is proposed.
