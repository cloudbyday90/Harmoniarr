# Invalidated push subscription pruning

Research and design date: September 13, 2026. This document records the design before implementation. Executed validation and release results belong in a separate outcome document.

## Purpose and scope

Harmoniarr records invalidated browser registrations in `user_push_subscriptions`, retaining the endpoint, authentication secret, public encryption key, user agent, owner, and registration token. The original schema mentions pruning after 30 days, but the current store only marks registrations invalid and excludes them from active reads. It has no scheduled pruning path.

Implement that narrow maintenance policy: a registration becomes eligible only after 30 fixed 24-hour days since invalidation and only when no `notification_queue` row references it. Preserve every queue reference, including sent, failed, and expired history that has not yet completed its separate retention policy. Active and refreshed registrations remain protected. This slice does not change explicit user unsubscribe, provider-response classification, or browser permission.

The existing foreign key uses `ON DELETE CASCADE`. Pruning must prove the absence of queue references under concurrency rather than treating cascading deletion as a convenient cleanup shortcut.

## Transaction and locking protocol

A dedicated ESM pruning store owns one bounded transaction on one database client. Validate an actual integer limit in `1..500` before acquiring a client. Use `BEGIN ISOLATION LEVEL READ COMMITTED` explicitly; the protocol must not inherit a deployment's repeatable-read default. Capture the database cutoff using the fixed 30-day duration, without comparing an application wall clock.

The first command selects at most the requested limit of old invalidated registrations with no queue references, ordered by `invalidated_at, id`. Acquire `FOR UPDATE ... SKIP LOCKED` on those parent rows. Read only the ID, registration token, and exact invalidation timestamp needed for the decision; do not load endpoint or key material. Keep all selected parent locks until commit or rollback.

Run deletion as a separate command on the same transaction client. Its fresh statement snapshot must recheck each selected ID, registration token, exact invalidation timestamp, fixed age cutoff, and absence of any queue reference. Select the cutoff and invalidation values as database text rather than round-tripping through JavaScript's millisecond `Date`, preserving PostgreSQL precision. Return only the number of rows deleted, and report it as confirmed only after commit succeeds. A failed or ambiguous COMMIT must not contribute an invented successful deletion count. Roll back on failure and discard the connection if cleanup fails; never leak an open transaction back into the pool.

`FOR UPDATE` is required here. PostgreSQL documents that it conflicts with `FOR KEY SHARE`; `FOR NO KEY UPDATE` does not. Foreign-key checks use key-share protection to keep the parent from being removed while a child is established. Existing registration upserts also serialize against the parent lock. [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html). PostgreSQL's maintained source documentation describes key-share locking as the mechanism for referential-integrity checks; its master branch is explanatory source evidence, not a substitute for testing the deployed PostgreSQL 18 runtime. [PostgreSQL tuple-locking source notes](https://github.com/postgres/postgres/blob/master/src/backend/access/heap/README.tuplock).

The fresh command is a correctness requirement, not a query-style preference. Under READ COMMITTED, successive commands can see newly committed data; an individual command otherwise starts with its own snapshot. A lock can protect future writes without refreshing an earlier child-table snapshot. [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html).

The concrete risk inferred from those rules is a child insert committed after a pruning statement's snapshot but before that statement obtains the parent lock. A single `WITH locked AS (...) DELETE ... NOT EXISTS (...)` can retain the old child snapshot even though it now holds the parent lock, allowing the cascade to erase newly committed queue work. The separate DELETE rechecks that committed child while its parent remains locked. A child insert beginning after the parent lock must wait for the foreign-key check; if pruning commits first, insertion fails its foreign key rather than creating committed work that pruning silently removes. Verify both orderings with real PostgreSQL.

Re-registration before selection must remain active or be skipped while locked. Re-registration after pruning acquires its lock waits; after pruning commits, the existing upsert may create a new active registration with a new identity. Never delete by endpoint alone or compare only a stale invalidation age. Registration-token rotation and the current row predicates remain part of the decision.

## Indexes and bounded scheduling

