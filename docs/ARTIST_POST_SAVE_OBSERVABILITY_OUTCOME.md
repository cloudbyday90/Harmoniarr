# Artist post-save observability outcome

Follow-up: required artist Activity now commits inside the save transaction; see [transactional Activity outcome](ARTIST_TRANSACTIONAL_ACTIVITY_OUTCOME.md). The evidence below describes the earlier best-effort Activity implementation. Notification, refresh, and projection diagnostics remain applicable.

Notification follow-up: [preference read failures now block initial dispatch](NOTIFICATION_PREFERENCE_FAILURE_OUTCOME.md); the earlier degraded-send behavior below is historical.

## Delivered

Artist save follow-ups now run through a small ESM service after the transaction commits. Activity writes, monitor notifications, metadata refresh dispatch, and projection reads produce fixed structured warning evidence when they fail. A refresh already in progress remains an expected coalesced outcome. The successful save, snapshot revision, and queued reconciliation response remain authoritative.

Warnings use `artist_post_save_failed`, an allowlisted phase, `saveCommitted: true`, an optional validated snapshot UUID, and an optional nonnegative safe-integer revision. No raw error, arbitrary error code, artist name, actor identity, provider URL, draft, or notification content is serialized. Runtime reporting retains its existing redaction layer. Synchronous, rejecting, and stalled diagnostic sinks do not block successful save recovery or initiate a mutation retry.

The Activity boundary now returns `{ recorded: true|false }` without rejecting. Its own recording-failure diagnostics also exclude raw errors and input payloads. The notification broadcast boundary returns an aggregate `{ failed }` result so recipient lookup, delivery, cooldown, and degraded preference reads are observable to the save caller. Ordinary suppression and empty audiences are not failures. A positive count can describe a degraded attempt that still sent a notification; it does not mean nothing was delivered.

## Validation

Focused validation passed: 21 post-save/save-service tests, 27 Activity and callback tests, and 21 notification tests. A real PostgreSQL regression passed with failing Activity persistence, notification outcome, refresh, projection, and diagnostic sinks. It verifies one BEGIN/COMMIT, no rollback/retry, one durable snapshot and queued run, preserved monitoring/selection state, correct beneficiary and triggering-actor scope, and five safe correlated warnings. The projection failure deliberately uses a uniqueness error to guard against accidental mutation retries.

`npm run validate` passed: repository checks, lint, 3,480 server tests, 4,287 client tests, 500 script tests, 146 integration tests (8,413 total), and both builds. `npm run validate:security` passed with zero reported vulnerabilities. No browser rerun was performed for this backend-only change; no UI code or interaction contract changed.

Docker was rebuilt following LOCAL_DOCKER_WALKTHROUGH.md with existing configuration/data preserved. Image `sha256:6b9743ae3f09b2920eddcdbe079d8c5a127a1d71b7448869dddc44f87ba53ddd` is healthy, bootstrap completed successfully, and live `/healthz` returned 200. Failure injection ran against test fixtures, not the walkthrough's saved policies.

## Operational use and limits

Look for the fixed `artist_post_save_failed` event in runtime stderr/container logs. Its phase identifies the failed boundary and its snapshot correlation identifies the committed version. Investigate the relevant read, notification, or metadata-refresh path; do not repeat a successful policy save to repair diagnostics. The client already reloads artist state when a successful response has no projection, without automatically repeating the PUT.

Logs are best-effort operator evidence, not a durable outbox, user-visible Activity failure item, delivery receipt, or automatic recovery mechanism. Process termination may lose detached work. Notification preferences retain their existing behavior on read failure; this slice reports degradation without redesigning delivery policy. No new UI status/focus behavior, schema migration, or dependency is introduced.

## Final recommendation

Keep PostgreSQL as the authority for save/snapshot/reconciliation state, use the modular post-save runner and existing runtime reporter, and consume explicit dependency outcomes. This preserves save availability with a small implementation; it depends on deployment log collection and cannot guarantee eventual event delivery.

Next evaluate durable delivery intent for required Activity events: use the existing PostgreSQL transaction and worker infrastructure with idempotent dispatch and bounded retries. Treat notification delivery guarantees as a separate explicit contract. See the [design, pros and cons, official September 2026 sources, and PR review](ARTIST_POST_SAVE_OBSERVABILITY_DESIGN.md).
