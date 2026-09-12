# Local artist display and saved-state separation

Reviewed September 12, 2026.

## Decision

Artist Detail requests the existing operator projection with opt-in `view=summary`. The service computes the complete authoritative projection, then omits its catalog arrays from this response. Monitoring, every saved selection and track override, coverage, overview, and snapshot revision remain complete. Default reads and save responses retain the full contract.

A separate authenticated operator discography endpoint reads bounded catalog pages and enriches only those groups with the current session actor's policy, selections, override summary, and canonical or selected release. It never computes global orphan or coverage state from one page. Narrow ESM policy, store, service, presentation, and composable modules own these boundaries.

The client stores display pages separately from the projection. Append does not change projection identity or initialize the draft again. Save and navigation invalidate page ownership, including late responses from transports ignoring cancellation. Failed pages retain displayed rows and offer an explicit retry. Full save responses refresh the first display page and preserve the complete saved draft arrays.

## Alternatives and final stack

| Approach | Pros | Cons |
| --- | --- | --- |
| Complete summary plus actor-scoped display pages (chosen) | Preserves replacement-save semantics and global correctness; bounds display enrichment | Initial global projection still computes the complete catalog |
| Page the override collections | Smaller initial payload | Save replaces entire collections and could erase off-page intent; rejected |
| Compute coverage and orphans from loaded cards | Easy local calculation | Incorrect global results; rejected |
| Introduce a persisted revisioned read model now | Can bound global reads later | Larger migration, invalidation, and consistency surface |

Final stack: existing session authorization and revision-checked saves, opt-in complete operator summary, bounded PostgreSQL catalog IDs, page-scoped actor enrichment, independent Vue display state, native Load more/Retry and status announcements. Keep the existing full computation until a separately verified global summary/read-model optimization is justified.

## Consistency and accessibility

Pages are live reads, not one frozen transaction snapshot. A later page can reflect a newer policy/catalog revision. Unsaved selection state always comes from the complete local draft, and expected snapshot revision remains authoritative when saving. UUID traversal avoids mutable date/title cursor keys; sorting, filtering, and bulk actions apply to loaded groups. Do not imply artist-wide chronological sorting or complete provider coverage.

Preserve native keyboard activation and button focus across loading, error, and terminal states. A persistent `role="status"` with `aria-atomic="true"` announces progress without moving focus. Empty first-page failures must expose Retry instead of a false empty-catalog conclusion. Local terminal copy describes the end of the current traversal, not a globally complete external discography.

Official URLs were discovered and opened through tools on September 12: [PostgreSQL 18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [W3C status technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22), and [WCAG status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages). These support the concurrency and accessibility decisions, not an assertion of whole-application conformance.

## PR review

GitHub MCP refreshed every open PR and complete patch. #40 head `649659f1e199d48d55cc8d5cccf9f079dc235d86` is an unrelated Node-major fixture upgrade. #24 head `40cf4d117b69bd55b9a0a7353361838216e1e952` and #23 head `ae651337286216e92be7ae977e39fcedc14de7f9` are superseded by newer local action pins. No applicable patch was applied or merged.

## Acceptance

Prove complete off-page draft preservation, unchanged global summary semantics, actor isolation in PostgreSQL, page-only enrichment, cursor validation, load-more draft stability, retry and keyboard focus, late-response suppression on save/navigation, and full-response compatibility. Record actual results and limitations in the separate outcome document.
