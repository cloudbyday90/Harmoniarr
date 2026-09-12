# Compact operator summary outcome

## Delivered

Operator summaries now read complete compact catalog identities instead of hydrating every release edition and counting editions per group. A dedicated ESM store selects group IDs/types and canonical IDs in one parameterized left join. The internal metadata reader preserves artist, aliases and detection-event fields. Startup wiring explicitly injects that reader into the summary path; legacy/full readers and mutation responses retain their existing contracts.

The same effective-state, coverage and overview functions consume the compact input. Complete actor-scoped selections and track overrides remain intact. Explicit alternate-edition IDs do not require hydrated release objects to contribute to coverage, and groups without canonical editions remain visible to unresolved coverage and orphan calculations.

## Equivalence and measurement

A real PostgreSQL fixture contains 200 groups, 1,000 editions (199 canonical), two actors, varied policy types, explicit alternate editions, null-to-canonical fallback, no-canonical unresolved groups, and complete/duplicate/partial/missing reconciliation paths. The complete optimized summary equals the full projection with only catalog arrays omitted for both actors. Separate focused tests prove orphan counts and production module wiring.

| Internal metadata input | SQL calls | Returned rows | Serialized JSON bytes |
| --- | ---: | ---: | ---: |
| Full | 5 | 1,202 | 662,172 |
| Compact | 3 | 201 | 38,075 |

The detection provider is stubbed identically in both measurements, so its SQL calls are excluded. These are internal inputs before operator projection and HTTP serialization, not wire bytes or rows scanned. The public summary contract remains the same. `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` of the actual compact SQL returned 200 rows without an Aggregate node. One run reported an estimated plan row width of 136 bytes, 404 shared-buffer hits and zero shared-buffer reads. Width is an optimizer estimate and these fixture buffer statistics do not establish production disk behavior or a scan bound.

## Validation and deployment

Focused projection/module/route tests, orphan tests and real PostgreSQL equivalence tests passed. Security validation passed with zero reported vulnerabilities. The initial `npm run validate` passed repository checks, lint, and 3,455 server tests, then exposed two recurring wall-clock polling test failures in the client phase. Their [deterministic test repair](DETERMINISTIC_POLLING_TESTS.md) uses controlled timer advancement and preserves terminal-state/no-further-fetch assertions; both affected files passed 19 tests. Production polling was unchanged. After the repair, test lint and the complete client (4,273), script (500), and integration (145) phases passed, followed by both client and server builds. Together with the unchanged server phase, all 8,373 tests passed across the completed validation phases. The initial validation command itself failed at the client phase; the corrected phases were run separately.

Docker was rebuilt following the local walkthrough with existing configuration/data preserved. Image `sha256:888b0d083c50844579bf8c13c88273fbac9cc51a678d9cea3fdf7eb889288257` is healthy and `/healthz` returns 200. Live authenticated full and summary reads for Lauren Daigle matched exactly after removing only the full response's catalog arrays; both report 41 global groups. The summary omits catalog arrays, and unauthenticated access returns 401. No import or policy mutation was required.

## Limits and final recommendation

This removes edition hydration, edition counts and an unused legacy monitoring read from the global summary path. It still processes every artist group and the complete saved decision arrays. Neither constant work nor production latency is claimed. The compact catalog join has one statement snapshot; other actor/status reads remain separate live reads under the existing contract.

Keep compact complete inputs, the existing policy/coverage logic, the separate paged display service, and revision-checked saves. This avoids duplicating policy in SQL or introducing cache invalidation. The tradeoff is retaining computation proportional to groups and decisions. Do not add a covering index without workload evidence beyond this fixture.

Next address remaining remote edition continuation: allow choosing editions beyond the first provider page while validating group membership and preserving dialog cancellation/selection state. Further global aggregation optimization should follow representative workload measurement rather than speculative caching.

See [design, pros/cons, official sources, and PR review](COMPACT_OPERATOR_SUMMARY_DESIGN.md). No applicable open PR patch was applied or merged.
