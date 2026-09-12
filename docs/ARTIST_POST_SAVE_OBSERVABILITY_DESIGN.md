# Artist post-save observability

Design reviewed September 12, 2026.

Follow-up: required artist Activity now uses the save transaction; see [transactional Activity design](ARTIST_TRANSACTIONAL_ACTIVITY_DESIGN.md). The best-effort Activity discussion below describes the previous design. External notification, refresh, and projection diagnostics remain applicable.

Artist detail saves operator monitoring, release and track exceptions, a versioned snapshot, and reconciliation work in one transaction. Those committed decisions remain successful if later Activity, immediate metadata refresh, household notification, or response-projection work fails. The current follow-up catches hide several failures, making a successful save with degraded follow-up behavior difficult to diagnose.

## Existing boundaries

`operator-artist-save-service.js` commits before invoking its Activity and notification callbacks. It ignores an already queued/running metadata refresh intentionally, and returns `projection: null` if the subsequent projection read fails. A new reporter must preserve those success and retry boundaries, including invoking transition-only effects only after the successful commit.

Two production dependencies also swallow failures internally. `activity-event-service.js` resolves after a failed insert and currently logs a raw error message. `notification-broadcast-service.js` discards recipient-list failures and the outcomes of `Promise.allSettled`. Catching only rejected callbacks in the save service would miss both cases. The notification preference reader also currently allows sending when preference reads fail; observing that degraded path must preserve its existing send decision in this slice.

The existing runtime reporter applies control-plane redaction before writing logs, and provider-cache observability already demonstrates bounded diagnostic categories without artist IDs, cache keys, or raw errors. Build on these conventions with a small injectable ESM reporter and follow-up runner, rather than adding a new diagnostics database or a large singleton.

## Recommended behavior

Each post-save phase has a fixed identifier: policy Activity, newly monitored Activity, immediate metadata refresh, newly monitored notification, or response projection. A failure produces a bounded structured warning through the runtime reporting boundary. Construct an allowlisted record from trusted phase/outcome values; do not serialize the original error, its arbitrary code/message/stack, callback arguments, draft contents, names, recipient identifiers, credentials, provider URLs, or paths. This makes the diagnostic useful for locating the failed phase without exposing private operator state. Retain any general redaction as a second layer, not the primary privacy boundary.

The warning shape is `{ event: 'artist_post_save_failed', phase, saveCommitted: true, snapshotId, snapshotRevision }`. Snapshot ID is a validated UUID or null, and revision is a validated safe nonnegative integer or null. This opaque snapshot correlation supports investigation without actor or artist identifiers; logs remain operator runtime evidence with deployment-controlled access and retention.

Contain synchronous callback throws, rejected promises, and reporting failures. Optional callbacks may return void. Detached follow-ups remain detached, and an already active refresh remains expected coalescing. Report a post-commit projection read failure while retaining the current successful save response with a null projection. Do not retry the entire save or its notifications just to retry reporting.

Add a failure result to dependencies that already absorb errors: Activity reports `{ recorded: false }` on failed persistence; household notification dispatch reports only `{ failed: number }`. For notifications, a failed recipient-list read returns one aggregate failure. Recipient task rejection, a positive downstream send-failure count, or a failed preference read contributes at most one failure for that recipient attempt. Ordinary preference exclusions, explicit suppression, and cooldown skips are not failures. The aggregate describes failed or degraded follow-up work; it does not claim that no notification was delivered. No error objects, identities, or message payloads are returned in this diagnostic result.

This is operational observability, not a delivery guarantee. A process crash after commit can still lose detached callbacks or their logs. Reconciliation is already queued within the save transaction; optional immediate refresh also retains its scheduled refresh fallback. Notifications and Activity would require a separate durable-delivery change if product requirements demand recovery after process loss.

## Options and recommendation stack

| Option | Advantages | Costs and limits |
| --- | --- | --- |
| Keep silent best effort | Smallest implementation; successful saves stay independent | Real failures remain hidden and cannot be distinguished from normal suppression |
| Structured warnings plus additive dependency outcomes | Narrow change, diagnosable phases, preserves successful saves, easy to test and redact | Logs depend on deployment collection and retention; no crash recovery or automatic replay |
| Transactional outbox or same-transaction domain event persistence | Can retain committed delivery intent across process failure | Requires durable identifiers, duplicate handling, worker retries, ordering, retention, and ownership rules; changes the delivery contract |

Use structured warnings and additive outcomes now. Keep the save transaction authoritative, use small ESM modules with dependency injection, expose actual swallowed failure outcomes at the Activity and notification boundaries, and reuse runtime reporting. If guaranteed delivery becomes a release requirement, retain delivery intent in the same PostgreSQL transaction and dispatch through existing operation queues with idempotent consumers; avoid adding a parallel queue system.

## Official sources and W3C boundary

Sources were discovered through web search or previously discovered official links, then opened for this review.

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): use consistent application logging, validate and encode event data, exclude secrets and unnecessary personal details, and keep logging failures from breaking application behavior. The proposed fixed schema applies these principles without relying on incomplete string redaction.
- [AWS transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html): separate database commits and event publication can diverge. Storing event intent transactionally addresses that gap, while duplicate delivery still requires idempotent consumers. This supports the documented future option rather than a claim that current detached callbacks are durable.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages): visible result, error, and progress messages need appropriate programmatic identification, but the criterion does not require inventing a new user-facing message. This backend-only slice preserves existing save feedback and focus. Monitoring and queued reconciliation do not imply completed acquisition.

## Open PR disposition

GitHub MCP returned three open PRs. Complete all-file patches and immutable heads were refreshed; none is applicable to post-save observability, and none was applied or merged.

| PR | Immutable head | Disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Unrelated controlled-provider fixture Node 24 to 26 major update |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposed build-push action 7.2 is superseded by local 7.3 |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposed metadata action 6.1 is superseded by local 6.2 |

## Validation contract

Exercise actual save-service commit and returned success with failing follow-ups, not only the helper in isolation. Cover synchronous throws, rejected promises, dependency-reported failure, expected refresh coalescing, projection failure, no transition-only repeat, and reporter failure containment. Sentinel secrets, URLs, names, newlines, and arbitrary error codes must not appear in captured warning output. Notification tests must preserve sending, suppression and cooldown behavior while checking aggregate failure results. Record executed checks and limitations in the separate implementation outcome.
