# Metadata source writer coordination: official research

Reviewed October 12, 2026 through search-service MCP and GitHub MCP. Searches
identified PostgreSQL 18 locking, node-postgres and OWASP pages; primary pages
were fetched. Previously verified W3C timing URL was reopened. GitHub repository
discovery and metadata supplied its exact paginated PR collection URLs.

Observed packages: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0 and
@testcontainers/postgresql 12.1.0. Original-source native diagnostics report
PostgreSQL version 180003, matching the consulted PostgreSQL 18 documentation.

| Primary source | Status / applicable contract | Project inference |
| --- | --- | --- |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Supported-version documentation: transaction advisory locks end with transaction, consistent order avoids deadlock, advisory participation is application-owned | Shared admission before scopes; exclusive catalog/bulk admission; no claim that raw SQL is fenced |
| [node-postgres transactions](https://node-postgres.com/features/transactions) | Driver guidance: transaction statements share one checked-out client | Own or borrow a real transaction; never use an autocommit pool for multi-statement replacements |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Defensive guidance: deny by default and validate current relationships | Coordination complements captured source/lease/target checks; it is not new publication consent |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/) | September 1, 2026 Working Draft, measurement clock guidance | Retain monotonic elapsed observations separately from SQL lease clocks; no matched speedup/conformance claim |

This is a project-specific application of current documentation, not a W3C
prescription for backend locks. Read-only UI behavior and route session/CSRF
ownership remain unchanged. No provider replay or broad security audit applies.

Select the existing transaction runner plus narrow shared/exclusive admission
and per-operator scope. Benefit: supported absent-row and catalog writes cannot
cross admitted publication. Cost: exclusive catalog/bulk SQL transactions wait
and serialize. Preserve short database-only boundaries, canonical ranking and
partial request progress. Defer global table locks and partitioned identity
protocols until their contention, identity and lock-order consequences are proven.
The [design](METADATA_SOURCE_WRITER_COORDINATION_DESIGN.md) owns scope and
alternatives; an outcome will record installed versions and executed native proof.
