# Local push queue freshness expiry

Design reviewed September 13, 2026, against baseline `d2683a7`.

Harmoniarr currently passes the stored TTL to the push provider each time it sends a queued notification. Time spent waiting locally does not reduce that value. A notification retained through a long outage can therefore be delivered much later with a fresh provider retention window. Queue claim fencing, recipient preference checks, subscription registration tokens, and outbound destination validation remain necessary, but none establishes when the queued content becomes stale.

## Accepted persistence and TTL contract

Add `expires_at TIMESTAMPTZ NOT NULL` to `notification_queue` through an additive migration, with no default and no trigger. New queue inserts explicitly calculate expiry from the database's current clock plus the validated TTL. Both existing insert paths, including sent-history recording, supply the field. A writer that omits expiry fails closed instead of receiving an unrelated default lifetime. Update the generated schema snapshot and critical column anchor.

Backfill existing rows from `created_at + ttl_seconds`, preserving their original lifetime. Never use migration time to renew old work. The existing integer, not-null, and positive-TTL constraint already limits normal stored TTL values to `1..2147483647`; retain valid values and do not silently convert malformed historical state into a new delivery lifetime. A migration or schema-integrity failure remains explicit. Preserve historical sent/failed records rather than deleting them as part of this upgrade.

Replace permissive `parseInt` coercion at the application boundary with strict integer validation in that same range. Default only an omitted TTL to the established default. Do not truncate fractions, numeric suffixes, or strings, and do not clamp invalid values to a positive default. This is Harmoniarr's queue/storage range, not an RFC maximum. RFC 8030 describes nonnegative TTLs and representation-overflow handling; its zero value requests immediate delivery if the user agent is available and otherwise expires. This slice keeps queued TTL inputs positive and does not add a zero-TTL product feature. [RFC 8030 section 5.2](https://www.rfc-editor.org/info/rfc8030/) defines provider TTL semantics.

