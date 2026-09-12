# Local artist discography page outcome

## Delivered

The new authenticated local discography endpoint returns up to 25 release groups with exact edition counts and artist-bound keyset continuation. Implementation uses separate ESM policy, store, service, and presentation modules. Existing full metadata responses reuse the extracted mapper unchanged. Route inventory and dependency wiring include the new read.

This completes the bounded catalog-read foundation and its database benchmark. The Artist Detail editor has not migrated to it: complete operator projections, draft collections, coverage, orphan detection, and save behavior remain authoritative. There is no claimed current UI latency or rendering improvement.

## Real PostgreSQL evidence

A fixture with 200 groups sharing titles/dates and 1,092 editions traversed eight pages without duplicate or missing IDs. Counts matched a separate complete-catalog aggregate, including groups without editions.

| Measurement | Result |
| --- | ---: |
| Candidate IDs materialized for first page | 26 |
| Page IDs materialized | 25 |
| Edition-count scan executions | 25 |
| First-page release-group array JSON bytes | 10,696 |
| Complete 200-group array JSON bytes | 85,725 |

`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` ran against the actual captured service SQL. Plan assertions prove the lookahead group and off-page groups do not receive edition-count enrichment. Both byte measurements contain release groups only, excluding edition arrays and HTTP envelopes. Execution timing is diagnostic and is not a production latency threshold. Existing indexes can still require scanning/sorting additional candidate groups, and each returned group's exact count can inspect many editions.

Regression coverage includes limit 1, partial final pages, empty and missing artists, continuation after deletion of the cursor boundary, duplicate query parameters, malformed artist IDs, invalid limits, oversized/structured/extra-field/versioned cursors, and cross-artist cursor rejection before SQL. The route uses an explicit session double to verify unauthorized requests never reach the read service; that fixture does not prove the production login implementation by itself.

## Validation and deployment

Focused route/module/inventory tests (33) and the real PostgreSQL integration test passed. `npm run validate:security` passed with zero vulnerabilities. `npm run validate` passed repository policy checks, lint, 3,446 server tests, 4,267 client tests, 500 script tests, all 143 integration tests, and both builds: 8,356 Node tests total. There were no integration failures or skips. No browser interaction test was added because the editor and its UI behavior were not changed; the live authenticated Docker route smoke verifies the new production endpoint. Independent code review found no material compatibility or security issue.

The walkthrough image was rebuilt following `LOCAL_DOCKER_WALKTHROUGH.md` with existing data and configuration preserved. Image `sha256:a9e37bcb9367ddb40b96b451e2e5e68881a9b01d4c91158c6a37c070e6e98039` is healthy; `/healthz` returned 200. A live production-route smoke check logged in through the saved walkthrough setup, resolved Lauren Daigle's local artist identity, and requested `limit=1`: one release group and `hasMore: true`. An unauthenticated read returned 401. No catalog import or policy mutation was required.

## Recommendation

Keep the separate bounded read and complete authoritative projection. Its advantage is a measured database boundary without changing destructive replacement semantics. Its cost is a staged migration: the current editor still pays for the complete projection.

Next separate the complete operator draft/global summary read from the display stream, then adopt pagination with off-page-save, conflict, navigation, modal, and keyboard regressions. Decide the desired user-facing ordering first; UUID traversal is stable but is not a chronological browse order. Remote edition continuation also remains open under item 14.

See the [design, alternatives, official research, W3C requirements, and PR review](LOCAL_ARTIST_DISCOGRAPHY_PAGE_DESIGN.md). No open PR patch was applicable; none was applied or merged.
