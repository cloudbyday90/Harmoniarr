# Preference checks before queued push delivery

Design reviewed September 12, 2026, against baseline `eb47050`.

Harmoniarr now suppresses new notification dispatch when preferences are unavailable. Its push dispatch service persists messages in `notification_queue`, then a heartbeat claims rows and sends them later. That worker currently does not recheck the recipient's category preference, account eligibility, or ownership of the current subscription. A category opt-out, administrator demotion, disabled account, or subscription reassignment can therefore occur between enqueue and delivery.

## Existing evidence

`push-notification-dispatch-service.js` claims pending rows, loads a subscription by ID, and calls the network delivery service with the stored payload. The queue stores `event_type`, `user_id`, `subscription_id`, attempts, and next-attempt time. The claim increments attempts and temporarily moves next-attempt time forward. Existing delivery retries use a default three-claim budget and exponential backoff.

The subscription store's endpoint upsert can change a subscription row's user while retaining its row ID. A queue row's original user ID must therefore be compared with the loaded subscription's current user ID before sending. All located production enqueue callers pass known notification category keys; `generic` is the dispatch method's default, not a product category with an established preference policy.

## Accepted delivery contract

Before each network attempt, including retries, evaluate the queued row against current recipient state. Use a small raw-state store that reads the required account identity, disabled flag, role, and persisted preference JSON. Do not pass this decision through an application-user mapper that silently replaces malformed stored preferences with enabled defaults. Reuse the centralized category constants and strict preference decision logic in modular ESM services.

Implement this boundary in `push-notification-delivery-policy-service.js` and `push-notification-delivery-policy-store.js`. The service returns `{ allowed, retryable, reason }`, with a fixed reason classification and no raw account or error data. A recipient's disabled flag must be explicitly false; an `adminOnly` category requires the current role to be `admin`. Check subscription ownership before reading the fresh delivery decision.

| Current condition | Network action | Queue outcome |
| --- | --- | --- |
| Known category, active existing recipient, allowed preference, eligible role, matching subscription owner | Continue existing delivery attempt | Existing sent/retry/failure handling |
| Category intentionally disabled | No send | Terminal `expired` |
| Recipient missing/disabled, or no longer admin for an `adminOnly` category | No send | Terminal `expired` |
| Missing, invalidated, or differently owned subscription | No send | Terminal `expired` |
| Unknown, missing, or `generic` event type | No send | Terminal `expired`; never a preference bypass |
| Recipient lookup unavailable or raw persisted preference malformed | No send | Retry within existing attempt budget; terminal `failed` when exhausted |

Known-category checks preserve successful legacy preference objects with absent fields and the existing configured defaults. Corrupt or unavailable state is different from a valid default. No cached allow decision should survive into another claimed row or retry. A preference-decision failure for one recipient must not prevent processing other claimed rows. Queue persistence failures remain subject to the existing worker error behavior and may abort a batch.

Use the existing `expired` terminal state and `expiredCount` for intentional suppression and ineligibility as well as unavailable subscriptions. This avoids a schema migration but means the counter combines expiration and suppression; it must not be described as a pure provider-expiration count. It also does not mean the subscription itself should be deleted for an application category opt-out. Preserve subscription invalidation only for its existing transport/ownership rules. Do not mark suppressed work sent or update sent history.

Preference-unavailable retries reuse the current claim attempts and database scheduling, without a new queue, worker, retry ledger, or in-process sleeping loop. With the default budget, claims one and two may schedule another attempt; claim three ends unavailable work as failed. The current base delay is 30 seconds, yielding 60 seconds after claim one and 120 seconds after claim two. Bounded retry permits recovery from a short preference-store outage while preventing endless normal rescheduling. It does not provide exactly-once network delivery or redesign worker leases.

This is a bound on ordinary completed retry decisions, not a strict lifetime claim or send ceiling. Existing claims reserve work for 60 seconds, batches can contain 50 rows processed serially, and final status updates are not fenced to a unique claim. A slow batch or crashed worker can permit a row to be reclaimed while earlier work is unresolved; the claim query itself has no attempt ceiling. These existing lease and completion semantics are unchanged. The next correctness recommendation is claim fencing plus coordinated claim duration and transport deadlines, before adding local queue-age expiration.

Production module wiring must supply the real raw-state reader by default. A missing injected preference reader cannot authorize queued delivery. Keep diagnostics bounded and avoid printing raw preference data, recipients, payloads, endpoints, subscription keys, or lookup errors.

## Security and consistency limits

