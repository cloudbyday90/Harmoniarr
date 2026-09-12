# Fenced push queue claims

Design reviewed September 12, 2026, against baseline `16217a8`.

Queued push delivery now checks current recipient preferences and eligibility before sending. Queue ownership remains weaker: a claim advances `next_attempt_at` for 60 seconds, while batches of up to 50 rows are processed serially. Completion updates match only the queue row ID. If a lease expires and another worker reclaims that row, the old worker can overwrite the new worker's retry or terminal state. Producers can also coalesce a new payload into a row whose previous payload is already being delivered.

## Accepted claim contract

Add a nullable UUID `claim_token` to `notification_queue` through an additive migration, with a check requiring a non-null token to belong to a pending row. Existing unclaimed rows remain null. Every claim, including reclaim after expiry, assigns a fresh token to each returned row through `harmoniarr_generate_uuid()` and increments attempts. Keep `next_attempt_at` as the existing lease deadline while claimed and as the eligibility time while unclaimed. Return the token only through the internal queue-store projection used by the worker.

Continue to claim a bounded set of eligible pending rows using `FOR UPDATE SKIP LOCKED` in the atomic claim statement. Use a deterministic tie-breaker with next-attempt time for candidate selection, without promising global fairness or return order under concurrent consumers. Database time determines eligibility and lease deadlines; avoid relying on the application clock for ownership.

Every worker completion or retry update must be a conditional write matching row ID, the exact non-null token, pending status, and a lease that is still valid at the database's time check. A successful update clears the token. Terminal outcomes change status; a successful retry schedules its next attempt and becomes unclaimed. A stale, missing, malformed, cleared, or replaced token cannot complete the row through an ID-only fallback.

Return a boolean based on the actual persisted update, using `UPDATE ... RETURNING` or the affected-row count. An update that changes zero rows is a normal lost-claim outcome, not a successful completion. Retain parameterized SQL and narrow store methods; do not interpolate identifiers or token text into SQL.

## Worker behavior and truthful counters

Before beginning an external send, check that the claimed row is still pending, has the same token, and has an unexpired lease. Perform this final ownership check after potentially slow subscription and policy reads. A false result skips the network send; a lookup failure must not authorize it. All terminal suppression and retry paths still require the same conditional completion update.

Increment delivered, expired/suppressed, failed, and retried counters only when the corresponding state update reports strict `true`. `claimedCount` continues to describe rows originally returned by the claim. Add `claimLostCount` for missing/malformed tokens, a false current-claim preflight, or a false conditional completion. Do not relabel these outcomes as delivery failure or success. Existing `expiredCount` still combines unavailable subscriptions, intentional suppression, and ineligibility. A small per-row delivery worker should return one outcome for the dispatcher to aggregate.

Required persistence failures must not become raw-error logs or expose tokens, recipient state, subscription endpoints/keys, or message payloads. A generic bounded warning may report the worker failure through the existing diagnostic boundary. Reporting failure must not authorize a send or invent a successful queue update.

Database preflight and completion exceptions propagate rather than becoming an invented lost-claim or failed-delivery result. In particular, do not issue a second failure update after a sent-state write throws: the original write may have committed despite an interrupted acknowledgement. Preserve the existing higher-level heartbeat failure boundary.

## Coalescing safety

Only pending rows with `attempts = 0` and `claim_token IS NULL` are eligible for coalescing, both in the candidate read and in the conditional payload update. Once first claimed, a row's payload and TTL remain immutable through retries and reclaim, even after its token clears or lease expires. A producer instead enqueues a new row. This preserves the payload/TTL captured by every attempt of the original notification.

A producer can lose the race between reading a candidate and updating it because a worker claimed the row. Compare candidate IDs with the rows actually returned by the update. Enqueue once per subscription if it had no candidate row or any of its observed rows lost the update race, including partial overlap where another candidate row was updated successfully. Report `updated` from actual updates and `queued` from actual fallback inserts, rather than counting candidate IDs. Do not overwrite a claimed row to avoid a second queue entry.

This fallback prevents losing the new notification when coalescing loses to a worker. It is not a unique producer deduplication guarantee: concurrent producers can still create separate rows, and an older already claimed payload may still be sent before the newer row.

## Time, rollout, and external-delivery limits

PostgreSQL `now()`/`CURRENT_TIMESTAMP` use transaction start; `statement_timestamp()` uses statement start; `clock_timestamp()` reads the actual clock during execution. Use the database clock deliberately for lease-validity evaluation so a long transaction does not supply a stale transaction timestamp. Keep SQL operations short. The ownership token is what prevents a completion from modifying a replacement claim; a time predicate is not a lock held through external work.

