# Local push queue expiry outcome

## Implemented behavior

Queued notifications now carry a persisted database expiry. New inserts use current database time plus a strictly validated integer TTL. The additive migration backfills existing rows from their original creation time and TTL, preserving their age rather than renewing them at upgrade. Both queue and sent-history writers supply the required column; no default or trigger silently grants an old writer a fresh lifetime.

Retries preserve expiry. An expired unclaimed row remains eligible for a worker even if its next retry is far in the future. Expiry does not steal an active claim, and finalization still requires the original claim token and a valid lease. Sent, failed, and expired terminal rows remain outside pending claims.

Coalescing accepts a new payload, TTL, and lifetime together only for a still-fresh, pending, unclaimed, never-attempted row. Its creation time remains fixed. A locked candidate is checked against current database time after the lock is acquired; an update blocked past expiry cannot revive it. The existing fallback creates independent work for a new payload when its conditional update loses a race.

Every worker checks lease and freshness together after subscription/account policy preparation, including denied or unavailable policies. It subtracts monotonic query elapsed time from both database-relative durations. Eligible sends retain the existing 20-second lease gate, but their transport timeout can shrink below 15 seconds. Provider TTL is reduced after reserving that entire transport budget. If no positive whole transport millisecond remains after reserving one provider second, the worker expires the row locally without network I/O. This deliberately conservative cutoff does not add protocol TTL-zero delivery.

## Recommendation stack and tradeoffs

Use persisted database expiry, atomic coalescing, one combined preflight, reduced transport/provider budgets, and existing claim-fenced completion. This prevents retries or downtime from renewing old content while allowing genuinely new accepted content its own lifetime. All new application code is native ESM, with TTL validation in a small dedicated module and SQL remaining in the store.

Costs are an additive migration/index, coordinated writer upgrade, strict TTL inputs, and conservative loss of nearly expired work. Positive queue TTLs are limited to the PostgreSQL integer range; that is a product/storage bound, not the protocol maximum. Provider acceptance, ambiguous transport outcomes, clock corrections, process suspension, and browser display remain outside an exactly-once or hard real-time guarantee. The existing expired counter also includes account/policy/subscription suppression.

The separate [design document](PUSH_QUEUE_EXPIRY_DESIGN.md) records official September 2026 sources, W3C/RFC distinctions, alternatives, rollout, and all three open PR reviews. No applicable PR patch was found; no PR was applied or merged.

## Validation and deployment

Focused checks passed: 36 dispatcher tests, 7 store tests, and a real PostgreSQL expiry integration test. The integration reconstructs the legacy queue shape in a disposable database and executes the exact migration to prove backfill, then exercises expired future retries, active lease protection, adaptive transport budgets, coalescing/fallback, and actual database lock waiting. It caught an interval-parameter inference issue; explicit integer casts corrected it before the passing run.

Schema verification passed 102 source migrations, fresh snapshot bootstrap, and 110 critical anchors. Dependency-security validation reported zero npm audit vulnerabilities. These checks are not a comprehensive security audit or live-provider/browser delivery proof.

The documented local Docker build/up/bootstrap sequence completed while preserving existing data and configuration. The container is healthy, `/healthz` returned HTTP 200, and bootstrap confirmed the existing admin. Image: `sha256:3e6abed089fc00d2c64ac4032b564ab6995c17bc55e2b01db26f7a72f6fe8587`.

Full `npm run validate` passed repository policy checks, lint, test hygiene, all 8,547 tests (3,607 server, 4,287 client, 500 script, 153 integration), and client/server builds. No tests failed, skipped, or were cancelled.

## Next release item

Add bounded retention for terminal notification history. The current periodic cleanup deletes only sent records older than seven days. Failed and expired rows retain their payloads indefinitely. Introduce a trustworthy terminal timestamp, explicit retention policy, and bounded deletion that excludes pending and actively claimed work. Test transitions, interrupted cleanup, and age boundaries before considering separate invalidated-subscription pruning.

The benefit is controlled storage growth and less unnecessary payload retention. The cost is a schema/retention decision that trades historical troubleshooting detail against storage and privacy; preserve enough recent terminal evidence for operators.

The terminal-history follow-up is implemented in the separate [notification retention outcome](PUSH_NOTIFICATION_RETENTION_OUTCOME.md), with its design, validation, and next release item.
