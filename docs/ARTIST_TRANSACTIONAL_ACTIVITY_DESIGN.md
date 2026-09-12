# Transactional artist-save Activity

Design reviewed September 12, 2026.

Artist detail saves operator monitoring, release and track exceptions, a versioned snapshot, and reconciliation work in one PostgreSQL transaction. Required household Activity currently follows the commit through a best-effort callback. A process failure between commit and callback can therefore leave saved decisions without their Activity entry. Structured warnings expose ordinary callback failures but cannot close that gap.

## Decision and scope

Persist the existing `artist_policy_saved` and `artist_monitored` Activity rows through the save transaction's client before `COMMIT`. The Activity feed already reads `activity_events` in that database, and `activity-event-store.js` already accepts a `queryable` connection. Request cancellation and reassignment use this exact same-database convention in `library-media-request-lifecycle-service.js`.

Use a small ESM `operator-artist-activity-service.js` to construct the established event payloads and await zero, one, or two inserts in a stable sequence. Keep eligibility unchanged: policy Activity requires actual summarized policy changes; monitored Activity requires a transition from unmonitored to monitored. Preserve the triggering actor, artist identity/title, aggregate change summary, snapshot correlation, and existing reconciliation summary. Do not emit raw draft contents, track arrays, notification recipients, error objects, credentials, or provider URLs.

The save service must have a required default transactional Activity dependency. Application/module wiring may supply the shared Activity store; an omitted optional callback must no longer silently disable artist-save Activity. Pass the current transaction client explicitly. Do not use the general best-effort Activity service, a different pool connection, detached promises, or a savepoint that permits decisions to commit after required Activity fails.

Await Activity after building the saved snapshot and reconciliation summary, immediately before commit. A failed Activity insert rolls back monitoring, selections, track exceptions, snapshot, queued reconciliation, and any earlier Activity row in that transaction. This deliberately couples save availability to Activity persistence. It avoids successful saves with missing required household history.

Immediate metadata refresh, external household notifications, and the response projection remain after commit. Their failure remains observable through the existing safe post-save reporter without undoing or retrying the committed save. This change does not promise external notification delivery or completion of reconciliation, searches, downloads, or imports.

## Concurrency and retry semantics

Retain the existing transaction-scoped actor-and-artist advisory lock and required `expectedSnapshotRevision` check before mutation. PostgreSQL releases transaction-level advisory locks with commit or rollback. Keep the lock before snapshot reads; this protects first-save absence as well as existing snapshot revisions. [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).

Both state and Activity become visible together on successful commit; rollback removes both. This is the relevant atomicity guarantee for a same-database destination. [PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html), [COMMIT](https://www.postgresql.org/docs/18/sql-commit.html).

A pre-commit retry after rollback leaves no Activity from the failed attempt. Replaying an already committed save with its old expected revision is rejected with the existing 409 conflict before more mutations. It does not return the previous save result as an idempotent HTTP replay. A new request with the latest revision is a new save, and existing change/transition checks determine its Activity. No event uniqueness migration is necessary for this bounded control flow.

An interrupted database commit acknowledgement or HTTP response can still leave the caller uncertain whether a save committed. Refresh authoritative state and revision before resubmitting; do not claim exactly-once network responses. Database durability and retained history remain subject to deployment configuration, backups, and existing Activity retention. This work does not repair missing historical events.

## Alternatives and final stack

| Option | Advantages | Costs and limits |
| --- | --- | --- |
| Retain detached Activity plus warnings | Save remains independent of Activity availability; already implemented | Can lose Activity after process failure; warnings do not retain delivery intent |
| Insert required Activity in the save transaction | Atomic state and visible history; uses existing store/schema; bounded extra inserts; no relay to operate | Activity write failure now rejects the entire save; adds database work inside the transaction |
| Add a transactional outbox and worker | Appropriate for durable publication to another service or transport; can support retries | Adds schema, queue/relay lifecycle, ordering, retention, duplicate handling, and eventual visibility for a destination already in this database |

Choose direct transactional Activity persistence, the existing PostgreSQL revision/lock protocol, and the existing operation queue for reconciliation. Keep external notifications and immediate refresh on their current observable post-commit boundaries. Revisit an outbox only if durable external delivery becomes a separate product requirement: an outbox retains publication intent transactionally, but delivery may repeat and consumers must handle duplicates. [AWS transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

## Privacy and W3C boundary

Activity is intentional household product history, distinct from restricted operational diagnostics. Preserve its established visibility and payload contract. Safe post-save warnings remain allowlisted phase and snapshot correlation fields; Activity insert errors must not be copied into a new log or response field. This applies OWASP's data minimization and logging-failure guidance without treating required domain persistence as optional logging. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

No UI, focus, or live-region changes are required. Existing save success/error feedback continues to represent the save result; a committed monitoring policy is not a completed acquisition. W3C status-message guidance applies to visible result/progress messages and does not require announcing each internal database insert. [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

The official sources above were discovered through search or previously discovered official links and opened for this review. The recommendation is a local architectural conclusion from those guarantees and the repository's existing same-database Activity boundary.

## Open PR disposition

GitHub MCP returned three open PRs. Their complete all-file patches and immutable heads were refreshed. None applies to transactional artist Activity, and none was applied or merged.

| PR | Immutable head | Disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Unrelated controlled-provider fixture Node 24 to 26 major update |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposed build-push action 7.2 is superseded by local 7.3 |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposed metadata action 6.1 is superseded by local 6.2 |

## Validation and outcome boundary

Use real PostgreSQL integration coverage to prove state and both Activity rows survive external follow-up failure; a failure on the second Activity insert rolls back the first event and all save state; and replay with an old revision creates no additional rows. Verify default/module wiring, event eligibility, actor attribution, existing aggregate payloads, transaction-client forwarding, and failure propagation with focused service tests. No schema migration or new worker is planned. Record executed tests and remaining operational limitations in the separate implementation outcome; this design is not itself evidence that they passed.