Deploy the new schema and worker contract together using the normal stopped-worker upgrade boundary. Do not run old and new delivery workers concurrently: old code's ID-only completions bypass the new conditional update. Existing pending null-token rows can receive tokens through the new claim path; do not assert that the additive column retroactively fences already running old code.

The final preflight and completion check cannot make external delivery exactly once. A lease can expire after preflight or during HTTP I/O; the provider can accept a message before the worker loses ownership or before the sent update fails. A replacement attempt may send again. No database lock should be held across that network request, and this slice does not revoke messages already submitted to the provider.

Provider acceptance remains different from confirmed browser delivery or user attention. The change also does not add local queue-age expiration, lease renewal, a transport deadline, or a strict lifetime attempt ceiling. The next step is to coordinate bounded transport duration with claim duration and batch scheduling; local queue-age expiration remains a separate policy.

## Official sources

Sources were discovered through search or previously discovered official links, then opened for this review:

- [PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html) documents `SKIP LOCKED` as useful for competing queue consumers while warning that it does not provide a general consistent view. This supports bounded queue claiming, not a strict FIFO claim.
- [PostgreSQL UPDATE](https://www.postgresql.org/docs/18/sql-update.html) specifies that `RETURNING` describes rows actually updated and that zero updated rows is not an SQL error. This supports conditional completion results and coalescing fallback.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) explains that under Read Committed a concurrent updater's committed row version is reconsidered against the update condition. A token in that condition prevents an older worker from matching a replacement claim.
- [PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html) distinguishes transaction, statement, and actual clock time. The opened `current` documentation identifies PostgreSQL 18. Database time checks must match the intended lease semantics.
- [RFC 8030, HTTP Web Push](https://www.rfc-editor.org/info/rfc8030/) distinguishes acceptance of a push message from delivery to a user agent and specifies a separate receipt mechanism. Its provider TTL governs provider retention, not time spent in Harmoniarr's queue.
- [W3C Push API](https://www.w3.org/TR/push-api/) separates application-server submission, push-service delivery, and browser subscription permission. The opened published document is the December 1, 2025 Working Draft. It does not define Harmoniarr's database ownership protocol. No browser permission, focus, keyboard, or notification presentation changes are required here.

## Alternatives and final recommendation stack

| Option | Advantages | Costs and limits |
| --- | --- | --- |
| Keep ID-only completion | No migration or caller changes | Old workers can overwrite replacement work; counters can overstate persisted outcomes |
| Token-only conditional completion | Protects against replaced ownership | Allows a worker to complete after its unreclaimed lease expires |
| Token, pending status, and lease checks plus preflight | Prevents stale state writes, avoids sends already known to have lost ownership, reuses the queue | Requires migration and caller/test updates; cannot prevent every external duplicate |
| Hold row locks during the HTTP request | Blocks some local reclaim races | Holds database resources through unpredictable I/O and does not solve ambiguous provider acceptance |
| Add full lease renewal and transport cancellation now | Can reduce lease loss and duplicate opportunities | Broadens the lifecycle significantly; cancellation still cannot recall provider-accepted work |

Choose the additive claim token, short conditional store operations, current-claim preflight, counters based on confirmed writes, and coalescing limited to never-claimed rows with fallback enqueue. Preserve small ESM service/store modules and the existing queue and policy gates. Add claim-duration/transport coordination as the next bounded release improvement.

## Open PR disposition

GitHub MCP returned three open PRs. Complete all-file patches and immutable heads were refreshed; none applies to queue claim fencing. None was applied or merged.

| PR | Immutable head | Disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Unrelated controlled-provider fixture Node 24 to 26 major update |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposed build-push action 7.2 is superseded by local 7.3 |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposed metadata action 6.1 is superseded by local 6.2 |

## Validation and outcome boundary

Use real PostgreSQL to claim a row, expire/reclaim it with a new token, and prove the old token cannot mark sent, failed, expired, or retried; verify the current token succeeds exactly once and is cleared. Exercise an expired but unreclaimed token, independent concurrent claimers, migration/bootstrap compatibility, and coalescing races with a claimed row. Worker tests must cover preflight failure without network I/O, each false completion result without incrementing its counter, and per-subscription fallback enqueue after a lost coalescing update. Use controlled synchronization rather than timing guesses. Record executed tests, schema evidence, and remaining external-delivery limits in the separate outcome document.


## Deadline evaluation after lock acquisition

Completion uses a materialized `owned` query that locks the matching pending claim and returns its ID and deadline. The outer update checks `owned.next_attempt_at > clock_timestamp()` and rechecks the token and pending state. Referencing the locked query's deadline is intentional: a deadline predicate on the outer table can be evaluated before a lock wait. The regression holds the row without modifying it, observes the blocked completion, waits until database time reaches the lease deadline, and then releases the lock. The completion must return false without changing the pending row.
