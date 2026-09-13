# Push subscription invalidation after a stale response

Design reviewed September 12, 2026, against baseline `2c80f67`.

Harmoniarr must preserve a refreshed browser registration when an older push attempt finishes with an expired-endpoint response. The existing store upserts by globally unique endpoint, reuses its row ID, replaces keys and owner, and clears invalidation. The delivery service later invalidates by endpoint alone. A response from a request already in flight can therefore disable a newer registration, including one registered again with identical keys. Queue claim fencing protects queue completion; it does not identify which subscription registration produced the provider response.

## Accepted registration contract

Add `registration_token UUID NOT NULL DEFAULT harmoniarr_generate_uuid()` to `user_push_subscriptions` through an additive migration, schema snapshot, and schema anchor. Existing rows receive a token. Every successful upsert gets a newly generated token, including its conflict-update branch and an otherwise identical re-registration. The token identifies one accepted application registration, not browser permission, provider authorization, or an access capability. No unique index on the token is needed: cleanup also matches the existing primary key.

Map the token internally as `registrationToken`. Keep subscription API responses unchanged; the current subscribe route already returns only the row ID. Capture an immutable copy of `{ id, userId, endpoint, registrationToken }` before request generation or any asynchronous send. Cleanup must use that original copy, even if the caller later mutates its subscription object. Do not retain cryptographic keys, payloads, or raw provider errors for cleanup.

Replace the unsafe endpoint-only cleanup helper with `invalidateSubscriptionRegistration(identity)`. Issue one conditional update matching all four original identity fields and `invalidated_at IS NULL`, setting invalidation only when the active registration still matches. Return a boolean based on `RETURNING id`; a non-match is an expected stale result. Reject incomplete identity without broadening the predicate. Do not fall back to endpoint-only invalidation. Preserve the separately authorized user-and-endpoint unsubscribe operation.

PostgreSQL makes the conditional update and the upsert atomic. Under Read Committed, an update waiting on another updater rechecks its predicate against the committed row. If re-registration wins first, the old token no longer matches; if cleanup wins first, the subsequent upsert creates a fresh token and restores the registration. Stronger transaction isolation may instead produce a serialization error, which remains a contained cleanup failure. A separate read followed by an unconditional update would lose this protection. These choices follow the documented [Read Committed update behavior](https://www.postgresql.org/docs/18/transaction-iso.html) and [atomic upsert and returned-row semantics](https://www.postgresql.org/docs/18/sql-insert.html).

Keep cleanup asynchronous and best effort so it does not extend the existing delivery result's transport budget. Invoke only one conditional statement, contain both synchronous throws and rejected promises, and use a fixed diagnostic on failure. A false result is benign and needs no warning. This bounds the operation count, not database latency: the existing transport deadline does not become a PostgreSQL statement timeout or durable cleanup guarantee.

## Provider status and W3C boundaries

Invalidate the captured registration only for HTTP 404 or 410. RFC 8030 section 7.3 specifies 404 for sending to an expired push subscription. Google and Mozilla also document 410 as an invalid subscription endpoint. RFC 8030's other use of 410 for delivery receipts is a separate resource context; do not generalize every receipt failure into subscription invalidation. See [RFC 8030](https://www.rfc-editor.org/info/rfc8030/), [Google's Web Push protocol guidance](https://web.dev/articles/push-notifications-web-push-protocol?hl=en), and [Mozilla's Autopush error contract](https://github.com/mozilla-services/autopush/blob/master/docs/http.rst).

Remove HTTP 412 from registration invalidation. It means a request precondition failed, which does not establish permanent endpoint expiry. Preserve the subscription and report the existing failed, nonretryable delivery result. A future provider-specific exception would require documented semantics and a scoped classifier; none is established by this slice's research. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines the status independently of subscription lifetime.

The W3C Push API describes refreshed subscriptions, replacement keys, and `pushsubscriptionchange` carrying old and new subscriptions. It permits a short overlap while changes reach application servers. That lifecycle supports treating a delayed response as evidence about the registration used for that request. The currently published document is a Working Draft, not a final Recommendation. This change does not implement a new browser subscription-change handler or claim cross-browser support. [W3C Push API, subscription refreshes](https://www.w3.org/TR/push-api/) provides the browser lifecycle model.

Local invalidation does not revoke a message already accepted by a push service. Preserving a refreshed registration also does not automatically replay the old queue item: that attempt can still finish as expired under existing queue policy. Provider acceptance is not proof of browser display, and this token provides neither exactly-once delivery nor serialization of recipient preference changes through external I/O. No UI, focus, keyboard, permission prompt, or live-status change is needed.

## Alternatives and recommendation

| Approach | Benefits | Costs and limitations |
| --- | --- | --- |
| Endpoint-only invalidation | No schema change. | Can disable a newer registration after a delayed response; reject. |
| Compare owner and encryption keys | Detects some rotations without a new token. | Repeats sensitive key comparisons and misses identical-key re-registration; reject. |
| Rotate a registration token on every upsert and conditionally invalidate | Covers key rotation, owner change, identical registration, and deletion/recreation with one bounded update. | Requires migration and consistent use by all registration writers; selected. |
| Hold a database lock through the provider request | Serializes refresh and cleanup. | Holds locks during external I/O, delays user actions, and cannot revoke provider acceptance; reject. |
| Add a durable cleanup queue | Can retry infrastructure failures independently. | Adds retention and worker lifecycle complexity beyond this stale-write defect; defer unless durable cleanup becomes required. |

Use the existing ESM store and service boundaries, the repository UUID helper, a copied registration identity, an atomic conditional update, and the existing fixed-message reporting mechanism. Keep the queue claim token and subscription registration token distinct. Neither is a replacement for authorization. Stop old workers before applying the upgrade and restarting the application; mixed workers still using endpoint-only cleanup can defeat the new protection. Preserve historical migrations and describe the corrected 412 behavior in current outcome documentation.

## Verification and outcome boundary

Meaningful tests should exercise an actual delayed send followed by re-registration, not only inspect SQL text. Cover fresh 404/410 cleanup; identical-key refresh; key or owner replacement; deletion and recreation; mutation of the caller object while a request is pending; incomplete identity; and 412 preservation. Assert exact conditional identity and no endpoint-only fallback. Verify asynchronous cleanup failures cannot reject the delivery result or expose endpoint, owner, keys, or raw error data.

Use PostgreSQL regression coverage for both writer orderings and unchanged-registration invalidation, plus migration application and schema consistency. Keep current transport deadline, retry classification, and queue completion tests passing. Fixture evidence establishes the local registration boundary; it does not establish acceptance by a live provider or delivery to a user's browser. Implementation and executed validation results belong in the separate outcome document.

## Open pull requests

GitHub MCP search and complete file patches were refreshed September 12, 2026. Each open PR changes one file; none addresses subscription invalidation. No PR was applied, merged, commented on, or otherwise mutated.

| PR and immutable head | Patch and local disposition |
| --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40), `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Changes the controlled-provider fixture image from Node 24.19.0 to 26.7.0. Independent major-runtime change; not applicable to this correction. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24), `40cf4d117b69bd55b9a0a7353361838216e1e952` | Changes Docker build-push-action 7.1.0 to 7.2.0. Superseded by local 7.3.0 pin `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a`. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23), `ae651337286216e92be7ae977e39fcedc14de7f9` | Changes Docker metadata-action 6.0.0 to 6.1.0. Superseded by local 6.2.0 pin `dc802804100637a589fabce1cb79ff13a1411302`. |

All external source URLs above were discovered through search or GitHub MCP and opened for review; no provider credentials, private endpoint, or live push subscription was used.
