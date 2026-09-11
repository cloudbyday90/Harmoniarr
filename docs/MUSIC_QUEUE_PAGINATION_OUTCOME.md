# Missing Music pagination and preparation progress outcome

Implementation date: September 11, 2026. Starting baseline: `17bbd38`.

## Result and purpose

The previous recommendation used the legacy name Music Queue. Its current workspace is Missing Music, where users inspect release decisions and administrators can inspect authorized household history. Recipient-owned external collection requests remain a separate preparation and review workflow.

Missing Music now offers First, Previous, and Next page navigation over bounded server reads. The previous service enriched up to 2,000 releases before filtering and slicing 50 results, with no navigation in the canonical UI. The new identity query applies authorized account and search constraints before selecting rows for expensive acquisition evidence. Existing JavaScript policy still derives the decision state.

The separate [design document](MUSIC_QUEUE_PAGINATION_DESIGN.md) records current official sources, alternatives, security and W3C reasoning, the API contract, and complete open-PR dispositions.

## Delivered architecture

Small ESM page-policy, page-service, and identity-store modules own cursor validation, bounded traversal, and parameterized SQL. The existing wanted-release evidence store accepts an explicit bounded ID list plus the authorized account list. Empty ID lists cannot fall back to an unrestricted query. The existing decision detail and command services retain their authorization and mutation policies.

Identities use `created_at DESC, id DESC`, including PostgreSQL microseconds. Cursors are versioned, length-bounded, and bound to the actor, authorized account set, scope, filters, and page size. Every page recomputes account authorization. The cursor is a traversal hint, not an authorization credential or an immutable database snapshot.

Page size defaults to 50 and caps at 100. All-state pages enrich at most that page size. Derived-state pages examine at most 200 source identities per request, in batches of at most 100. `scannedCount` includes identities fetched for enrichment, including any deleted before the evidence read; the next cursor advances only past consumed identities. This can reread the unconsumed tail of a batch on the next request, but cannot silently skip matching rows.

The API returns `total: null` with `hasMore`, `nextCursor`, and `scanLimitReached`. More source rows need not contain another matching release. Empty pages with continuation explain how to keep looking. Offset zero remains accepted; positive offsets now return a validation error directing callers to cursors. The client maintains visit history rather than claiming exact numbered pages over a frozen result set.

The client uses the existing request-generation/AbortController utility to commit rows and cursor history together. Failed navigation retains the current page. Filter changes clear old rows and reset traversal while preserving already-authorized filter controls. Late responses and errors cannot restore an old recipient's rows or change current loading state. Refresh retains the current cursor; First page begins again.

Native buttons have a separately labelled navigation region, visible focus, and mobile touch targets. Successful keyboard navigation focuses the visible result heading when the user has not moved elsewhere. Failed navigation restores the trigger in the same circumstance and announces the error. Background refresh does not move focus, and only the concise status message is live.

## Preparation progress

Collection review now reports persisted metadata-task counts, completed provider pages, captured entries/items, and queued/running preparation batches. Counts are read under the existing request lock and current recipient/revision boundary. A terminal captured provider page and a fully completed page chain establish known traversal completion; zero pending rows alone do not.

Task state, batch state, collection decisions, and acquisition remain distinct. A running batch is not represented as a count of live HTTP calls. Unknown page totals remain unknown, and the interface does not invent a completion percentage or ETA. Previous-target and cancelled requests do not receive positive current-preparation claims. Existing explicit refresh and recovery actions remain the operating model.

The existing request-list fulfillment detail also uses already-available current-collection page/item facts so preparing collections are understandable. This adds no per-list progress query or polling and does not change the requirement for a reviewed selection and target-owned imports before fulfillment.

## Database measurements and recovery

Migration `20260911_103324_missing_music_keyset_paging_indexes.sql` adds `library_wanted_releases_created_id_idx` and `library_wanted_releases_user_created_id_idx`. The source snapshot and schema anchors include both indexes. A single-recipient query uses equality so the composite index can provide the requested order; authorized household queries retain the account-set guard.

Actual PostgreSQL query-plan measurements used 20,000 generated wanted rows across two recipients and a 50-row page plus one identity sentinel:

| Identity read | Before | After |
| --- | --- | --- |
| One recipient | Bitmap heap scan of 10,000 rows plus sort; 222 buffer blocks; 8.928 ms | Index-only scan of 51 rows; four buffer blocks; 0.219 ms |
| Authorized household | Sequential scan of 20,000 rows plus sort; 426 buffer blocks; 26.536 ms | Index scan of 51 rows; four buffer blocks; 0.082 ms |

These measurements describe the generated identity query fixture, not end-to-end production latency. Search joins and later evidence aggregation have separate costs. Both indexes consume storage and add write maintenance; ordinary migration-time index construction can extend startup during an upgrade. No running deployment was migrated for this task.

The actual PostgreSQL 18.6 dump/restore rehearsal passed again at `2026-09-11T10:37:33.689Z` with **98 migration records and 106 schema anchors**, including both paging indexes. It retained request decisions, recipient ownership, continuation work, encrypted-secret behavior, and cancellation; its deliberate restore conflict rolled back and its owned container was removed. Sanitized evidence is `.tmp/missing-music-postgres-recovery.json`. Generated archive SHA-256: `dfb731b069ca46d94b7382043debfb821509c7e20266f7bcf11139bd02f232c9` (291,335 bytes). This remains generated-fixture recovery evidence.

## Validation and evidence

Validation passed on Node 24.18.1 and npm 12.0.2:

