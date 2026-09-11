# Missing Music pagination and preparation progress design

Design date: September 11, 2026. Baseline: `17bbd38`.

## Purpose and decision

The earlier recommendation called this Music Queue. The canonical platform workspace is now Missing Music; legacy routes redirect there. Its release decisions are distinct from recipient-owned external requests and collection preparation. This change bounds the canonical worklist and exposes truthful preparation progress through the existing collection review surface.

Harmoniarr is a Docker-first, Soulseek-native music library platform. A monitored artist, wanted release, media request, approved discovery intent, and acquired release represent different states. Missing Music decisions project recipient-owned wanted releases. An approved provider album does not itself establish a wanted release, a selected download, or acquired music. `useMusicQueue` remains a compatibility facade; no additional queue surface is introduced.

The existing decision service enriches up to 2,000 authorized releases before filtering their derived state and slicing a 50-row response. The API accepts offsets, but the current worklist has no page controls. State depends on acquisition quality, readiness, transfer, and import policy; applying a database limit before that filter would silently omit matches.

Use small native ESM modules for cursor validation, identity queries, page scanning, client lifecycle, and preparation presentation. Preserve the existing authoritative status policy. Scope every database page to server-authorized accounts before selecting identities or loading evidence. Neither a cursor nor a target identifier grants access.

## Paging contract

`GET /api/v1/missing-music/decisions` gains an optional bounded, versioned base64url cursor. Default page size is 50, maximum 100. Offset zero or absent remains accepted; positive offsets return a fixed validation error directing the caller to cursor pagination.

Order identities by immutable `created_at DESC, id DESC`, preserving PostgreSQL timestamp microseconds in the cursor. Bind the cursor to actor, scope, normalized filters, and page size, and recompute authorization on every request. The identity store returns a small scoped batch and one continuation sentinel before heavy candidate/transfer/import enrichment. The existing evidence query receives only that batch's IDs and the same authorized account guard.

For all states, enrich at most the requested page size. For derived-state filters, scan at most 200 source releases per request in batches of at most 100. Stop at the returned page size or scan budget. A continuation refers to the last consumed source identity so remaining matches are reachable without restarting the first 2,000-row scan.

The response page is `{ limit, offset: 0, total: null, hasMore, nextCursor, scanLimitReached, scannedCount, sourceLimitReached: false }`. `hasMore` indicates more authorized source rows, not a promise of another matching result. An empty filtered page can have a continuation. Exact totals and cross-request snapshot consistency are deliberately not claimed. Concurrent insertion, deletion, reconciliation, or state changes can change later observations; First page refreshes the traversal.

Measure identity query plans before adding indexes. Any needed index migration uses the repository generator and snapshot/anchor workflow. Legacy artist-specific acquisition reads and request-list paging remain separate surfaces.

The implemented migration adds global and recipient-prefixed `created_at DESC, id DESC` indexes after measuring both query shapes. The [outcome](MUSIC_QUEUE_PAGINATION_OUTCOME.md) records the before/after plans and schema/recovery proof. Indexes trade additional storage and write maintenance for efficient ordered identity selection; migration-time construction can extend upgrade startup.

## Client and W3C behavior

Add an explicitly labelled navigation region with native First, Previous, and Next buttons and the current page number. Keep per-visit cursor history for backwards navigation. Apply/reset filters starts a fresh traversal; refresh stays on the current page. Failed navigation does not advance history. A request-generation gate and AbortController reject stale data, errors, loading flags, and page state after filter changes or unmount.

Keep a persistent concise `role="status"` message for loading and result changes; do not turn the entire list into a live region. Empty filtered pages with more source rows explain how to continue. Page navigation may move focus to the results heading after completion when the user has not moved elsewhere; background refresh does not steal focus. Native labels, visible focus, design tokens, and mobile touch targets follow the existing UI system.

## Preparation progress