Add a partial candidate index on `user_push_subscriptions(invalidated_at, id)` for invalidated rows and a referencing-side index on `notification_queue(subscription_id)`. The queue index covers every status because every retained reference must protect its registration. PostgreSQL does not automatically index foreign-key referencing columns and recommends considering such indexes for parent deletion and key updates. [PostgreSQL 18 foreign-key constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

Use the existing notification maintenance heartbeat rather than adding another timer or worker system. Run subscription pruning after terminal-history cleanup, with its own limit of ten sequential batches of at most 500 registrations and an early stop after a short batch. The two phases can therefore delete at most 10,000 rows per tick in total, with distinct confirmed counts and fixed failure diagnostics. Preserve a shared overlap guard and generation checks between batches and phases; stopping does not claim to cancel an active transaction or allow an old loop to resume after restart. No unbounded loop, cascade-based bulk purge, external network call, or new admin route is required.

Thirty days is an eligibility age, not an exact deletion deadline. Queue references, locks, downtime, and bounded throughput can extend retention. A zero deletion count does not prove that no old invalidated registrations remain. The row cap does not guarantee a wall-clock deadline or bound all index scanning. Validate the actual query plan and concurrent behavior rather than claiming an index always makes the query cheap.

## Privacy and platform semantics

The W3C Push API describes endpoint and authentication material as the data used by the application server to request and authenticate delivery. It separately defines browser subscription deactivation and endpoint identity. Removing Harmoniarr's retained registration row does not revoke browser permission, invalidate a live provider subscription, or retract an accepted message. Harmoniarr's local invalidation and re-registration state must not be confused with the browser's normative endpoint-lifetime rules. [W3C Push API](https://www.w3.org/TR/push-api/).

Thirty days comes from Harmoniarr's previously documented product policy, not a W3C or OWASP requirement. OWASP recommends purpose-specific retention and protecting secrets and sensitive identifiers in logs. Apply that guidance by keeping pruning diagnostics to fixed operation labels and confirmed aggregate counts: no endpoint, key, owner, token, user-agent, payload, or raw database-error content. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

The maintenance operation removes data from the live application tables. It is not evidence of physical erasure from database pages, WAL, replicas, or backups. No browser UI, keyboard, focus, status announcement, or notification-layout change is involved. The original historical migration comments about 410/412 do not describe current invalidation behavior; the current service invalidates only 404/410 registrations using the captured registration identity.

## Alternatives and recommendation stack

| Option | Benefits | Costs and decision |
| --- | --- | --- |
| Keep invalidated registrations indefinitely | Avoids deletion races. | Retains capability and device data without an active purpose; reject. |
| Delete after 30 days and allow queue cascade | Small implementation. | Can erase pending work or recently terminal history; reject. |
| One CTE with parent locks and child absence check | One round trip. | Does not establish a fresh child snapshot after parent locking; reject. |
| READ COMMITTED parent locking followed by a fresh conditional DELETE | Preserves concurrent queue writes and registration refreshes using existing FK enforcement. | Requires a short transaction and meaningful concurrency tests; selected. |
| Change the foreign key or use a table-wide lock | Can establish different deletion guarantees. | Alters explicit unsubscribe behavior or blocks unrelated writes; outside this bounded slice. |

Recommended stack: fixed ESM retention constants; a narrow transactional pruning store; explicit READ COMMITTED isolation; bounded parent row locks; a separate conditional DELETE with full identity and child-reference rechecks; supporting indexes; the existing maintenance heartbeat; aggregate-only diagnostics. Keep current terminal-history retention and subscription registration semantics intact.

## Verification plan

Prove active, recently invalidated, and refreshed registrations survive, while old unreferenced registrations are removed within the limit. Test references from every queue status, including terminal rows inside their retention window. Verify exact timestamp comparisons preserve microseconds and that a spoofed, stale, or mismatched selected token cannot authorize deletion.

Use isolated PostgreSQL with deterministic two-client coordination to test child commit before parent locking, parent lock before child insertion, re-registration before and after selection, competing pruners, rollback, and connection cleanup. Confirm the deployed FK remains immediate and enforced. A test must prove that committed queue rows survive; a foreign-key failure for an insert attempted after deletion is a distinct permitted outcome. Assert commit-confirmed counts and fixed diagnostics on failures. Check the candidate and child-reference indexes, migration/snapshot anchors, and existing notification retention tests.

No live provider credentials or network traffic are necessary. Record actual executed commands and results in the outcome document; this design is not acceptance evidence.

## Open pull request disposition

All open PRs were refreshed through GitHub MCP on September 13, 2026, and their complete one-file patches and immutable heads were read. No remote write, comment, or merge was performed.

| Pull request | Immutable head | Disposition |
| --- | --- | --- |
| [#40: fixture Node 26](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Changes only the controlled-provider fixture from Node 24.19.0 to 26.7.0. A separate runtime-major decision, unrelated to pruning; not applied. |
| [#24: build action 7.2](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Superseded by local pinned build-push-action 7.3.0; applying would downgrade the release workflow. |
| [#23: metadata action 6.1](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Superseded by local pinned metadata-action 6.2.0; applying would downgrade the release workflow. |

No open PR supplies an applicable pruning change. Official links were discovered through searches or official-page links and opened; concurrency consequences identified as inference require the real database regression tests above.