The latest check prevents dispatch based solely on stale enqueue-time permission. It does not hold database locks across an external network send. A preference, account, or subscription change racing a successful check can still occur before the request reaches the push service; a message already submitted cannot be recalled by this worker. Do not promise immediate revocation of in-flight messages or atomic serialization with browser permission changes.

Browser Push/Notifications permission and Harmoniarr's application category preference remain separate controls. A browser subscription does not encode whether a particular application category is still enabled. No browser permission prompt, notification presentation, focus, or keyboard change is necessary for this server-side delivery gate.

The queue's existing `ttl_seconds` is passed to the push provider. It does not currently expire local rows according to `created_at`. Local queue age expiration is a separate next step; this change must not claim the default 24-hour provider TTL bounds time spent in Harmoniarr's queue. Likewise, provider acceptance does not prove the user saw a notification.

Existing delivery counters also are not durable delivery receipts: the worker increments its delivered counter before persisting the sent status. A later persistence failure can leave the aggregate different from retained queue state. This slice changes preference decisions and their combined expiration/suppression accounting, not the broader transport or counter evidence model.

## Official sources

Sources were discovered through web search or previously discovered official links and opened for this review:

- [W3C Push API](https://www.w3.org/TR/push-api/) specifies subscription deactivation after browser permission revocation and separates application-server submission from browser delivery. Its security section notes that a push service can observe timing, frequency, and message size despite payload encryption. The opened published text is the December 1, 2025 Working Draft, not a final Recommendation. The per-category gate here is Harmoniarr policy, not a W3C-defined category system.
- [RFC 8030, HTTP Web Push](https://www.rfc-editor.org/info/rfc8030/) defines provider TTL as suggested message retention after submission; a provider may retain for less time and must stop delivery after expiration. The application server must consider its own transit delays. This supports distinguishing provider TTL from local queue age. The RFC also permits push services to request retry delay when rejecting excess load.
- [RFC 9110, HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) defines `Retry-After` as an HTTP date or nonnegative delay in seconds. These transport hints are distinct from application preference lookup failures, which have no provider response and should use the existing local backoff policy.
- [OWASP security principles](https://devguide.owasp.org/en/02-foundations/03-security-principles/) recommends secure behavior when dependencies fail. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) supports checking current eligibility at the actual protected operation, centralizing failure handling, and protecting sensitive diagnostics. Those principles inform the current recipient/category/ownership gate without treating notification preferences as a replacement for route authorization.

## Alternatives and final recommendation stack

| Option | Advantages | Costs and limits |
| --- | --- | --- |
| Check only before enqueue | Lowest worker cost | Retained messages ignore later preference, account, role, or subscription-owner changes |
| Recheck and drop all lookup failures | Fail closed with a small worker path | Temporary outages permanently discard otherwise wanted notifications |
| Recheck with bounded unavailable retries | Honors current policy, isolates recipient failures, reuses queue lifecycle, permits brief outage recovery | Adds a small state read per attempt; some messages still end failed after prolonged outage |
| Add a new suppressed state and retry ledger | More precise persisted reasons and reporting | Schema and retention changes beyond the demonstrated delivery defect |
| Lock recipient state across network delivery | Narrows some local state races | Holds database locks during unpredictable external I/O and still cannot revoke a submitted provider message |

Choose a raw-state reader, centralized delivery policy, fresh per-attempt checks, existing queue/backoff, and the existing terminal states with truthful combined counters. Do not create an exception for `generic` events. Preserve the successful enqueue and transport behavior of known eligible categories. Keep local-age expiration, lease redesign, immediate in-flight revocation, and a new persisted suppression taxonomy separate.

## Open PR disposition

GitHub MCP returned three open PRs. Complete all-file patches and immutable heads were refreshed. None applies to queued notification preference enforcement; none was applied or merged.

| PR | Immutable head | Disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Unrelated controlled-provider fixture Node 24 to 26 major update |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposed build-push action 7.2 is superseded by local 7.3 |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposed metadata action 6.1 is superseded by local 6.2 |

## Validation and outcome boundary

Test opt-out after enqueue and between retries, account disable/deletion, admin demotion, subscription owner change, unknown/generic events, malformed persisted preferences, temporary lookup recovery, and exhausted retry attempts. Verify a suppressed row never reaches the network or sent-history update and that eligible sibling rows still progress. Exercise real PostgreSQL queue rows and the default raw-state reader to catch mapper/wiring bypasses; retain focused transport retry and enqueue/coalescing tests. Record executed validation separately. No live push credentials or browser-delivery claim is needed to prove the worker's decision boundary.
