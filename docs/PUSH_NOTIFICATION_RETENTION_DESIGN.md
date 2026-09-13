# Push notification history retention

Research and design date: September 13, 2026. This document records the decision before implementation. Validation results belong in the separate outcome document.

## Purpose and existing behavior

Harmoniarr's notification queue retains application payloads while it prepares, retries, and records Web Push attempts. The existing six-hour cleanup heartbeat removes only sent rows older than seven days and uses an unbounded delete. Failed and expired rows can therefore retain payloads indefinitely. Queue creation time cannot safely represent the end of a long-running or retried delivery attempt.

Extend the existing heartbeat to remove eligible terminal history in bounded batches. Preserve pending work, including expired content awaiting its fenced terminal transition, and preserve the queue's claim, preference, freshness, endpoint, and registration checks.

## Retention timestamp and migration

Add nullable `terminal_at TIMESTAMPTZ` with a static state constraint: pending rows have no terminal timestamp; sent, failed, and expired rows have a finite, non-null timestamp. New pending inserts, claims, coalescing, and retry writes retain `NULL`. Successful fenced terminal writes set the timestamp from the database's current clock. A stale completion must neither change the state nor establish a retention timestamp.

For sent completions and direct sent-history inserts, use one captured timestamp for both `sent_at` and `terminal_at`. For a claimed completion, capture the clock in a materialized CTE that depends on the already materialized, row-locked ownership result; an independent clock expression can otherwise execute before a lock wait. This records provider acceptance as the existing sent status, without claiming delivery to a browser or that a person saw the notification. Failed and expired completions receive their terminal timestamp only when the terminal status is durably written. A retry remains pending and does not start or renew terminal retention.

Backfill sent rows with a recorded `sent_at` from that value. Historical failed and expired rows have no trustworthy completion timestamp; assign a single migration-time retention baseline. Apply the same conservative baseline to a legacy sent row whose `sent_at` is absent. Leave pending rows `NULL`. This grants unknown historical completions a new seven-day grace period. The baseline is not a reconstructed failure time and must not be presented as one. The migration performs no history deletion.

Update the generated schema snapshot and relevant column/constraint/index anchors. Stop older writers during the coordinated upgrade: terminal writes that do not maintain the new invariant must fail explicitly rather than silently create uncollectable rows. No default or trigger should fabricate terminal timestamps on pending inserts.

## Bounded cleanup

Keep the existing heartbeat, startup wiring, initial tick, and six-hour schedule. Retain a seven-day duration expressed as seven 24-hour days. Small ESM policy constants define the bounds, a narrow retention store owns SQL, and the existing heartbeat orchestrates batches and contains failures. No additional service layer is needed. Replace the old unbounded sent-only cleanup path rather than retaining a callable unrestricted purge helper.

Each tick performs at most ten sequential atomic batches, each deleting at most 500 rows. Capture a single database-clock cutoff for each batch, select rows whose status is sent, failed, or expired and whose `terminal_at` is strictly earlier than that cutoff, ordered by `terminal_at, id`. Require `claim_token IS NULL`. Lock selected rows with `FOR UPDATE SKIP LOCKED`, then delete only those IDs while retaining the terminal eligibility predicates. A partial index on the terminal timestamp and ID should match the terminal/unclaimed predicate. Return a deleted count without loading or returning payloads, recipient IDs, subscription endpoints, or row IDs to the heartbeat.

