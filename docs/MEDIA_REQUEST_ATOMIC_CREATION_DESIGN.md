# Atomic music request creation

Status: Implemented
Date: 2026-09-10
Outcome: [Implementation and validation outcome](MEDIA_REQUEST_ATOMIC_CREATION_OUTCOME.md)

## Problem and product boundary

An administrator can request music for multiple eligible users. Before this
change, the parent request committed before child insertion, and the child INSERT
supplied 19 expressions for 20 columns. A failed submission could leave a parent
request, audit records, notifications, and external planning behind. The
submission also broadcast the household notification twice when it created children.

One submission must persist the entire eligible request family or none of it.
Disabled/ineligible targets remain excluded under the existing policy. This
changes request creation, not artist monitoring, media ownership, deletion,
acquisition confidence, or automatic import policy.

## Research and alternatives

Official sources were identified through search and read on September 10, 2026.
These recommendations are an application of those sources to this repository.

| Option | Advantages | Costs and limits | Decision |
| --- | --- | --- | --- |
| Correct the child SQL only | Small patch | Parent, audit, and planning can still commit independently | Insufficient |
| One client, one Read Committed transaction | Atomic family and required records; fits existing PostgreSQL architecture | Does not make duplicate detection or HTTP replay idempotent | Adopt |
| Savepoints and partial child success | Can retain successful children | Conflicts with one-submission atomicity; difficult recovery semantics | Reject |
| Serializable transactions | Stronger protection against concurrent read/write anomalies | Requires transaction retries; does not itself solve HTTP replay | Defer until justified by a specific invariant |
| Existing durable operation queue in the same transaction | Required external planning survives process failure after commit; workers see committed intent | Requires forwarding the transaction client across queue/evidence/audit boundaries | Adopt |
| New outbox and generic idempotency framework | Can support durable delivery and replay of ambiguous requests | New schema, workers, ownership, retention, and replay contracts | Defer; do not duplicate the existing job system |

Sources:

- [PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html): included writes become visible together and roll back together.
- [PostgreSQL isolation](https://www.postgresql.org/docs/18/transaction-iso.html): Read Committed uses statement snapshots; atomicity is distinct from serializable concurrency guarantees.
- [node-postgres transactions](https://node-postgres.com/features/transactions): every transactional query must use the same checked-out client, with rollback and release on failure.
- [Node.js ESM](https://nodejs.org/download/release/v24.4.0/docs/api/esm.html): retain explicit relative import extensions and the package's ESM boundary.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/): input errors need textual identification (3.3.1), and dynamic status messages need programmatic exposure without focus changes (4.1.3).
- [HTTP semantics, idempotent methods](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2): a client must not assume an ambiguous failed POST is safe to replay.
- [OWASP error handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html): unexpected failures should receive generic public responses rather than database or deployment details. This source was consulted after the browser regression exposed raw constraint names in request feedback.

## Final recommendation stack

1. Retain Node 24, ESM factories, Express adapters, and PostgreSQL.
2. Prepare validated targets and request classification before persistence.
3. Use a small injected transaction service and a focused request-creation
   service. Pass the checked-out client explicitly through every participating
   store read-back, insert, count update, and required audit.
4. Enlist existing external-planning operation rows, request evidence, and
   planning audit in that transaction. Provider/network execution stays in the
   existing worker after commit. Maintenance checks retain their existing policy
   and can use the same client.
5. Emit optional Activity and one household notification only after commit.
   Callback failure cannot turn a committed submission into a creation failure.
6. Prove failure and success against disposable PostgreSQL before release.

## Transaction and failure contract

The service owns BEGIN/COMMIT/ROLLBACK. Stores own parameterized SQL. A rollback
failure must preserve the original error and discard the unusable pooled client.
No callback is executed from the transaction body unless it is explicitly a
database operation enlisted on that client.

Parent, children, stored child count, parent/aggregate audit, and required
external-planning intent are one unit. Child read-backs use the same client.
Optional Activity/notification delivery remains best effort after commit; it is
not an exactly-once delivery promise. A failed transaction can be retried without
leaving a partial family. A lost response after successful commit remains an
ambiguous POST; no automatic retry or exactly-once submission claim is added.

## Security and W3C considerations

Keep authenticated session, CSRF, permission, administrator-only delegation,
target eligibility, deduplicated target IDs, and the 50-target limit. Use bound
parameters for target IDs and JSON data. Do not expose transaction internals,
connection errors, or SQL in product feedback.

Request creation now has a narrow error-normalization boundary: existing public
validation/permission/maintenance errors remain actionable, known database
connection/reference failures use the shared safe mapper, and unexpected errors
receive fixed copy. The original cause remains internal. The copy advises
checking existing requests before retrying an ambiguous failure.

Keep native form controls and text feedback. Success means the request was
saved; it does not mean downloads started. Inline status/error feedback should
use the existing status/alert conventions without moving focus. This focused
change does not claim a platform-wide accessibility audit.

## Validation and acceptance

- Two/three eligible targets create one parent and the expected children.
- Repeated target IDs are deduplicated; disabled targets retain policy behavior.
- Failure in child insertion, count/audit persistence, or external planning
  leaves no partial request family or associated creation records.
- Retry after verified rollback creates exactly one family.
- Optional callbacks run only after commit, once per intended event, and never
  after rollback; synchronous/rejected callback failures do not undo success.
- CSRF, requester delegation denial, and target-scoped visibility remain valid.
- Run focused unit and real PostgreSQL integration tests, repository validation,
  build, ESM checks, and security validation before committing and pushing.

## Open PR assessment

GitHub MCP inspection found three open PRs. None is applicable:

- [PR 24](https://github.com/cloudbyday90/Harmoniarr/pull/24) proposes build-push-action 7.2.0; local code already uses 7.3.0.
- [PR 23](https://github.com/cloudbyday90/Harmoniarr/pull/23) proposes metadata-action 6.1.0; local code already uses 6.2.0.
- [PR 40](https://github.com/cloudbyday90/Harmoniarr/pull/40) changes only the controlled-provider fixture to Node 26.7.0. It diverges from the Node 24 baseline. The [official Node release table](https://nodejs.org/en/about/previous-releases) still identifies Node 24 as LTS and Node 26 as Current at research time.

No PR was applied or merged because none fit this change and runtime baseline.

## Next item

Independent review found a more immediate follow-up: external URL families queue
planning for the parent, while children currently have neither their own
planning run nor a link that fulfillment follows to the parent. Define and prove
the shared fulfillment/ownership contract for these children before claiming
end-to-end multi-target external acquisition. This change proves atomic creation
and durable parent planning, not completed acquisition for every child.

Then fix Music Queue's bounded-list detail lookup and inaccurate totals, followed
by provider-backed Artist Detail pagination. Those known truncation defects
prevent larger libraries from reaching valid music.
