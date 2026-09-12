# Queued notification preference outcome

## Delivered design

The push worker checks current recipient eligibility before each network attempt. A narrow raw-state store reads account identity, disabled state, role, and stored preferences. An ESM delivery policy service applies recognized category preferences and current administrator eligibility. The worker also checks that the subscription still belongs to the queued recipient.

Intentional opt-outs, disabled or missing accounts, administrator demotion for administrator-only categories, unrecognized event types, and missing or reassigned subscriptions do not reach transport. These rows use the existing terminal `expired` state; `expiredCount` therefore includes policy suppression. Application opt-outs do not invalidate browser subscriptions. Raw malformed preferences and unavailable account reads use existing retry scheduling and become `failed` when the normal retry budget is exhausted. Every retry reads current state again.

The previous enqueue-time gate remains in place. Its unavailable attempts still have no durable replay; this change applies to rows already retained in the push queue.

## Validation

Completed validation:

- All 65 focused tests passed across policy, raw store, dispatcher, preference, transport, queue, and heartbeat boundaries.
- Real PostgreSQL regression passed through the production push module wiring. It covers opt-out after enqueue and after transport retry, unavailable-read recovery/exhaustion, malformed persisted preferences, disabled account, role demotion, generic suppression, and endpoint reassignment.
- `npm test` passed all lint targets, test hygiene, and 8,468 tests: 3,532 server, 4,287 client, 500 script, and 149 integration tests. There were no failed, skipped, or cancelled tests.
- `npm run build`, copyright and ESM checks passed.
- `npm run validate:security` passed Compose policies and npm audit with zero reported vulnerabilities. This is not a comprehensive security audit.
- The local Docker walkthrough was rebuilt and restarted while preserving saved environment values and data mounts. Bootstrap confirmed the existing administrator. The container is healthy and `/healthz` returned HTTP 200 at `http://127.0.0.1:47956`.

Image: `sha256:3a4009028a40dd84fa1d5323126c082ff99661dc1d1122b4bd63391e35073c49`.

No live push service or browser-delivery evidence is claimed. No browser UI changed.

## Recommendation and tradeoffs

Use the existing push module and queue with a raw account-state store, a small delivery policy service, and per-attempt checks. This adds one account read per eligible subscription attempt and can miss notifications during prolonged outages. It prevents stale enqueue-time preferences from being treated as permanent permission and permits recovery during short outages without another queue or schema migration.

Worker failure diagnostics now use fixed text and tolerate throwing or rejected logging sinks. Existing lower-level transport diagnostics and queue persistence failure behavior are outside this repair. Preference failures are isolated per recipient; a failure to persist queue state can still abort the batch.

The gate is a check immediately before transport, not a lock spanning external I/O. Concurrent changes can race the successful check; already submitted messages cannot be recalled. Browser permission and application category preferences remain separate controls. Provider TTL does not expire local queue rows.

## Next release item

Follow-up implemented: [push queue claim fencing](PUSH_QUEUE_CLAIM_FENCING_OUTCOME.md). The original recommendation was to fence queue claims so that a worker whose claim has expired cannot finalize a row reclaimed by another worker. The current worker claims up to 50 rows for a 60-second window and processes them sequentially; final state updates only match the row ID. Long network calls, multiple workers, or restarts can expose stale writes and duplicate delivery. Design claim tokens, conditional completion, and bounded transport/claim processing together. Preserve at-least-once delivery language: a database fence cannot make an external push submission exactly once.

See the separate [design, current official sources, alternatives, and PR disposition](QUEUED_NOTIFICATION_PREFERENCE_DESIGN.md).