PostgreSQL documents a limited CTE selection followed by `DELETE ... USING` because `DELETE` has no direct `LIMIT` clause. Its related update guidance describes `SKIP LOCKED` for concurrent batches. Use stable primary keys within this single statement. [PostgreSQL DELETE](https://www.postgresql.org/docs/current/sql-delete.html), [PostgreSQL UPDATE](https://www.postgresql.org/docs/current/sql-update.html).

Stop after a short batch or the ten-batch limit. Preserve the existing overlap guard. Check the heartbeat generation between batches so stopping prevents another batch from starting, including an old loop following stop/restart; stopping does not cancel an active SQL statement. Return confirmed `deletedCount`, `batchesCompleted`, and `batchLimitReached` without inferring a remaining backlog. If a later batch fails, preserve the confirmed count from completed batches and report a fixed failure through a contained error callback without copying the raw database error. Skipped locked rows remain eligible for a later tick. Concurrent cleaners must not double-count deletion. Do not loop until empty or add an unbounded final sweep. The 5,000-row per-tick ceiling bounds mutations, not all database scanning, lock acquisition, or execution time; verify the access path and relevant contention behavior with PostgreSQL tests.

Seven days is an eligibility age, not an exact deletion deadline. Downtime, competing locks, clock adjustments, and a backlog larger than the per-tick budget can extend retention. The selected defaults allow up to 5,000 deletions per tick, without guaranteeing backlog convergence. Avoid claiming complete deletion or an empty backlog from a zero-row result when other rows may be locked. PostgreSQL distinguishes actual current time from transaction-start time; use the database clock to avoid application/database wall-clock comparisons. [PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html).

## Privacy and platform boundaries

Seven days is the existing product policy, not an OWASP or W3C mandated duration. The queue is operational delivery history; it is separate from durable Activity, audit records, and operator decisions. OWASP recommends purpose-specific retention and limiting sensitive data in logs. Apply that principle here by removing aged payload-bearing terminal rows and reporting only bounded aggregate outcomes or a fixed cleanup failure message. Do not copy deleted content into a new diagnostic log. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

The W3C Push API describes message encryption and push-service-visible metadata, including timing and size. That protocol protection does not erase plaintext application queue payloads or define their retention period. Deleting Harmoniarr history does not revoke a message already accepted by a provider, remove a displayed notification, change browser permission, or delete backups. This slice changes no browser UI, focus, keyboard, or live-region behavior. [W3C Push API security and privacy considerations](https://www.w3.org/TR/push-api/).

Database deletion is logical removal from the live table, not proof of immediate physical erasure from PostgreSQL storage, WAL, replicas, or backups. Subscription registration pruning and its cascading effects on queued work remain separate. No new admin purge route, external scheduler, partitioning scheme, or provider request is introduced.

## Alternatives and recommendation stack

| Option | Benefits | Costs and decision |
| --- | --- | --- |
| Keep sent-only cleanup | No migration or worker changes. | Failed and expired payloads accumulate; reject. |
| Delete all terminal rows by creation time | Small query change. | Can immediately remove a recently completed old attempt; reject. |
| Delete terminal rows immediately | Minimizes live payload retention. | Removes the existing diagnostic window and requires broader product review; defer. |
| Add a terminal timestamp and bounded heartbeat cleanup | Preserves a useful diagnostic period, covers every terminal outcome, and limits each mutation batch. | Requires migration and writer updates; backlog can extend retention; selected. |
| Partition or run a separate retention worker | Can support much larger history volume. | Adds operational and schema complexity before evidence requires it; defer. |

Recommended stack: a database state invariant and partial retention index; existing claim-fenced terminal writers; a narrow ESM retention store and policy constants; the existing interval heartbeat; aggregate-only diagnostics; focused unit and real PostgreSQL concurrency/migration tests. Keep the 500-row batch, ten-batch tick ceiling, and six-hour cadence explicit so future observed backlog can motivate a separately reviewed capacity change.

## Verification plan

Verify exact sent timestamp equality, pending/retry timestamps remaining null, terminal failures starting retention only on successful fenced writes, and stale tokens failing without timestamp changes. Test migration backfill of recorded sent history, conservative unknown-completion grace, untouched pending rows, and rejection of inconsistent state writes.

With real PostgreSQL, create more than one batch of eligible mixed terminal states and prove one store invocation deletes at most 500, preserves fresh terminal and pending rows, and returns the actual count. Exercise two concurrent cleaners and a separately locked eligible row: other eligible rows should be deleted, the locked row should remain available to a later invocation, and no row should be counted twice. Check the terminal index and the database-clock cutoff. Test the ten-batch ceiling, short-batch stop, stop-generation handling, and preserved confirmed counts when a later batch fails. Verify fixed safe diagnostics without logging raw database errors or notification content.

Run the relevant server tests, migration/schema checks, integration and recovery validation before release. No live provider credentials or network sends are needed to establish this cleanup contract. Record executed commands and actual results in the outcome document; this design itself is not test evidence.

## Open pull request disposition

Refreshed all open pull requests through GitHub MCP on September 13, 2026, then fetched each full changed-file patch and immutable head. All three patches contain one changed file. No merge, comment, or remote mutation was performed.

| Pull request | Immutable head | Local applicability |
| --- | --- | --- |
| [#40: controlled provider fixture Node 26](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Changes only the fixture image from Node 24.19.0 to 26.7.0. A separate runtime-major decision; unrelated to retention and not applied. |
| [#24: Docker build action 7.2](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Superseded by the local pinned 7.3.0 action at `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a`; do not downgrade. |
| [#23: Docker metadata action 6.1](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Superseded by the local pinned 6.2.0 action at `dc802804100637a589fabce1cb79ff13a1411302`; do not downgrade. |

No open PR provides an applicable retention patch. Official sources above were discovered through web search or official-page links and then opened; source guidance and local product choices are distinguished throughout.
