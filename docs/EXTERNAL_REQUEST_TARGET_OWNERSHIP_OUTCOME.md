# External request target ownership outcome

Date: 2026-09-10
Status: Implemented and validated
Design: [Research, alternatives, and recommendation stack](EXTERNAL_REQUEST_TARGET_OWNERSHIP_DESIGN.md)

## Delivered behavior

Every eligible target in a new external URL submission receives its own durable
planning intent, evidence, and audit. Parent and child rows and all planning jobs
commit in the existing creation transaction. A failure on the final child's job
rolls back the entire submission, including earlier jobs and audits. Optional
notifications still publish after commit.

Planning and execution continue to use each target's own request ID. No parent
candidate is copied or treated as proof of a child's delivery. External fulfillment
and pipeline reads also require candidate ownership to match the request's current
target, preventing stale pre-reassignment candidates from reporting completion
for a new recipient. Existing candidate access and managed-library placement
rules remain in force.

The new `library-external-request-active-service.js` centralizes current-request
checks for planning, execution queueing, and provider calls. Workers stop inactive
requests using the existing cancellation mechanism, including cancellation
between provider calls. Planning is not marked completed before its required
execution handoff succeeds. The unused duplicate external-intake factory was
removed from the provider execution module.

Family cancellation now requires an administrator. A recipient cancelling the
first target's request changes only that request; other targets keep their own
planning and execution work. This closes an ownership boundary exposed by
reviewing cancellation together with independent jobs.

The new progress store reads only preparation phase, run status, timestamp,
failure count, and remaining provider work for server-selected request IDs.
Active jobs take precedence over newer terminal history when a job is retried.
Pending derived rows and pruned history produce explicit review-needed statuses.
The pure progress module converts these fields to fixed public copy.
Provider preparation completion means details
are ready for acquisition review; it never means music was imported. An actual
target-owned candidate takes precedence over stale preparation state. Cancelled
requests cannot become fulfilled because a late candidate completed.

Request Detail now has a persistent named status region with `aria-atomic="true"`.
Changed labels are exposed without moving keyboard focus. An unchanged poll does
not mutate the status text. Browser checks prove the observable DOM/focus behavior;
they do not constitute a manual screen-reader or complete WCAG audit.

## Additional defect found and fixed

Real multi-user integration checks found that the request event-history route
was missing its service dependency in `library-module.js`, returning an internal
error. The route now receives the existing authorization-aware event service.
The same integration scenario proves sibling requests remain inaccessible.

## Verification

- `node --test test/server/library-external-request-active-service.test.js test/server/library-provider-ingest-planning-service.test.js test/server/library-provider-ingest-execution-service.test.js test/server/library-external-request-worker-cancellation.test.js test/server/library-external-intake-worker.test.js`: 31 passed, no skips.
- `node --test test/server/library-module.test.js test/server/library-external-request-progress.test.js`: 17 passed, no skips.
- `node --test test/server/library-media-request-service.test.js`: 42 passed,
  including four administrator-only cascade regressions.
- `node --test --test-concurrency=1 test/integration/library-external-request-target-ownership.test.js`:
  six real PostgreSQL/HTTP scenarios passed with no skips. Covers independent
  planning/provider rows, late rollback/retry, requester isolation, safe failures,
  stale-owner candidates, child and administrator cascade cancellation, remaining
  provider work, retry precedence, and pruned history.
- `node --test --test-force-exit --test-concurrency=1 test/browser/request-detail-provider-preparation-feedback.test.js`:
  one passed, no skips. Covers initial empty status region, changed preparation
  label, unchanged-poll silence, persistent DOM region, keyboard focus, and absence
  of sibling identifiers or false fulfillment.
- Focused ESLint and client build passed.
- `npm run validate:security` passed with zero reported vulnerabilities.

Final combined validation passed:

| Gate | Result |
| --- | --- |
| `npm run validate` | 3,252 server, 4,164 client, 328 script, and 49 integration tests; 7,793 total, zero failures or skips |
| Included repository checks | Copyright, migration policy, schema snapshot, ESM, image tags, Compose topology, lint, test hygiene, and client/server builds passed |
| Focused browser regression | One passed, zero skips, with final server status copy |
| `npm run validate:security` | Passed; zero reported vulnerabilities |
| `git diff --cached --check` | Passed |

No production provider call or published-image rollout was performed. Provider
responses in the PostgreSQL scenarios are controlled fixtures using real stores
and services; this proves the ownership boundary without claiming complete
external acquisition.

## PR outcome

All three open PRs were refreshed through GitHub MCP. None was applicable:
two action updates are superseded locally and the third is a fixture-only Node
major upgrade. No PR was applied or merged. Immutable heads and source links are
recorded in the design.

## Limits and next item

Per-target planning intentionally duplicates provider reads until shared metadata
reuse can coexist with explicit per-target delivery. It uses the existing target
bound, queue, concurrency, and provider-client behavior. Cancellation stops at
checked work boundaries; a provider request already sent may finish. The change
does not provide HTTP POST replay idempotency or a new job deduplication guarantee.

Provider response preparation is not the complete external acquisition pipeline.
The next release item is the provider-metadata-to-discovery handoff, preserving
target identity and operator review, with an audited recovery path for historical
children that never received planning jobs. Existing rows are not silently
resubmitted to providers at startup. Music Queue/provider-catalog pagination
remains the following item in the release review.
