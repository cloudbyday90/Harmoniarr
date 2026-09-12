# Notification preference lookup failures

Design reviewed September 12, 2026, against baseline `f3b8341`.

Harmoniarr checks each user's notification category preferences before dispatching household and request-fulfillment notifications. `shouldSendNotification` currently permits dispatch when the preference reader throws. An unavailable preference row can therefore bypass an explicit opt-out stored in that row. The recent broadcast diagnostics count this degraded attempt but still allow the message to reach the push queue.

## Decision and result contract

Fail closed when a recognized category's preference lookup or normalization throws. Add a small explicit result evaluator to `notification-preference-service.js`, retaining the existing `shouldSendNotification` export as a boolean compatibility wrapper over the evaluator's `allowed` field. Keep the service in ESM and reuse the existing preference normalizer and category constants.

| Condition | `allowed` | `failed` | Effect |
| --- | --- | --- | --- |
| Successful read; category enabled | `true` | `false` | Continue through existing suppression, cooldown, and dispatch rules |
| Successful read; category disabled | `false` | `false` | Ordinary preference exclusion |
| Unknown category | `false` | `false` | Exclude without reading preferences |
| Reader throws/rejects, including missing user; malformed reader result; normalization throws | `false` | `true` | Suppress this attempt and expose a bounded failure result |

The result must contain only these two booleans. Do not expose the original exception, arbitrary error codes, identifiers, preferences, payloads, endpoints, or credentials. A missing or invalid reader is also a failed lookup, never implicit permission. Do not cache a previous allow decision as a fallback.

Preserve existing normalization for a successfully read legacy preference object with missing notification fields. Those fields currently use the product's configured defaults, which are enabled. This repair distinguishes a failed read from a successful read with legacy/default values; it does not introduce a new notification opt-in policy or claim existing defaults establish consent.

## Integration boundaries

`notification-broadcast-service.js` should consume the explicit result directly. A failed lookup contributes one failed recipient attempt and exits before cooldown lookup, dispatch/enqueue, or `markDispatched`. Remove its error-capture wrapper, which was needed only because the previous boolean helper swallowed failure information. Other recipients continue independently. Existing recipient filtering, explicit suppression, intentional opt-outs, and normal cooldown skips remain non-failures; send or cooldown failures retain their existing bounded aggregation. Aggregate failures are attempts, not counts of undelivered browser notifications.

The request-fulfillment callback in `app.js` also uses this preference boundary. A small direct-recipient dispatch service consumes the explicit result and preserves its dispatch-result shape using `{ sent: 0, failed: 1, removed: 0 }` for an unavailable preference, versus zero failures for an intentional exclusion. Do not claim new fulfillment-notification observability merely from returning this result: `import-candidate-apply-worker.js` currently detaches that callback and discards resolved results. The committed import remains successful.

Artist-save notification failures continue to reach the existing post-save reporter through the broadcast aggregate. Required artist Activity remains committed with the save and is unaffected by optional notification availability.

In the current production dispatch service, `sendNotificationToUser` enqueues messages for subscriptions rather than confirming browser delivery. This slice governs the decision before that enqueue. Existing retained messages and delivery retries are not re-evaluated against category preferences by the queue worker. A preference update racing a successful lookup is also outside this bounded contract. Do not describe this repair as immediate revocation of all queued or in-flight messages. A later worker-level recheck would need explicit disabled-versus-unavailable handling, retry/expiry semantics, and coverage of legacy/generic event types.

## Official sources and W3C model

Sources were discovered through search, then opened; the Notifications Standard was followed from the W3C Push API's actual reference.

- [OWASP security principles](https://devguide.owasp.org/en/02-foundations/03-security-principles/) recommends a secure state when errors occur. Applying that principle here means absence of a readable application preference must not override a possible opt-out.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) recommends default denial, centralized failure handling, tests for exception paths, and avoiding sensitive error disclosure. Notification preferences are application delivery policy, not a substitute for endpoint authorization; these principles support the fail-closed policy decision.
- [W3C Push API](https://www.w3.org/TR/push-api/) defines browser push permission, subscription lifetime, and permission-revocation behavior. The published document opened for this review is a Working Draft dated December 1, 2025, not a final Recommendation. Its security discussion also notes that message timing, frequency, and size remain visible to a push service despite payload encryption.
- [WHATWG Notifications Standard](https://notifications.spec.whatwg.org/) defines the browser notification permission states and requires permission before showing notifications. This browser permission is distinct from Harmoniarr's per-user category preferences. A valid subscription or granted browser permission does not tell the server whether `artistMonitored` or `requestFulfilled` is currently enabled in the application.

The distinction between browser capability permission and application category policy is an architectural conclusion from the standards and local code; neither standard specifies Harmoniarr's `{ allowed, failed }` result. No permission prompt, notification UI, focus, keyboard behavior, or live-region change is needed for this server-side repair.

## Alternatives and final recommendation stack

| Option | Advantages | Costs and limits |
| --- | --- | --- |
| Preserve fail-open plus warnings | Alerts continue during preference-store outages | Can disregard a stored opt-out and send unwanted content |
| Fail closed with a boolean only | Small change; prevents dispatch after failed reads | Conflates intentional exclusion with an unavailable dependency |
| Fail closed with explicit result and boolean wrapper | Preserves callers, keeps diagnostics truthful, centralizes policy, supports recipient isolation | Notifications may be skipped during an outage; does not provide automatic replay |
| Durable preference-aware retry or queue-worker rechecks | Can reconsider unavailable preferences later and address retained messages | Requires separate delivery, expiry, revocation, idempotency, and event-type policy decisions |

Choose the explicit result evaluator, the compatibility boolean wrapper, direct broadcast aggregation, and existing safe post-save diagnostics. Retain the current push queue, recipient filters, cooldown behavior, and successful-read defaults. Do not add an outbox, new worker, raw-error logs, retry of the originating save/import, or global notification default changes in this slice. The availability tradeoff is deliberate: an unreadable preference suppresses an optional notification instead of risking an unwanted one.

## Open PR disposition

GitHub MCP returned three open PRs. Their complete all-file patches and immutable heads were refreshed; none applies to preference failure behavior. No PR was applied or merged.

| PR | Immutable head | Disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Unrelated controlled-provider fixture Node 24 to 26 major update |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposed build-push action 7.2 is superseded by local 7.3 |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposed metadata action 6.1 is superseded by local 6.2 |

## Validation and outcome boundary

Test the explicit and boolean interfaces for enabled, disabled, unknown category without reads, successful legacy defaults, synchronous throw, rejected promise, and invalid reader. At the broadcast boundary, prove unavailable preferences produce one failure, never call cooldown/send/mark, and do not block an allowed sibling recipient. Preserve suppression and cooldown tests; replace old fail-open assertions rather than retaining their obsolete behavior. Verify the fulfillment callback or its shared boolean boundary suppresses failures, and the real artist-save integration retains committed state/Activity while reporting optional notification failure. No live push delivery is required for these injected-boundary tests. Record executed validation and remaining queue limitations in the separate outcome document.
