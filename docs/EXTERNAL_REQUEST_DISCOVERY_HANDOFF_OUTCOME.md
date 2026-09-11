# External request discovery handoff outcome

Date: 2026-09-10 (local review date; migration timestamp uses UTC)

## Delivered behavior

Administrators can review a completed Spotify or Apple Music album on its external request, search existing local catalog editions, and explicitly approve a release for that request's target. Approval queues a distinct Soulseek search. It creates pending import candidates with the original request, approved release intent, and recipient preserved through persistence and placement.

Metadata approval does not authorize automatic source-file selection, download, or import. The automatic selection and recovery paths exclude these candidates. Source files still require explicit import review. A failed or empty search becomes a failed Background Job that an administrator can explicitly retry; each approval or retry permits one attempt.

Historical requests without provider rows can be explicitly queued for planning. Pending or failed provider items can be queued for execution without deleting completed metadata or approvals. Concurrent recovery clicks reuse active preparation. Cancelled requests and ineligible targets cannot be recovered.

## Architecture and security outcome

The new modules separate provider evidence projection, review policy, transactional persistence, error projection, discovery runs, execution, worker lifecycle, and fulfillment aggregation. The existing library module composes them. All JavaScript remains ESM; no dependency or runtime-major change was introduced.

`library_external_request_release_intents` stores the request, local release, target, approver, stable provider identity, bounded provenance, and operation correlation. Unique request/release and request/provider keys preserve the explicit approval contract. Request-row serialization makes repeated concurrent approval return the existing decision; a different release, provider mapping, or target conflicts. Selection, operation creation, and audit commit together, with rollback when any required write fails.

Provider re-planning can remove fetched rows without deleting approval provenance. Referenced discovery jobs are retained by both ledger pruning paths and the pruning preview. A restrictive foreign key prevents deletion of the job while its intent still exists. This preserves the recorded status and retry action for the request's lifetime at the cost of retaining one job per approved release.

The discovery service rechecks active request state, current target, user eligibility, maintenance, and cancellation before search and before candidate persistence. Final checks and candidate writes use one PostgreSQL client, including the request lock and user read, so a small connection pool cannot deadlock on extra connections. Provider calls remain outside the transaction. Already-sent remote calls may finish; later persistence still passes the final guard.

Review reads require an administrator session. Writes also require a fresh administrator session, the administrator mutation limiter, and the existing configured CSRF policy. Required CSRF mode was explicitly tested; keeping it enabled is the secure deployment recommendation. Unexpected service/database failures return bounded public messages, while expected conflicts and validation errors stay actionable. Provider responses, credentials, peer paths, and internal diagnostics are not part of requester progress.

## User-facing outcome

The request detail view embeds a focused Vue panel and composable. Native labelled artist/title inputs and a required edition select keep the choice explicit. The selected edition remains readable on narrow screens. Persistent status and alert regions report results without moving focus. Rejected selections remain available, duplicate clicks are suppressed, and obsolete asynchronous results cannot overwrite another request's state.

Accepted provider items no longer offer another approval form. Previous-target intents are identified after reassignment; the administrator creates a separate request for a new target rather than silently retargeting accepted work. Requester pipeline reads continue to require the request's current owner.

An imported album does not fulfill other approved release intents. Collection requests remain under review after their currently approved albums are imported because complete inclusion and pagination are not yet represented. A direct album request can become fulfilled when its own approved album is applied for its target.

## Validation evidence

The focused PostgreSQL suite exercises real transactions, routes, the queue handler, leased worker, and candidate ingestion. It covers concurrent exact approval, conflicting decisions, rollback on queue/audit failure, provider provenance retention, separate recipients sharing a release, current-target access, cancellation, disabled targets, historical recovery, configured CSRF, and session freshness. Concurrent ingestion also succeeds with a PostgreSQL pool of two connections.

Three browser scenarios pass with no skips: explicit edition approval with a rejected draft retained; preparation recovery; and a previous-target approval after reassignment. Visual inspection covered desktop 1280/light, tablet 768/dark, and mobile 390/light. Browser review responses are controlled fixtures; the PostgreSQL integration suite supplies the persistence and route-authorization evidence.

Final verification passed on Node 24.18.1 and npm 12.0.2:

| Check | Result |
| --- | --- |
| `npm run validate` | Passed: copyright, migration policy, schema snapshot, ESM, Compose policies, lint, test hygiene, all Node tests, and both builds |
| Server tests | 3,301 passed |
| Client tests | 4,180 passed |
| Script tests | 328 passed |
| PostgreSQL integration tests | 62 passed, including 13 new handoff scenarios |
| Total Node tests | **7,871 passed; zero failures, cancellations, or skips** |
| Focused browser tests | 3 passed; zero failures or skips |
| `npm run validate:schema-bootstrap` | Passed, 96 of 96 migrations applied |
| `npm run validate:security` | Passed; dependency audit reported zero vulnerabilities |
| `git diff --cached --check` | Passed |

The final integration coverage also proves that ledger preview/deletion agree while preserving referenced retry jobs, and that queue/audit failures return sanitized HTTP errors with no partial approval. The browser command is `node --test --test-force-exit --test-concurrency=1 test/browser/external-request-review.test.js`.

## Research, alternatives, and PR disposition

The separate [design document](EXTERNAL_REQUEST_DISCOVERY_HANDOFF_DESIGN.md) records primary sources discovered through web search and GitHub MCP, accessed September 10, 2026, plus alternatives and their tradeoffs. The final stack is Node 24 LTS, modular ESM, Express authorization and CSRF boundaries, PostgreSQL transactions and row locks, the existing durable operation queue, and native Vue form semantics.

The key tradeoff is explicit review and a separate search for each target in exchange for correct edition selection, auditable ownership, and retained import review. Shared acquisition/delivery and automatic cross-provider matching remain separate architectural work.

All three open PRs were inspected by immutable head through GitHub MCP. PRs #23 and #24 propose action versions already superseded locally. PR #40 changes only the controlled-provider fixture to Node 26, diverging from the production LTS major. None was applicable, applied, or merged; details and official links are in the design document.

## Limits and next release item

September 11 follow-up: the pagination and collection completion item below is implemented in [External collection outcome](EXTERNAL_COLLECTION_COMPLETION_OUTCOME.md). The earlier validation counts and behavior in this document describe the September 10 increment.

Tracks and YouTube videos are not implicitly broadened into album acquisitions. Artist and playlist rows are containers; only their completed album leaves can be approved. This increment searches existing local release metadata and does not automatically import or infer a MusicBrainz edition from a provider title.

Provider paging and a durable collection completion policy are the next release item. Persist a stable item ledger and bounded page cursors, ensure page expansion and its checkpoint commit atomically, and represent explicit inclusion/exclusion before marking a collection complete. Prove repeated cursors, partial provider failures, cancellation, and recipient isolation with real database tests. Expose completion and remaining work through paginated review/Music Queue reads.

This addresses the remaining risk that prepared or imported albums represent only part of a collection. Keep automatic matching and shared acquisition deferred until that completeness contract is reliable. The current logical settings/wanted backup format is not a full request-ledger backup; retain PostgreSQL backups when request history and approvals must survive database replacement.
