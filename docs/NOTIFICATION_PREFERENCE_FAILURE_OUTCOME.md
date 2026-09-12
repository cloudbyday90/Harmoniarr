# Notification preference failure outcome

## Delivered behavior

Notification preference evaluation now returns only `{ allowed, failed }`. Read exceptions, missing accounts, and malformed reader results return `{ allowed: false, failed: true }`. Explicit opt-outs and unknown categories return false without reporting a failure. Successfully read legacy objects with missing notification fields retain the existing enabled defaults.

Household broadcasts stop failed recipients before cooldown lookup, enqueue/send, or marking dispatch. Each blocked recipient contributes one aggregate failure, while healthy recipients continue. A small ESM single-recipient dispatch service applies the same gate to request-fulfillment notifications and retains their dispatch-result shape. The existing boolean preference helper delegates to the same evaluator.

Malformed reader results include non-record top-level values, non-record notification maps, and nonboolean explicit values for the requested category. No raw exception, preference data, recipient identity, endpoint, or payload is included in failure results. The upstream user service still normalizes stored preferences, so this does not claim to detect corrupted persisted values hidden by that normalization.

## Validation

Focused policy, broadcast, direct dispatch, household, and callback tests pass. A real PostgreSQL fixture verifies a saved opt-out under an injected preference-query failure, healthy-recipient isolation, recovery with the opt-out retained, a newly enabled preference on a later invocation, and missing-account suppression. No actual push service was contacted. Final validation passed:

- All 3,516 server tests (`npm run test:server`).
- Three PostgreSQL integration tests across `notification-preference-failure.test.js` and `library-media-requests.test.js`.
- Copyright, ESM consistency, server/test lint, and test hygiene checks.
- Client and server builds.
- `npm run validate:security`: Compose policies passed; npm audit reported zero vulnerabilities.
- Local walkthrough image rebuilt and restarted using `docs/LOCAL_DOCKER_WALKTHROUGH.md`, preserving saved environment values and data mounts. Bootstrap confirmed the existing administrator. Container health is healthy and `/healthz` returned HTTP 200 at `http://127.0.0.1:47956`.

Rebuilt image: `sha256:d9a9eb14c9e8a1379c8871850ad6666c29d9c147f0953752bbbb50cc11199b01`.

This server-only slice did not run the full client/browser or unrelated integration suites. The security command is a dependency and deployment-policy check, not a comprehensive security audit.

## Operational meaning and limits

A blocked attempt is withheld, not retained for automatic replay. A later caller invocation reads preferences again; there is no cached allow fallback. Broadcast callers can observe the aggregate failure count. The import worker currently discards resolved fulfillment callback results, so this slice does not add a fulfillment warning or retry guarantee.

Already queued push messages and queue retries are outside this enqueue-time gate. Browser push permission and an existing subscription are separate from application category preferences. No new notification UI, focus, consent default, critical-alert bypass, queue schema, or dependency is introduced. All recognized categories use the same failure rule.

## Final recommendation and next step

Use the shared explicit preference decision, the household broadcaster, the small direct-recipient dispatch factory, and existing queue/cooldown infrastructure. This protects potential opt-outs and preserves failure evidence without extra delivery state. The tradeoff is that an unavailable preference can cause an event notification to be missed unless a caller invokes dispatch again.

Next revalidate category preferences at queued delivery and retry time, with bounded deferral for unavailable reads and explicit handling of disabled users/categories. That will close the gap for messages enqueued before preferences changed. Treat durable replay of currently withheld enqueue attempts as a separate delivery guarantee.

See the [design, official September 2026 research, alternatives, and PR disposition](NOTIFICATION_PREFERENCE_FAILURE_DESIGN.md).
