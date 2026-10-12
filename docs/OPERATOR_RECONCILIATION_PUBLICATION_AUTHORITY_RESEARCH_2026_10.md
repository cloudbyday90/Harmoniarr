# Operator reconciliation publication: official research

Reviewed October 12, 2026 through search-service MCP and GitHub MCP. Searches
identified PostgreSQL 18 locking/isolation and OWASP pages; these were opened.
Previously verified W3C and node-postgres URLs were reopened. GitHub repository
discovery and metadata supplied the open PR collection template and exact URLs.
Official transaction-page navigation identified the pool API; its client release
section was fetched. TC39 2026 promises were reopened and relevant rejection
semantics read. Observed host: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0
and @testcontainers/postgresql 12.1.0; the controlled server reports version
180003 in original-source diagnostic evidence.

| Primary source | Status / applicable contract | Project inference |
| --- | --- | --- |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Supported-version documentation; row locks, transaction advisory locks and consistent lock order | Reuse scope and acquisition locks in existing save/run/lease order, with short per-release transactions |
| [PostgreSQL 18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | READ COMMITTED reads can observe newer committed data at later statements | Explicitly select READ COMMITTED and recheck after contention and before commit; snapshots alone do not authorize a stale plan |
| [node-postgres transactions](https://node-postgres.com/features/transactions) | Driver documentation; one client for transaction statements | Sequential guard/request/event/commit work on the existing transaction runner; return client before discovery work |
| [node-postgres pool API](https://node-postgres.com/apis/pool) | Driver contract; truthy release argument disconnects rather than reuses a client | Wrap falsey/non-Error rollback failure for eviction while retaining original work rejection and rollback cause |
| [ECMAScript 2026 promises](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html) | Normative language specification; arbitrary rejection values | Preserve Error/null work failure through transaction cleanup; a truthiness check cannot represent failure state |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Defensive guidance; deny by default and validate current object relationships | Missing context refuses publication; captured IDs alone do not confer authority |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/) | September 1, 2026 Working Draft; elapsed versus wall-clock measurement | Keep validation durations separate from SQL lease expiry and operational timestamps; no conformance or matched speedup claim |

These sources inform a project-specific design; W3C does not prescribe these
server locks. This backend-only slice does not establish WCAG conformance.
No security audit, provider replay or broader standards certification is claimed.

Select captured source plus mutation-time checks under existing ordered locks.
Benefits are bounded refusals and request/event rollback while retaining durable
partial progress. Costs are extra SQL/checkouts and waiting for current owners;
long-held transactions can let a lease expire, so final database-clock validation
must refuse them. Defer global locks, serializable retries, and forced abort.
The [design](OPERATOR_RECONCILIATION_PUBLICATION_AUTHORITY_DESIGN.md) owns alternatives
and writer scope; the outcome will record observed versions and native evidence.