Extend collection review with an allowlisted aggregate scoped to the current request recipient and collection revision. Report persisted work counts separately from queued/running operation counts: current intake does not mark an individual row processing while every provider HTTP call is active. Report captured pages, entries, and review leaves; keep total provider pages unknown until traversal is established complete. Do not expose raw provider evidence, source cursors, errors, or credentials.

Queued and running operation counts describe eligible preparation batches, not simultaneous HTTP requests. Knowing that container traversal is exhausted does not establish completion of album metadata preparation or acquisition. Reassignment must not relabel retained previous-recipient work as belonging to the current request target.

Use a separate preparation component and pure presentation helper, with explicit refresh and existing bounded recovery actions. Do not invent completion percentages, ETAs, or acquisition success. A previous-target collection or cancelled/blocked work must not receive misleading active preparation copy. Preserve reviewed decisions and existing fulfillment semantics.

## Official research and implications

Sources below were discovered through web search or links from discovered official documentation, then opened using web or GitHub MCP services. The OWASP chapter website returned errors during direct reading, so its official repository documents were read through GitHub MCP.

| Official source | Finding | Application to this change |
| --- | --- | --- |
| [PostgreSQL 18 LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html) | Pagination requires an ordering that uniquely determines rows. Skipped offset rows still require computation. | Use explicit stable ordering and keyset continuation; a truncated in-memory slice is not complete pagination. |
| [PostgreSQL 18 indexes and ordering](https://www.postgresql.org/docs/18/indexes-ordering.html) | A matching B-tree index can retrieve a limited ordered range without sorting the entire candidate set. Index usefulness depends on the query. | Select bounded, authorized source identities before heavy enrichment. Inspect actual query plans and add only justified indexes. |
| [PostgreSQL 18 row comparisons](https://www.postgresql.org/docs/18/functions-comparisons.html) | Ordered row comparisons evaluate fields left-to-right; nulls can make the comparison unknown. | Use non-null cursor keys and matching ordering/comparison directions. Preserve timestamp microseconds instead of converting through JavaScript milliseconds. |
| [OWASP API1 object authorization](https://github.com/OWASP/API-Security/blob/master/editions/2023/en/0xa1-broken-object-level-authorization.md) | Every operation on a client-supplied object identifier needs authorization for that object and action. IDs do not establish permission. | Resolve actor and permitted recipient scope before source, cursor, enrichment, detail, or preparation reads. A cursor never authorizes access. |
| [OWASP API4 resource consumption](https://github.com/OWASP/API-Security/blob/master/editions/2023/en/0xa4-unrestricted-resource-consumption.md) | Bound page size, input size, operation count, and execution resources on the server; rate limits alone do not bound work within a request. | Cap source scans and enrichment independently of returned matches. Validate cursors and filters and retain the existing read-rate boundary. |
| [Vue watcher cleanup](https://vuejs.org/guide/essentials/watchers.html) | Stale asynchronous requests can complete after watched input changes. Vue supports cancellation cleanup; `onWatcherCleanup` requires Vue 3.5+ and synchronous registration. | Abort superseded reads and guard commits to rows, errors, loading flags, and pagination history. Cleanup also runs on teardown. |
| [W3C pagination component](https://design-system.w3.org/components/pagination.html) | Pagination navigation has its own accessible name; actual current-page links use `aria-current="page"`. | Give worklist navigation a distinct label. Use native buttons for in-place commands; the visit number is not an exact page count over a frozen dataset. |
| [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | Buttons support Enter and Space, have accessible names, and preserve or move focus according to the action's context. | Keep native behavior, predictable focus, and meaningful disabled states. Background refresh does not move keyboard focus. |
| [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) and [W3C ARIA25](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA25) | Loading, result summaries, and progress messages must be available without taking focus. A progressbar is not itself a live region. | Maintain concise status messages for result and preparation changes. Do not make the entire list live or invent percentages from unknown totals. |

The keyset scan, sparse-page contract, and request-generation guard are application design decisions derived from documented mechanisms, not claims that these sources prescribe Harmoniarr's exact API. WCAG techniques and the W3C design-system example are informative implementation guidance.

## Options and tradeoffs

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Add controls to the existing capped in-memory slice | Small client change | Still enriches broad data repeatedly and permanently hides releases beyond the cap | Reject |
| SQL offset paging after complete derived-state computation | Familiar random-access pages and potentially exact totals | Deep offsets remain costly; mirroring complex JavaScript state in SQL risks semantic divergence | Defer |
| Bounded keyset source scans with existing derived-state policy | Caps expensive work per request, preserves state semantics, and permits traversal beyond the old cap | Sparse pages can be empty; no exact matching total or arbitrary page jumps | Choose |
| Persist a separate materialized decision index | Fast indexed state filtering and counts | Adds write-side invalidation, schema, repair, and stale-authorization responsibilities | Consider only after measured need |
| Infinite scrolling or automatic traversal until a match appears | Fewer explicit navigation actions | Obscures work bounds, retry behavior, and keyboard position | Defer |
| Separate safe preparation counts | Explains retained request work without changing acquisition policy | Totals can remain unknown and must retain target/revision context | Choose |

## PR and baseline CI review

GitHub MCP refreshed every open PR and read its complete patch on September 11, 2026. Each PR has one changed file, and none supplies an applicable local patch. No PR was applied or merged.

| PR and immutable head | Disposition |
| --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40), `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Changes only the controlled fixture from Node 24 to Node 26. Retain the platform's Node 24 LTS baseline. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24), `40cf4d117b69bd55b9a0a7353361838216e1e952` | Requests build-push action 7.2.0; local 7.3.0 at `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a` already supersedes it. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23), `ae651337286216e92be7ae977e39fcedc14de7f9` | Requests metadata action 6.1.0; local 6.2.0 at `dc802804100637a589fabce1cb79ff13a1411302` already supersedes it. |

The baseline [Repository Validation run](https://github.com/cloudbyday90/Harmoniarr/actions/runs/34587933518) failed one integration assertion: PostgreSQL 17.11 reports SQLSTATE `23503` where the retained-discovery-job test expected `23001`, with the expected foreign-key constraint intact. The correction must accept the supported restriction codes while continuing to verify the exact constraint and protected row. Its dedicated PostgreSQL recovery, migration, and schema jobs passed. [Browser Validation](https://github.com/cloudbyday90/Harmoniarr/actions/runs/34587933481), [Security Scanning](https://github.com/cloudbyday90/Harmoniarr/actions/runs/34587934113), and [Supply Chain](https://github.com/cloudbyday90/Harmoniarr/actions/runs/34587933571) passed. These baseline results are separate from validation of the new pagination implementation.

## Final stack and validation

Use Node 24 LTS, native ESM service/store/policy modules, parameterized PostgreSQL keyset reads over authorized source identities, existing JavaScript decision derivation, Vue composables with cancellation and request-generation guards, and native HTML navigation with concise accessible status messages. Reuse the existing request and operation ledgers for preparation facts.

Prove bounded enrichment, traversal beyond the old cap, equal timestamps, sparse filtered pages, cursor/filter binding, recipient isolation, and live changes with focused store/service and real PostgreSQL tests. Prove late success, late error, abort, teardown, polling overlap, failed navigation, and filter resets at the composable boundary. Use Chromium checks for keyboard navigation, status/empty/error feedback, focus preservation, responsive controls, and themes. Validate preparation counts against real current-target/revision and queued/running state, without allowing the read to queue work.

Run focused validation first, then the repository validation stack, appropriate client lint/build checks, and the security audit. Record executed commands and outcomes in a separate outcome document. A design or successful unit test does not establish packaged-image readiness, live provider access, or real operator recovery. Those remain separate release gates from the [recovery outcome](POSTGRES_RECOVERY_REHEARSAL_OUTCOME.md).
