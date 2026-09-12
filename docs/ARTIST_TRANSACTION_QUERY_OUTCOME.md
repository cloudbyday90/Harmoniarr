# Artist transaction query ordering outcome

## Delivered

The artist save service now awaits previous monitoring policy, release-group selections, and track overrides sequentially on its checked-out PostgreSQL transaction client. A rejected read stops execution before later reads begin, leaving rollback with no sibling query still queued by this block.

The save lock, expected-revision check, normalized inputs, required Activity inserts, snapshot, reconciliation queue, commit, and post-commit diagnostics retain their contracts. No new service, singleton, dependency, schema, or API is necessary for this focused change. Existing pooled read concurrency is unchanged.

## Validation

Four real PostgreSQL suites passed under `node --throw-deprecation --test --test-concurrency=1`: artist save revisions, post-save failure preservation, transactional Activity, and track-override validation (9 tests). The previously observed overlapping-query deprecation did not occur. Two deferred-gate regressions prove sequential client use and rollback only after a failed read settles, without timing sleeps. `npm run test:server` passed all 3,485 tests. Copyright, ESM consistency, server lint, test lint, and test hygiene checks passed. `npm run build` passed both builds; `npm run validate:security` reported zero vulnerabilities. No full client or unrelated integration rerun was needed for this server-only orchestration change.

Docker was rebuilt following LOCAL_DOCKER_WALKTHROUGH.md with existing configuration and data preserved. Image `sha256:73498f81abd8548aae1e849133204cd4e378520f66e03887955a5fba27013090` is healthy, bootstrap completed successfully, and live `/healthz` returned 200. No live artist policies were modified for validation.

## Recommendation and limits

Use sequential awaits on the normal transaction client and retain Promise.all for genuinely independent pool operations. The benefit is explicit query order and clear failure/rollback behavior without relying on an implicit client queue. The tradeoff is additional application scheduling between these reads; this is not a production latency claim. Opt-in pipelining is a separate protocol feature with different error semantics and is unnecessary for these three transaction reads.

No UI feedback or focus behavior changes, so no new W3C interaction mechanism or browser test is needed. Durable Activity and external notification guarantees remain as documented in the preceding designs.

Follow-up implemented: [notification preference failure handling](NOTIFICATION_PREFERENCE_FAILURE_OUTCOME.md). The original next-step finding was: `shouldSendNotification` currently permits sending when preferences cannot be read. For ordinary notifications, prefer preserving the user's potential opt-out by deferring delivery and reporting the degraded read. Define any critical-alert exception explicitly rather than silently allowing all categories.

See the [design, official September 2026 research, alternatives, and PR disposition](ARTIST_TRANSACTION_QUERY_DESIGN.md).