| Check | Result |
| --- | --- |
| `npm run validate` | Passed copyright, migration/snapshot policy, ESM, Compose policy, lint, test hygiene, all Node suites, and both builds |
| Server tests | 3,405 passed |
| Client tests | 4,204 passed |
| Script tests | 346 passed |
| PostgreSQL integration tests | 97 passed |
| Total Node tests | **8,052 passed; zero failures, cancellations, or skips** |
| Focused paging server policy/service/route tests | 34 passed |
| Real PostgreSQL paging/query scenarios | Five passed; includes 2,105-row traversal, timestamp ties, insertion/deletion, scoped filters, and a real downloading match after an empty 200-row scan |
| Focused paging client/API/presentation contracts | 24 passed |
| Real PostgreSQL external collection suite | 22 passed, including new progress/revision scenarios |
| Focused preparation/fulfillment server and presentation tests | 14 passed |
| Focused external review client tests | 23 passed |
| Chromium worklist and collection review suites | Five scenarios passed; zero skips |
| Migration checks, snapshot refresh/check, schema bootstrap | Passed; 98 migrations |
| `node scripts/validate-postgres-recovery.js --evidence-path .tmp/missing-music-postgres-recovery.json` | Passed; 98 migration records and 106 anchors preserved |
| `npm run validate:security` | Passed; zero dependency vulnerabilities reported |
| `git diff --cached --check` | Passed |

The combined browser command was `node --test --test-concurrency=1 test/browser/missing-music-worklist-browser-acceptance.test.js test/browser/external-request-collection-review.test.js`. Its five scenarios passed; the focused cursor scenario also passed after adding explicit pointer-reachability checks and stable screenshot capture. The PostgreSQL 17 compatibility check used `HARMONIARR_INTEGRATION_POSTGRES_IMAGE=postgres:17.11-alpine` with the retained-discovery-job scenario.

Browser checks cover Enter/Space paging, sparse empty results, failed navigation and focus recovery, filter resets, truthful preparation labels, explicit refresh, and inactive-request cleanup. Paging controls were checked at 390, 800, and 1,280 pixels in light and dark themes, including touch-target size, pointer reachability, and horizontal overflow. Screenshots under `.tmp/missing-music-pagination/` were visually inspected. A browser fixture initially used an exact heading name that omitted the nested link's accessible name; correcting that selector preserved the UI's descriptive accessible labels.

The baseline CI failure was a portable-test issue: PostgreSQL 17.11 returned foreign-key violation `23503`, while the assertion accepted only restriction violation `23001`. The corrected test accepts either code while still checking the exact retained-intent constraint and preserved job. The actual PostgreSQL 17.11 scenario passes; no constraint was weakened. The baseline dedicated PostgreSQL 18 recovery CI job passed independently.

## Limits

Pagination provides bounded release enrichment and complete traversal of a stable eligible dataset, not a cross-request snapshot. Reconciliation and account changes can alter later results; an account-set or filter change invalidates old cursors. New decisions inserted ahead of the current cursor become visible after returning to First page.

Sparse state filters may need several explicit pages. Text search and per-release candidate aggregation still depend on dataset size; the scan budget bounds how many releases are enriched, not the number of historical candidates belonging to one release. This work does not claim a production load-test result or exact matching totals. Legacy artist-specific acquisition reads remain outside this canonical worklist change.

No provider connection, acquisition job, production deployment, or user selection is changed by these reads. Controlled tests do not close live-provider acceptance, immutable application-image validation, or operator recovery gates.

Review of the integration warnings identified an existing Activity feed gap: `library-media-request-service.js` emits `request_cancelled` and `request_reassigned`, but the activity service allowlist and database CHECK constraint omit both. The actual activity service drops these events. Cancellation/reassignment state, request history, and audit records remain intact; this is an operator-observability follow-up, not a failure of the new pagination or ownership boundaries. Fix the registry, schema, safe client presentation, and real feed coverage together. Because the Activity feed is household-visible, do not add private request notes, cancellation reasons, provider URLs, or target identities to the event payload by default.

## Recommendations and final stack

| Priority | Next change | Pros | Cons / prerequisite |
| --- | --- | --- | --- |
| 1 | Replay fresh-install and upgrade acceptance against an immutable candidate image | Verifies the application and migration path users receive | Requires a built candidate digest and accepted baseline; source tests alone are insufficient |
| 2 | Capture live multi-page provider access evidence | Proves current account entitlement and real provider response behavior | Requires enabled eligible saved connections; public playlist selection alone is insufficient |
| 3 | Rehearse operator recovery cutover and external-state reconciliation | Extends database proof to keys, roles, media, sessions, and safe worker resumption | Requires explicit recovery objectives and an operator-controlled isolated environment |
| 4 | Restore cancellation and reassignment Activity events | Closes a confirmed gap in the operator timeline | Requires registry, database constraint, safe household presentation, and real feed tests together |
| 5 | Measure candidate-heavy decision queries and search at realistic scale | Identifies remaining per-release aggregation and search costs | Representative retained history is needed before choosing additional indexes or a persisted projection |

Recommended stack: Node 24 LTS, modular native ESM factories, parameterized PostgreSQL identity paging and bounded evidence reads, existing acquisition policy, external protected provider credentials, Vue Composition API with abort/generation guards, and native labelled HTML controls. Keep preparation facts separate from reviewed intent and completed acquisition.

The next release item is **immutable-image fresh-install and upgrade acceptance**, including the new pagination indexes and packaged recovery tools. Performance materialization and automatic provider traversal should follow evidence of need and safe operating limits.

## Open PR disposition

GitHub MCP refreshed all three open PRs and their complete patches. None contains an applicable change: #23 and #24 are superseded by newer pinned local actions; #40 changes only the controlled test fixture to Node 26 while the platform remains on Node 24 LTS. The design records verified links and immutable heads. No PR was applied, modified, or merged.
