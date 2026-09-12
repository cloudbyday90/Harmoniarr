# Transactional request lifecycle design

Design date: September 12, 2026. Harmoniarr is a Docker-first, Soulseek-native music library manager using Node 24 LTS native ES modules, Express, PostgreSQL 18, and Vue. This design follows the [Activity privacy repair](REQUEST_LIFECYCLE_ACTIVITY_OUTCOME.md).

## Decision

Commit cancellation/reassignment, private request history, private audit, and the generic household Activity row in one PostgreSQL transaction. The feed reads this same database, so an asynchronous outbox adds a second delivery lifecycle without crossing a system boundary. The prior recommendation to investigate an outbox is resolved by using direct transactional persistence for this sink.

Extract lifecycle orchestration into a small service factory. Keep SQL in stores and pass the transaction client explicitly to every participating write. Use the existing transaction runner, and use strict Activity insertion rather than the best-effort publisher that swallows failures. Leave optional creation publication under its existing contract.

Acquire the request row lock before rereading and evaluating ownership, state, and reassignment no-op checks. For administrator parent cancellation, lock children in stable identifier order, cancel eligible children, and record their actual previous states. Await every required audit/history write. Return the final state only after commit. A failed required write rolls back the whole action; a duplicate cancellation or reassignment to the current target returns the existing conflict result after rereading current state.

Keep the public projection at the durable write boundary and the existing feed/client read boundaries. Household Activity includes identifiers and time, not request titles, artists, reasons, notes, recipient fields, or provider URLs. Detailed history remains authorized separately. Cascades retain one parent household Activity event with private child history and aggregate audit. Unexpected persistence failures must not expose SQL diagnostics through individual or bulk responses.

## Alternatives and official research

Official URLs below were discovered through search/MCP and opened on September 12, 2026.

| Approach | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Same-client transaction including Activity | Immediate durable visibility; simple rollback boundary; no relay or replay window | Activity persistence failure rejects the action | Use for this same-database sink |
| Transactional outbox and existing operation workers | Separates delivery and permits recovery across systems | Requires idempotent consumers, ordering, retries, retention, and queue observability | Reserve for future external delivery |
| Keep best-effort publication after commit | Lowest coupling and latency | Can permanently omit successful lifecycle events | Replace for these two actions |
| Skip locked requests during mutation | Avoids waiting | Can silently omit a requested action or cascade child | Reject |

PostgreSQL transactions provide all-or-nothing visibility and rollback, supporting the single commit boundary. [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html).

Row locks serialize conflicting writers; consistent lock ordering reduces deadlocks. Locking is not a substitute for rereading current state. [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html). `SKIP LOCKED` provides an inconsistent view suited to queue consumers, not complete request-family mutation. [PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html).

The transactional outbox addresses dual writes by storing delivery intent with state and using idempotent consumption. That complexity is warranted when delivery crosses a transaction boundary; the current Activity table does not. [AWS transactional outbox guidance](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

Match recorded detail to its audience and exclude sensitive data from public operational records. Preserve the generic projection instead of copying audit details. [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

User-visible success must describe a completed commit. This backend change preserves existing native controls, scoped links, focus behavior, and error handling without introducing a new ARIA feed or live region. [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

## Validation and limits

Use real PostgreSQL fault injection at each required history, audit, and Activity insert; assert unchanged request state and absent partial records, then retry successfully. Cover concurrent duplicate mutations, reassignment history continuity, ownership after lock waits, and atomic fan-out cancellation with accurate prior states. Retain existing authentication, CSRF, fresh-session, privacy, and scoped detail tests. Run full repository validation before commit.

No new schema, queue, migration, or worker is needed. This does not backfill historical omissions, make HTTP delivery exactly-once, add client idempotency keys, or cancel a completed download/delete acquired media. A response lost after commit still requires reading current state. External provider effects and request creation remain separate contracts.

The transactional target lookup locks `app_users` and serializes local disabled-state updates. It does not lock the separate Plex profile row: concurrent profile refresh can still change provider eligibility after that lookup. This pre-existing shared eligibility boundary needs its own consistent locking policy across creation, reassignment, and provider refresh; do not infer complete eligibility serialization from the local account test. See the separate [outcome](TRANSACTIONAL_REQUEST_LIFECYCLE_OUTCOME.md) for measured results and remaining release priorities.
