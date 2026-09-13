# Push queue claim fencing outcome

## Delivered behavior

Each claim now receives a fresh UUID token. Completion, terminal suppression, and retry scheduling require the matching token, pending status, and an unexpired lease; successful writes clear the token. A consumed token cannot finalize twice, including after scheduling a future retry. Missing or malformed tokens fail closed.

Completion locks the matching row before evaluating its deadline, using the deadline returned by that locking query. The worker checks current ownership immediately before transport. Stale preflight or rejected completion contributes to `claimLostCount`; delivered, expired, failed, and retried counters increment only after the matching state write succeeds. Queue read/write errors remain distinct errors and do not trigger another ambiguous completion write.

The per-row delivery worker is a separate ESM service. Existing recipient policy checks remain in place. Claimed payloads are immutable: coalescing only updates never-claimed rows, and an update that loses to a claim queues the new event separately for the affected subscription. Update counts describe rows actually changed.

## Schema and rollout

The additive migration adds nullable `notification_queue.claim_token` and a constraint allowing a non-null token only on pending rows. Existing rows remain readable and get a token on their next claim. The schema snapshot was regenerated through the repository workflow; the column and constraint are critical schema anchors.

Stop old delivery workers before running the new version. The old ID-only completion code does not implement this contract; mixed old/new workers are unsupported. The local walkthrough replaces its single app container and preserves saved data and environment configuration.

## Validation

Completed focused validation:

- All 44 focused delivery tests and five focused queue-store tests passed.
- Two PostgreSQL integrations passed: the new claim-fencing fixture and the previous queued-preference regression. Coverage includes expired/replaced claims, consumed retry tokens, competing consumers, completion blocked until after expiry, coalescing races, and current recipient policy.
- The schema snapshot was regenerated from 100 migrations using `npm run update:schema-snapshot`. `npm run db:check-schema` passed: 100 applied migrations, zero drift/pending/unknown migrations, successful fresh snapshot bootstrap, and all 108 critical anchors matching.
- `npm run validate:security` passed Compose policies and npm audit with zero reported vulnerabilities. This command is not a comprehensive security audit.
- The local walkthrough was rebuilt and replaced using `docs/LOCAL_DOCKER_WALKTHROUGH.md`, preserving saved environment values and data mounts. Bootstrap confirmed the existing administrator. Container health is healthy and `/healthz` returned HTTP 200 at `http://127.0.0.1:47956`.

Image: `sha256:4a55d37dba801944ef05824372375e53fa603d1996e04ef99712db2588e49e00`.

The full `npm run validate` passed copyright, migration, snapshot, ESM, Compose, all lint targets, test hygiene, all 8,480 tests (3,543 server, 4,287 client, 500 script, 150 integration), and client/server builds. No tests failed, skipped, or were cancelled. No live push service or browser delivery is claimed for these state-transition proofs.

## Recommendation, limits, and next step

Use additive tokens, short conditional store writes, a separate per-row worker, current-claim preflight, and counters based on confirmed persistence. This protects durable state and avoids sends already known to have lost ownership. Costs are a migration, an extra preflight query per network attempt, and changed counter semantics.

This does not make external delivery exactly once. A provider can accept a message before a lease expires or persistence fails, and another attempt may resend it. No database lock spans network I/O. Local queue age, claim renewal, transport cancellation, and a strict lifetime attempt ceiling remain separate concerns.

Follow-up implemented: [push delivery deadlines and scheduling](PUSH_DELIVERY_DEADLINE_OUTCOME.md). The original recommendation was to coordinate transport deadlines and claim duration, preferably claiming work only when it is ready to send instead of aging a sequential batch of 50 claims. Keep provider acceptance and browser delivery distinct, and preserve ambiguity when a timed-out request might already have been accepted.

See the separate [design, official September 2026 sources, alternatives, and PR disposition](PUSH_QUEUE_CLAIM_FENCING_DESIGN.md).
