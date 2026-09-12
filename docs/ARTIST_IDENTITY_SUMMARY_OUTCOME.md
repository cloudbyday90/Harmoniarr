# Lightweight artist identity read outcome

## Delivered

Artist Detail opts into `view=summary` on its initial local artist read. The response contains artist identity and monitoring only, skipping catalog, alias, and detection-event assembly. The subsequent operator projection remains complete. Existing metadata workflows retain the default full representation; explicit full is also supported.

Unsupported or structured view values are rejected before database queries. The existing route still requires a session, preserves 404 behavior, and allowlists summary fields. No API caching policy, SQL schema, dependency, or mutation behavior changed.

## PostgreSQL evidence

A disposable real PostgreSQL fixture contains 200 release groups and 1,000 editions. One measured comparison returned:

| Representation | SQL calls | Rows returned | Serialized service-payload JSON bytes |
| --- | ---: | ---: | ---: |
| Full | 6 | 1,202 | 672,678 |
| Summary | 2 | 2 | 539 |

These are returned rows, not all rows scanned, and serialized service objects before the HTTP wrapper, not actual wire bytes. Timing was recorded diagnostically without a latency threshold; this does not establish production or whole-page speedup. Monitoring remains household-scoped and the full operator projection still loads its complete catalog.

The integration test also verifies full catalog counts, summary shape, invalid and repeated views, missing artists, and a route session guard. Its explicit session double verifies routing/gating rather than the production login implementation. Four artist lifecycle/pagination browser scenarios passed. Client contract tests prove summary opt-in and unchanged full default. Security validation reports zero vulnerabilities. Docker rebuilt and bootstrapped with existing data preserved: healthy container, HTTP 200 from `/healthz` at http://127.0.0.1:47956. Image: `sha256:0c9d647ea0577219ae032e97d3105a2e15fb3b5ffcdbf785cacd9e09c75458fe`.

## Validation record

`npm run validate` passed repository policy checks, lint, 3,446 server tests, 4,267 client tests, and 500 script tests. Its integration phase exposed a reproducible stale PostgreSQL activity snapshot in an existing concurrency-test helper. The [separate test repair document](POSTGRES_LOCK_OBSERVATION_TEST_FIX.md) records the cause, alternatives, and official sources. The original assertion and bounded deadline remain unchanged; the corrected individual test passes.

The complete `npm run test:integration` rerun passed all 142 tests with no failures or skips. Together, the completed test phases passed 8,355 Node tests. The initial `npm run validate` invocation failed at the test-helper defect; its failed integration phase was rerun successfully after repair, and its build phase was completed separately. `npm run build` passed both client and server builds; `npm run validate:security` passed with zero vulnerabilities. The four browser scenarios were run through the artist mutation lifecycle and discography pagination verification files. Independent review found no material compatibility or security issues.

## Recommendation and remaining scope

Keep this opt-in summary plus the authoritative full operator projection. It removes redundant work with a compatible API change. The tradeoff is an additional representation choice; it does not make the entire page bounded.

Next: design a separate paged local display projection that selects deterministic release-group IDs before edition counts/enrichment, while computing global coverage and orphan state independently. Benchmark realistic large catalogs before migrating the UI. Remote edition continuation remains another unresolved part of review item 14.

See the [design and research](ARTIST_IDENTITY_SUMMARY_DESIGN.md) for alternatives and official sources. All open PRs were reviewed; none was applicable and none was merged.
