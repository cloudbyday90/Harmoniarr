# External collection completion outcome

Implementation date: September 11, 2026. The separate [design document](EXTERNAL_COLLECTION_COMPLETION_DESIGN.md) records official sources, alternatives, security boundaries, API contracts, and PR dispositions.

## Implemented behavior

New Spotify and Apple Music artist/playlist requests and YouTube playlist requests initialize a durable collection record. Older untracked collections without accepted release intents can explicitly start preparation. Existing accepted work keeps its target; a separate request is required to capture a new selection when legacy approvals already exist.

Enumeration uses at most 50 container pages and 1,000 distinct review items. Each explicit operation processes at most 10 work rows; the next batch uses the existing preparation recovery action. Source entries seen and distinct review items are separate counts. Duplicate album references share one album item, while YouTube membership occurrences remain separately reviewable. Unsupported and unavailable entries remain visible for a reason-required exclusion.

Page evidence, children, review items, continuation, counts, and revision commit atomically. Durable input keys are unique per request; the input cursor is retained separately from the next cursor. Replaying a completed page preserves its committed evidence. Provider fetches occur outside transactions; final persistence rechecks request state, target eligibility, cancellation, and maintenance using the transaction client under the request lock.

Transactional maintenance guards now retain a shared table lock until commit, preventing maintenance acquisition from crossing an already-authorized decision or page write. Guarded collection transactions acquire that lock before domain row locks. Transactional operation cancellation reads also retain a shared row lock, so cancellation updates and page publication serialize. These guarantees apply to the transaction boundaries; provider calls already sent can still finish before the next guard rejects publication. The separate [maintenance design and concurrency evidence](MAINTENANCE_TRANSACTION_SERIALIZATION_DESIGN.md) records the tradeoffs and lock-order requirements.

Spotify playlist versions are compared before and after page reads. Detected changes, invalid or cyclic continuations, skipped offsets, malformed contents, and exceeded bounds block completion. Apple relationship traversal retains the source storefront and fixed endpoint path. Continuations never become arbitrary authenticated fetch URLs. Access and transport failures remain retryable preparation failures, rather than empty collections.

Review pages contain at most 50 items (25 in the client), with global counts and a revision. Inclusion accepts an explicit local release edition and queues target-owned discovery atomically with the decision and audit event. Different provider items can share one local release intent. Exclusion requires a nonempty reason, enforced by both service validation and a database constraint. Decisions and finalization reject stale revisions. Finalization requires a ready collection, no unfinished provider work, a decision for every captured item, at least one inclusion, and intents belonging to the current request target.

A reviewed selection becomes fulfilled only after every distinct included release intent has an applied candidate for that request and target. Imported subsets, empty or entirely excluded selections, and previous-target imports cannot imply completion. Historical collections without a review ledger also remain under review after imports. Cancellation continues to dominate progress. Excluded entries are explicitly outside the acquired selection; fulfillment does not claim a current complete copy of a live provider playlist.

## Architecture and interface

The implementation remains native ESM. Provider cursor policy, page adaptation, fetching, intake persistence/orchestration, review access/policy/persistence/orchestration, and collection fulfillment are separate modules. Existing durable operation workers, import review, authorization, rate limits, and maintenance controls remain the execution boundary.

The Vue panel uses small collection-control and item-review components. Native labelled forms, selects, buttons, pagination controls, and persistent status/alert regions support keyboard review. Failed mutations preserve drafts. Successful mutations refresh global counts and return to the first page. Provider failures are presented through bounded actionable messages.

The additive migration creates the collection and item ledger, durable work identity, and separate continuation storage. Schema anchors and the generated snapshot include migration 97. Deployment must apply migrations before serving the updated review routes. Logical settings/wanted backups do not include this ledger; retain PostgreSQL backups to preserve request decisions and history.

## Validation evidence

Final verification passed on Node 24.18.1 and npm 12.0.2:

| Check | Result |
| --- | --- |
| `npm run validate` | Passed copyright, migration policy, schema snapshot, ESM, Compose policies, lint, test hygiene, all Node tests, and client/server builds |
| Server tests | 3,351 passed |
| Client tests | 4,187 passed |
| Script tests | 328 passed |
| PostgreSQL integration tests | 85 passed, including 20 collection and three maintenance serialization scenarios |
| Total Node tests | **7,951 passed; zero failures, cancellations, or skips** |
| Focused browser tests | Five passed; zero failures or skips |
| `npm run validate:schema-bootstrap` | Passed, 97 of 97 migrations applied |
| `npm run validate:security` | Passed; dependency audit reported zero vulnerabilities |
| `git diff --cached --check` | Passed |

The browser command was `node --test --test-concurrency=1 test/browser/external-request-review.test.js test/browser/external-request-collection-review.test.js`. Keyboard paging, inclusion/exclusion, stale draft retention, finalization, preparation batches, and prior single-album/target behavior were exercised. Browser responses and provider fetches use controlled fixtures; real PostgreSQL scenarios prove transaction rollback, concurrency, cancellation, target isolation, and route authorization. Live-provider account access and immutable Docker release replay remain separate acceptance work.

The broader ownership regression now verifies that an imported historical playlist remains under review without a finalized selection, while sibling request and candidate access stay isolated. Automatic planning tests also preserve legacy approvals and hide manual preparation while a planning job is active. Queue or audit failures leave no partial decision, revision, or discovery intent.

## Recommendations and next release item

| Priority | Recommendation | Benefit | Cost or limitation |
| --- | --- | --- | --- |
| 1 | Add opt-in live-provider acceptance evidence and provider access diagnostics | Verifies authenticated multi-page access, actual envelopes, throttling, and Spotify quota-mode behavior on supported accounts. | Requires operator-owned credentials and test collections; provider entitlements can limit coverage. |
| 2 | Page broader Music Queue reads and expose preparation batch progress | Keeps large request histories responsive and makes remaining work visible. | Requires stable cursor/filter contracts and client state coverage. |
| 3 | Prove PostgreSQL backup/restore of requests, decisions, and retained jobs | Protects recovery continuity for the new durable ledgers. | Full database restoration is more operationally involved than settings export. |
| 4 | Capture fresh-install and upgrade evidence from the immutable release image | Tests migration and runtime behavior in the deployment users receive. | Depends on the packaged image and a working Docker environment. |
| 5 | Evaluate guarded automatic batch continuation after provider acceptance | Reduces repeated operator continuation actions for large collections. | Adds queue lifecycle and quota-policy complexity; retain explicit decisions and import review. |

The next recommended item is **provider acceptance and access diagnostics**, especially authenticated Spotify Development versus Extended Quota Mode playlist behavior. Controlled tests prove local contracts; they do not establish that every configured provider account can read arbitrary playlists. Acceptance should cover an owned multi-page playlist, unavailable entries, a version change, access denial, and a quota response, preserving sanitized evidence without credentials.

The final recommendation stack is Node 24 LTS, modular ESM services, existing throttled provider transports and durable operation workers, PostgreSQL transactions and uniqueness, revision-checked administrator review, and native Vue controls. Bounded explicit preparation trades extra operator actions for predictable load and recoverable progress. Keep fuzzy edition acceptance and shared cross-user acquisition deferred.

## Pull request disposition

GitHub MCP reviewed all three open PRs by immutable head and complete patch. PRs #23 and #24 propose workflow versions already superseded locally. PR #40 moves only the provider fixture to Node 26, diverging from the retained Node 24 platform baseline. No applicable PR patch was applied and no PR was merged. Exact heads and discovered URLs are recorded in the design document.
