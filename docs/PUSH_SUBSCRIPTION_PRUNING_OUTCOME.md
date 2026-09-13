# Invalidated push subscription pruning outcome

Implemented September 13, 2026. The separate [design document](PUSH_SUBSCRIPTION_PRUNING_DESIGN.md) records discovered official sources, alternatives, platform semantics, and PR disposition.

## Delivered behavior

Invalidated registrations become eligible after 30 fixed 24-hour days only when no notification queue row references them. Pending, sent, failed, and expired references all protect the parent. Active and refreshed registrations remain protected. Explicit user unsubscribe behavior is unchanged.

The dedicated native ESM store owns a bounded Read Committed transaction. It locks up to 500 candidate parents with FOR UPDATE SKIP LOCKED, then uses a separate DELETE command with a fresh snapshot to recheck every queue reference and the captured ID, registration token, exact invalidation timestamp, and cutoff. PostgreSQL timestamp text preserves microseconds. Counts are reported only after successful commit; failures use fixed diagnostics, attempt rollback, and discard the connection. An ambiguous commit is not reported as a confirmed deletion.

A partial invalidation index and a queue-reference index support candidate selection and child checks. The existing six-hour maintenance heartbeat runs history cleanup first, followed by up to ten sequential pruning batches. Each phase has its own 5,000-row budget and confirmed counts. Shared overlap and stop/restart protection cover both phases; a history error skips pruning. A small domain helper holds the common bounded loop, avoiding another timer or enlarged singleton.

## Recommendation stack and tradeoffs

Use fixed policy constants, the narrow transactional store, explicit isolation and parent locks, fresh conditional deletion, supporting indexes, the existing heartbeat, and aggregate-only diagnostics. This reduces unnecessary retention of obsolete endpoint and authentication material while preserving committed queue work.

The cost is an additional database command and short transaction per batch, plus concurrency tests. Locks, queue references, downtime, and backlog can extend retention beyond the eligibility age. Row limits do not establish query-duration or scan bounds. Deletion affects live tables; it does not prove physical erasure from WAL, backups, or database pages, revoke browser permission, or retract delivered notifications.

## Validation

Focused checks passed: four pruning-store unit tests, 33 heartbeat/module/interval/startup lifecycle tests, and one real PostgreSQL pruning integration test. The integration test covers all queue-reference states, bounded draining, refresh-first and prune-first writer orderings, rollback recovery, and explicit Read Committed isolation even when the connection defaults to Repeatable Read.

The critical race fixture establishes the selection snapshot, pauses before parent locking, commits a child reference, and then allows candidate selection to finish. It proves that the separate deletion snapshot preserves the committed child and its parent. This is isolated database evidence, not live-provider delivery evidence. Independent agent review found no material blockers.

Schema verification passed 104 migrations, fresh snapshot bootstrap, and 115 critical anchors. Dependency-security validation passed with zero npm audit vulnerabilities; this is not a comprehensive security audit.

Full `npm run validate` passed repository policy checks, lint, test hygiene, all 8,577 tests (3,635 server, 4,287 client, 500 script, 155 integration), and client/server builds. No tests failed, skipped, or were cancelled. The initial copyright check identified a missing standard header in the new helper; it was corrected before the successful complete run.

The documented local Docker build/up/bootstrap sequence completed with existing mounted data and configuration preserved. The container is healthy, `/healthz` returned HTTP 200, and bootstrap confirmed the existing admin. Final image: `sha256:0fbbc4bc9d6945bfc443ecccd63634e711008ac2c5ccbaceb2d99113cf2b9643`. This is local deployment evidence, not published-image provenance or upgrade acceptance.

## Open PR disposition

All three open PRs were inspected through GitHub MCP. PRs #23 and #24 propose action versions already superseded locally; #40 changes a provider fixture to Node 26 and requires a separate runtime-major decision. No applicable patch was applied, and no PR was merged. Immutable heads and links are recorded in the design document.

## Next release item

Refresh immutable packaged-image acceptance for the current schema. Extend the existing fresh-install, restart, and upgrade data probe to verify notification/subscription continuity and the new indexes. The prior recorded candidate used 98 migrations; this source change now includes 104. Reuse the existing candidate-validation tooling with isolated generated data. Published provenance and an accepted upgrade baseline require their own evidence; a local image label cannot supply that assurance.
