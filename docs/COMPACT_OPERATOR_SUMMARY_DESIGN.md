# Compact operator summary inputs

Reviewed September 12, 2026.

## Decision

Replace full catalog hydration only for the opt-in operator summary with compact complete catalog inputs: every release-group ID and primary type, plus its canonical release ID when present. Keep artist identity, aliases, detection events, complete actor-scoped monitoring/selections/track overrides, revision and run state. Reuse existing effective-state, overview, and coverage functions.

Coverage reads resolved release IDs, not hydrated release objects. Explicit noncanonical selections retain their resolved IDs directly from saved selections; null explicit IDs still fall back to canonical IDs. A left join preserves groups without canonical releases, which must count toward unresolved coverage. Orphan detection still sees every group ID. No paging or truncation applies to global inputs.

A narrow ESM store reads only the required columns. A distinctly named internal metadata read builds projection inputs; it is not exposed as a metadata response. The operator projection chooses it only for summary reads. Existing default/full reads and mutation responses retain their complete hydrated shapes. Explicitly injected legacy read adapters retain a compatibility fallback; default production wiring uses the compact path.

## Alternatives and final stack

| Approach | Pros | Cons |
| --- | --- | --- |
| Compact complete inputs with existing JS semantics (chosen) | Removes edition hydration/counts without duplicating policy; no schema migration | Still processes every group and complete override arrays |
| Reimplement all global aggregates in SQL | Potentially less application memory | Duplicates policy, null, orphan, and coverage semantics |
| Persist a revisioned read model | Can reduce repeated reads further | Invalidation and consistency machinery with migrations |
| Use only the display page | Small input | Incorrect global coverage/orphan results; rejected |

Final stack: existing authenticated summary route → strict full/summary policy → operator projection factory → internal compact metadata read/store → existing effective-state and coverage logic. Preserve revision-checked saves and the independent actor-scoped display page service.

## Correctness and security

Use parameterized artist queries and the existing actor-scoped policy stores. Do not introduce writes, provider calls, caches, or privileges. Read pages and summaries remain live reads under existing isolation semantics; no new cross-query snapshot guarantee is claimed. Invalid views fail before reads. The existing unique partial canonical-release index prevents duplicate canonical rows per group.

No UI changes are required: complete draft arrays, status messages, keyboard controls, global counts and revision fields remain compatible. Existing W3C-oriented pagination/focus behavior remains covered by browser regression tests; this backend optimization is not a claim of whole-application conformance.

## Evidence plan

Compare optimized summary output to the existing full projection after omitting only catalog arrays. Include two actors, varied group types, canonical and explicit alternate editions, null fallback, no canonical, selected/unselected/partial states, complete/duplicate/partial/missing reconciliation, and off-catalog orphan overrides. Assert exact global-object equality. Capture actual SQL returned rows and internal serialized input sizes separately from public payloads; use EXPLAIN for actual plan evidence. Do not claim production latency or constant work from a synthetic fixture.

## Official research and PR review

Official URLs were discovered and opened on September 12, 2026. [PostgreSQL SELECT lists](https://www.postgresql.org/docs/18/queries-select-lists.html) support selecting only required columns. [Partial indexes](https://www.postgresql.org/docs/18/indexes-partial.html) support matching the existing canonical predicate. [Index-only scans](https://www.postgresql.org/docs/18/indexes-index-only-scans.html) require both index coverage and visibility conditions; narrower output does not guarantee zero heap access. [EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html) supplies actual plan evidence. [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) explains why one joined catalog statement is coherent while separately issued actor/status reads remain live. [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) supports preserving the existing equivalent UI contract without introducing new announcements.

GitHub MCP refreshed complete patches and metadata for all open PRs. [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40), head `649659f1e199d48d55cc8d5cccf9f079dc235d86`, is an unrelated Node-major fixture upgrade. [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24), head `40cf4d117b69bd55b9a0a7353361838216e1e952`, and [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23), head `ae651337286216e92be7ae977e39fcedc14de7f9`, are superseded by newer local action pins. No applicable patch was applied or merged.
