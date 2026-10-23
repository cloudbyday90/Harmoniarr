# Spectral interruption research

Consulted October 23, 2026 through Search Service MCP discovery and official page
reads. Opened Node 24.x documentation reports 24.22.1, matching the app runtime.

| Official source/status | Applied practice |
| --- | --- |
| [Node AbortSignal](https://r2.nodejs.org/docs/latest-v24.x/api/globals.html), runtime documentation | Preserve reasons including null, check pre-aborted signals and retire listeners; reuse the existing step scope. |
| [Node filesystem](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html), runtime documentation | Await admitted file operations and explicitly close the FileHandle; cancellation does not excuse cleanup ownership. |
| [Node child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html), runtime documentation | Retain command ownership through process/stdio close, beyond kill/exit notifications. |
| [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html), database documentation | Lock the current claim for publication; keep long analysis outside the short transaction. Queue selection alone cannot authorize a later write. |
| [OWASP API4:2023](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/), security guidance | Retain independent command/queue/time/output/container bounds while stopping obsolete work. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement | Use fixed claim-loss messages and numeric diagnostics; do not publish paths, peer identities or private tokens in qualification output. |

The following is a project engineering decision, not a standards-conformance claim.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing attempt generation plus locked publication | No migration; refuses requeued/reclaimed stale owners | Counter must remain monotonic; short transaction and observation reads | Implement |
| New claim UUID column | Explicit separate identity | Migration/snapshot work with no additional property required here | Defer |
| Check claim once, then write separately | Fewer lock steps | Requeue/reclaim can race the write | Reject |
| Hold a row lock throughout FFmpeg | Simple exclusive ownership | Long database transactions block recovery and consume connections | Reject |
| Reputation before completion | Existing order | Failed/stale completion can still penalize peers | Move after successful owned completion |
| Atomic reputation outbox | Crash-safe delivery possible | New schema and dispatcher semantics | Next design candidate; do not claim exactly-once delivery now |

Recommended stack: captured claim generation/upstream authority → serialized
observation and one signal → bounded hash/native work with actual drainage →
locked transactional cache/job publication → returned advisory reputation →
fenced cleanup of remaining captured claims. Cancellation after committed
publication is not a rollback; expose the boundary honestly.

Next recommended work: qualify concurrent spectral enqueue/backlog/dedup admission.
The current COUNT/INSERT statement uses a snapshot and does not serialize separate
transactions. This is a source-level finding to reproduce, not a claim from the
interruption tests. Prioritize that resource boundary before a reputation outbox.