Use `clock_timestamp()` for current expiry decisions, especially after waiting on a database lock. Transaction-start time can become stale during a long transaction. Apply static database constraints to row shape and TTL bounds; do not use a time-varying `CHECK (expires_at > now())`, since a legitimate row must be allowed to age into expiry and remain restorable. PostgreSQL documents [current clock versus transaction time](https://www.postgresql.org/docs/current/functions-datetime.html) and the [immutability assumption for CHECK constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

## Coalescing and retry behavior

An accepted new producer payload may refresh expiry to database current time plus its new TTL only while the matching row is still fresh, pending, unclaimed, and has never been attempted. Update payload, TTL, and expiry together under the same conditional update. Keep `created_at` unchanged so the existing coalescing window remains fixed rather than extending indefinitely.

An expired row cannot be revived by coalescing. A claimed or previously attempted row keeps its payload and original expiry. If the conditional update loses a race, preserve the existing fallback that enqueues the producer's new content independently. That new row represents new accepted content with its own expiry; it does not renew the old attempt.

Retries never change expiry. An ordinary retry can retain a pending row whose next-attempt time lies after expiry. The next eligible worker pass must still find that expired, unclaimed row even when its retry time is in the future, then finalize it through the existing fenced expired write. This avoids overriding a requested completion status silently and preserves counters based on the status actually written. Terminal expired rows are never reclaimed.

Preserve active leases: expiry alone must not steal a row carrying a current claim. Reclaim abandoned work only under the existing lease rule. Keep one claim immediately before processing and at most 50 claims per worker invocation. If an index is added for expired pending rows, its predicate must match the unclaimed-expiry branch; retain the existing due-work access path and verify the combined query rather than relying on an assumed index choice.

## Combined delivery preflight

After subscription and recipient-policy preparation, perform a database preflight for every claimed row, including rows whose preference or account policy denied delivery. Read the current claim's remaining lease and the notification's remaining freshness together. A missing or expired claim is lost work ownership; an unavailable or malformed preflight cannot authorize a network send.

Subtract the locally measured monotonic preflight elapsed time from both returned durations. Use database relative durations, avoiding a comparison between application wall-clock time and database wall-clock time. Expired freshness terminates the row without sending. Insufficient lease retains the existing bounded retry behavior, with the original expiry unchanged.

For eligible content with at least one whole transport millisecond remaining after reserving one provider-retention second, choose a positive integer transport budget of at most 15,000 milliseconds and no more than `floor(freshnessRemainingMs) - 1000`. Preserve the existing 20-second minimum lease gate, including its five-second completion reserve, even when the actual transport budget is shorter. Calculate the provider TTL as the floored remaining seconds after reserving that entire transport budget, capped by the stored TTL. This leaves at least one provider-retention second and permits shorter transport budgets for short-lived content.

Treat the row as locally expired without sending when no positive whole transport millisecond remains after reserving one provider-retention second. This includes one second or less and a fractional millisecond above that boundary. This is an intentional conservative product policy: it can discard work just before its stored deadline and means a one-second queue TTL is not expected to survive asynchronous dispatch. Do not call it provider expiration or infer that the subscription is invalid. The queue has not gained RFC zero-TTL delivery semantics.

Pass the selected shorter timeout into the existing service so validation, encryption, DNS, and HTTPS share that budget. Preserve the established absolute deadline, resolver cancellation, no-late-connection behavior, response bounds, and safe diagnostics. A provider failure or retry never grants more freshness. Preserve the original claim token for completion, and base outcome counters only on confirmed fenced writes. An error after an ambiguous completion must not trigger a second conflicting write.

## Scope and delivery limits

The stored deadline bounds application attempts to send and reduces the provider retention budget. RFC 8030 explicitly leaves transit-delay accounting to the application server. A push service may already have accepted a request before a response is lost or the application aborts. Local expiry does not revoke that message, prevent all delayed browser displays, or provide exactly-once delivery. Provider acceptance is distinct from delivery to a user agent; neither proves that a user saw the notification. The [W3C Push API](https://www.w3.org/TR/push-api/) describes push receipt and subscription behavior separately from user-facing notification presentation.

Database wall-clock corrections and process suspension remain timing limitations. Monotonic elapsed-time deductions avoid routine application/database clock comparison errors; they do not provide a hard real-time guarantee. The five-second reserve remains budget for normal completion work, not a database statement deadline.

No browser permission prompt, UI status, focus, keyboard, or notification layout changes are required. The existing expired status/counter continues to combine freshness expiry with subscription and recipient-policy suppression. No new delivery queue, background expiry sweep, provider receipt integration, or claim-renewal loop is introduced.

Stop old workers during the coordinated migration and restart. Older insert statements omit the now-required expiry; older delivery code also lacks freshness checks. Mixed application versions therefore do not satisfy this release contract.

## Alternatives and recommendation

| Approach | Benefits | Costs and limitations |
| --- | --- | --- |
| Provider TTL alone | Existing behavior; no local state. | Does not account for queue age or downtime; reject. |
| Derive expiry from original creation time on each read | Avoids a new column. | Cannot distinguish fresh coalesced content without changing creation-time semantics; reject for this queue. |
| Persist expiry with accepted content, validate at every attempt | Explicit, restart-safe lifetime and controlled coalescing behavior. | Requires migration, writer updates, and combined preflight; selected. |
| Periodically delete stale rows | Simple cleanup job. | Can race active claims and loses evidence; does not itself guard a send; reject. |
| Add a trigger or implicit default lifetime | Accommodates omitted fields. | Hides writer mistakes and can assign the wrong lifetime; use explicit writers instead. |

Recommended stack: strict ESM TTL policy, explicit PostgreSQL expiry persistence, conditional coalescing, a combined database budget read, adaptive existing transport deadlines, and existing claim-fenced completion. Retain preference, subscription-owner, registration-token, endpoint, DNS, and TLS checks.

## Verification and outcome boundary

Test strict TTL boundaries, absent versus invalid inputs, migration backfill without renewal, and failure of omitted-expiry writes. Exercise real PostgreSQL coalescing while fresh, rejection after expiry, claim/update races, original creation-time retention, and fixed retry expiry. Verify future retries become selectable when expired, while active leases remain protected.

Worker tests should cover downtime-expired rows, preference-denied rows still receiving budget validation, exact one-second boundary, short positive adaptive timeouts, provider TTL reduction, insufficient lease, expired/lost claims, malformed preflight results, and slow preflight elapsed-time subtraction. Use deterministic clocks or controlled database coordination instead of short wall-clock sleeps. Preserve the existing meaningful transport, preference, invalidation, queue-fencing, migration, and recovery checks.

Implementation and actual validation results belong in a separate outcome document. Fixture evidence is not a live-provider delivery claim.

## Open pull requests

GitHub MCP search and complete file patches were refreshed September 13, 2026. No open PR addresses queue freshness. None was applied, merged, commented on, or otherwise remotely changed.

| PR and immutable head | Patch disposition |
| --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40), `649659f1e199d48d55cc8d5cccf9f079dc235d86` | One Node image change, 24.19.0 to 26.7.0, in the controlled-provider fixture; unrelated major-runtime work. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24), `40cf4d117b69bd55b9a0a7353361838216e1e952` | One build-push-action change to 7.2.0; superseded by local 7.3.0 pin `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a`. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23), `ae651337286216e92be7ae977e39fcedc14de7f9` | One metadata-action change to 6.1.0; superseded by local 6.2.0 pin `dc802804100637a589fabce1cb79ff13a1411302`. |

Official source URLs were discovered through search or MCP and opened for review. No live credentials or real notification subscription were used.
