# External request target ownership

Date: 2026-09-10
Status: Implemented and validated
Outcome: [Implementation and validation](EXTERNAL_REQUEST_TARGET_OWNERSHIP_OUTCOME.md)

## Purpose and evidence

Harmoniarr is a self-hosted, Soulseek-native library manager. External music
URLs prepare provider metadata; they are not evidence that music was downloaded.
Each delegated request belongs to its target user, whose identity controls
request visibility, candidate ownership, notifications, and managed-library
placement.

The previous atomic-creation change queued external planning only for the first
target. Child requests had no planning job. Inspection also shows that candidate
placement and access each use one `sourceRequestedForUserId`. Copying a parent's
applied status to its children would therefore claim delivery that was never
performed for those targets.

## Research and alternatives

Official sources were discovered through search or source links and read on
September 10, 2026. GitHub PRs were inspected through GitHub MCP. The decisions
below apply the sources to this platform; they are not prescribed schemas.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Project the parent's fulfillment onto children | Avoids duplicate provider reads | An applied candidate belongs to one target; can falsely report another target's delivery | Reject |
| Share metadata/acquisition, add durable per-target delivery records | Efficient long-term reuse with explicit ownership | Requires new reconciliation, placement, retry, and delivery contracts | Future architecture, not this release increment |
| Queue one existing planning job per eligible request | Fits current ownership, access, queue, and placement boundaries; no orphaned child jobs | Additional provider calls, bounded by the existing 50-target limit and worker concurrency | Adopt |
| Only show shared preparation progress | Small read-only change | Leaves child work unqueued and does not resolve the operational defect | Insufficient |

- [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  and [IDOR prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html):
  authorize each object and operation; test different users, not just unpredictable IDs.
- [node-postgres transactions](https://node-postgres.com/features/transactions)
  and [PostgreSQL BEGIN](https://www.postgresql.org/docs/18/sql-begin.html): use one
  checked-out client for the family and all required planning intents.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html): unique
  constraints and conflict handling can make individual persistence steps replay
  safe; they do not establish whole-operation or HTTP replay idempotency.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  and [ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22): communicate
  lifecycle changes without moving focus; retain a pre-existing status region
  and avoid announcing every background poll.
- [Node release guidance](https://nodejs.org/en/about/previous-releases): retain
  the Node 24 LTS major baseline; evaluate runtime patch maintenance separately.

## Final recommendation stack

1. Retain Node 24, ESM factories, Express adapters, PostgreSQL, and the existing
   operation queue. Add small services/stores for narrowly owned behavior.
2. Queue planning for every eligible external request within the creation
   transaction, including its evidence and audit. Failure on the final child
   rolls back every earlier insert. Publish optional effects after commit.
3. Keep each request ID throughout planning, execution, candidate correlation,
   and target-owned fulfillment. Do not widen candidate access or follow parent
   links as authorization. New jobs use existing worker limits and provider clients.
4. Check current request state before planning, execution queueing, and provider
   calls. Cancelled requests stop at the next work boundary. An already-issued
   remote call may finish; cancellation is not a remote rollback guarantee.
   Only an administrator can cascade cancellation across the family; a target
   user cancelling the first request must not cancel other recipients' work.
5. Project only safe preparation state from an active relevant operation run,
   otherwise the latest run. Active work takes precedence because retries reuse
   existing run IDs. Pending derived provider rows require further review;
   missing/pruned operation history explicitly requires review.
   Provider completion means details are prepared, never that media is fulfilled.
   A child's actual candidate status remains independent of its siblings.
6. Validate multi-target persistence, last-child rollback, cancellation, target
   scoping, and independent fulfillment with real PostgreSQL and HTTP tests.

## Security, accessibility, and compatibility

Retain authentication, CSRF, administrator-only delegation, target eligibility,
and the existing target-count bound. All new SQL uses parameters. Progress reads
accept server-selected request IDs, select only status/timestamps/counts, and
never return raw provider errors or credentials. Public statuses are fixed copy.
Candidate detail and operator diagnostics remain behind their existing access
checks. Target identity is not replaced with the acting administrator.

Use the existing status codes and readable labels/details so clients keep their
polling and presentation behavior. Announce request-detail status changes through
a persistent status region without focus changes. This is focused accessibility
work, not a complete WCAG assessment.

No migration, shared ownership array, or duplicate job system is needed. Existing
orphaned children are not silently submitted to providers during startup. Their
historical rows remain intact; recovery needs an explicit operator workflow.

## Open PR assessment

GitHub MCP returned exactly three open PRs, all inspected by immutable head:

- [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23),
  `ae651337286216e92be7ae977e39fcedc14de7f9`: metadata-action 6.1.0 is older than
  the local SHA-pinned 6.2.0.
- [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24),
  `40cf4d117b69bd55b9a0a7353361838216e1e952`: build-push-action 7.2.0 is older
  than the local SHA-pinned 7.3.0.
- [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40),
  `649659f1e199d48d55cc8d5cccf9f079dc235d86`: upgrades only the controlled-provider
  fixture to Node 26, outside the production/package Node 24 baseline.

None is applicable. No PR is applied or merged as part of this change.

## Next release item

The subsequent [discovery handoff design](EXTERNAL_REQUEST_DISCOVERY_HANDOFF_DESIGN.md)
and [outcome](EXTERNAL_REQUEST_DISCOVERY_HANDOFF_OUTCOME.md) implement explicit
album review, target-owned search, and audited preparation recovery. Complete
provider-catalog pagination and collection completeness next, then resume Music
Queue pagination. This preparation design alone does not establish end-to-end
collection acquisition.
