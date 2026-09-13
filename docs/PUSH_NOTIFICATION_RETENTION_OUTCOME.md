# Push notification retention outcome

## Implemented behavior

Terminal notification history now has a retention timestamp. Successful claim-fenced sent, failed, and expired writes record current database time; retries and pending rows retain NULL. Sent completions and direct sent-history inserts use one captured timestamp for both sent_at and terminal_at. The state constraint rejects missing/nonfinite terminal timestamps and timestamps on pending rows.

The additive migration preserves known sent timestamps. Historical failures, expired records, and sent rows without a recorded acceptance time receive a shared migration-time retention baseline, granting seven days of grace. That baseline is not a reconstructed completion time. The migration deletes no history.

A dedicated ESM retention store replaces the old unrestricted sent-only purge. Each atomic batch selects at most 500 eligible sent/failed/expired rows older than seven 24-hour days using database time, a matching partial index, primary-key ordering, and FOR UPDATE SKIP LOCKED. Both selection and deletion exclude claimed and pending rows. It returns only a verified deletion count.

The existing six-hour heartbeat runs at most ten sequential batches, stopping after a short batch. It suppresses overlapping ticks, stops subsequent batches after stop/restart, preserves confirmed partial counts on failure, and emits fixed contained diagnostics. Stopping does not cancel an SQL statement already running. A full-budget result is a capacity signal, not proof of a remaining backlog; a short or empty result cannot prove that no locked eligible rows remain.

## Recommendation stack and tradeoffs

Use the terminal-state database invariant, claim-fenced timestamps, partial index, narrow retention store and policy constants, and existing interval heartbeat. This limits each scheduled pass to at most 5,000 row deletions while covering failed and expired payloads that previously accumulated indefinitely. All new application code is native ESM; no new scheduler, external service, or purge endpoint is added.

The costs are a coordinated migration/writer upgrade and eventual cleanup when downtime, locks, or large backlogs exceed the batch budget. Seven days is the existing product diagnostic window, not a standards-mandated duration or exact deletion deadline. This bounds row mutations, not all query scanning or elapsed database time. Deletion removes live table history; it does not prove physical erasure from database pages, WAL, replicas, or backups, or remove browser notifications.

The separate [design document](PUSH_NOTIFICATION_RETENTION_DESIGN.md) records official September 2026 sources, alternatives, W3C/privacy boundaries, and open PR reviews. All three open PR patches were unrelated or superseded; none was applied or merged.

## Validation and deployment

Focused checks passed: 20 heartbeat/module/interval/startup tests; 11 store and prior expiry/claim-fencing checks; and one new real PostgreSQL retention integration test. The latter covers exact migration replay and unknown-history grace, finite state constraints, matching sent timestamps, stale claims, retries, recent completions on old rows, pending/active preservation, bounded batch draining, and concurrent deletion with rollback and repeat.

Schema verification passed 103 source migrations, fresh snapshot bootstrap, and 113 critical anchors. Dependency-security validation reported zero npm audit vulnerabilities. These checks are not a comprehensive security audit or live-provider/browser delivery evidence.

The documented local Docker build/up/bootstrap sequence completed with existing data and configuration preserved. The container is healthy, `/healthz` returned HTTP 200, and bootstrap confirmed the existing admin. Image: `sha256:8fe65ab0ac739f747ef26c193ba86f76eb2804a88a7e4de517f533ccd2eb8c40`.

Full `npm run validate` passed repository policy checks, lint, test hygiene, all 8,562 tests (3,621 server, 4,287 client, 500 script, 154 integration), and client/server builds. No tests failed, skipped, or were cancelled.

## Next release item

Prune long-invalidated push subscriptions in bounded batches. Invalidated registrations currently retain endpoint capabilities, authentication material, and user-agent information without a pruning path. Use an explicit age policy, recheck current invalidation and registration identity under locking, and retain any subscription still referenced by notification_queue. The foreign key cascades on deletion, so checking only pending references would bypass terminal-history retention.

The benefit is less unnecessary storage of obsolete subscription material. The cost is careful coordination with re-registration and foreign-key races; prove those cases against PostgreSQL before rollout. Keep this separate from explicit authenticated user unsubscribe behavior.
