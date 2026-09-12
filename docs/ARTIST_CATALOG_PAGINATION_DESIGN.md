# Remote artist catalog pagination design

Reviewed September 12, 2026. This is the first bounded part of artist review item 14: remote release-group browsing. Local full-catalog queries and remote edition pagination remain separate work.

## Findings and decision

Artist Detail requests 100 remote release groups, while the existing application catalog validator accepts at most 25. It also discards total/offset metadata. Use the existing authenticated browse API with pages of 25 and expose explicit Load more activation. No new endpoint, dependency, or server query is required.

A per-view ESM composable owns remote results, cursor, cached metadata, loading/error state, and cancellation. Advance offsets by the raw response length, deduplicate displayed entries by MusicBrainz ID, and reject mismatched response offsets. Keep successful pages on later failures and allow explicit retry at the same cursor. Suppress duplicate activations, abort obsolete requests, and reject stale results after navigation, reset, projection replacement, or disposal.

Show loaded count, reported total when available, and honest completeness. Unknown totals must not be presented as complete. Provider pagination is not a snapshot: overlaps or changing totals can prevent proving completeness even after the last returned page. Never silently claim all groups were loaded when deduplicated results remain below the reported total.

Use a native button with aria-disabled guards during loading/end state so keyboard focus is retained. A separate polite status reports progress; errors retain visible cards. State explicitly that filters apply to loaded groups. Keep saved operator projection and policy drafts separate from incremental display pages.

## Why local queries are deferred

metadata-read-service eagerly retrieves all groups and editions, and the operator projection repeats full-catalog reads. The projection uses complete data to classify orphaned overrides and calculate coverage. Adding LIMIT there would change authoritative policy semantics. A subsequent local display API must page deterministic group IDs before edition enrichment and preserve full reconciliation/global aggregates. No local SQL performance improvement or benchmark result is claimed in this slice.

## Options and final stack

| Option | Pros | Cons |
| --- | --- | --- |
| Explicit remote pages (chosen) | Bounded requests; accessible control; preserves existing cards and draft | Filters cover loaded pages; provider totals may change |
| Automatically fetch every page | Full catalog eventually without clicks | Unbounded upstream work and slower completion on large artists |
| Truncate local projection | Appears cheaper | Corrupts orphan/coverage meaning; rejected |
| Separate paged local display API | Can reduce local query cost safely | Requires new aggregate boundaries, indexes, and measured database evidence |

Final stack: existing 25-item catalog API → scoped ESM pagination composable → Artist Detail integration → small semantic pagination component. Existing server rate limiting and session protections remain in force.

## Official research

Sources discovered via tools as of September 12, 2026:

- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API): indexed official pagination guidance; direct page retrieval returned HTTP 429. Do not confuse the provider's maximum with the application's stricter 25-item contract.
- [MusicBrainz rate policy](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting): opened; retain existing rate limiting and identifiable requests.
- [PostgreSQL LIMIT/OFFSET](https://www.postgresql.org/docs/current/queries-limit.html): opened; deterministic unique ordering matters and skipped rows still incur work. This informs the next local-query phase.
- [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) and [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): opened; preserve keyboard activation, focus context, and status feedback.

## Open PR review

GitHub MCP refreshed all complete patches and immutable heads. #40 at `649659f1e199d48d55cc8d5cccf9f079dc235d86` is an unrelated Node-major fixture change. #24 at `40cf4d117b69bd55b9a0a7353361838216e1e952` and #23 at `ae651337286216e92be7ae977e39fcedc14de7f9` are superseded by newer local action versions. None was applicable; no PR was merged.
