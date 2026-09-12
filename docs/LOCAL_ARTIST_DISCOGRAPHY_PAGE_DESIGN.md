# Local artist discography page design

Reviewed September 12, 2026. This is the database-read foundation for artist review item 14, following the identity-summary optimization.

## Decision and release boundary

Introduce a separate authenticated `GET /api/v1/metadata/artists/:artistId/discography` read. It returns at most 25 local release groups with edition counts and a continuation cursor. It is catalog data, not an operator policy or save projection. The existing editor continues to use its complete projection until global reads and display state are separated.

That boundary is necessary: artist saves replace complete selection and track-override collections. The effective-state builder also detects orphans against the entire catalog, while coverage and overview require global data. Substituting a page for that input would discard unseen draft intent or report false orphans. This change deliberately establishes and measures the bounded read before migrating the editor; it does not claim a current page-load improvement.

## Contract and architecture

Final stack: session-gated route → ESM service factory → strict page policy → PostgreSQL store → shared release-group presentation mapper. The old full read uses the same mapper without changing its response.

The optional `limit` defaults to 25 and accepts integers from 1 through 25. The versioned base64url cursor binds the artist UUID and the last release-group UUID. Unsupported versions, malformed or structured values, extra fields, oversized cursors, and cross-artist cursors fail before database access. The cursor is a traversal position, not an authorization token; all requests still pass the existing session gate. SQL values remain parameterized, and the existing API caching policy applies.

The store materializes at most `limit + 1` candidate IDs in UUID order, then materializes at most `limit` page IDs before counting editions. The extra ID proves continuation without counting its editions. The response exposes `releaseGroups` and `pageInfo: { hasMore, nextCursor }`; it does not fabricate global totals, operator state, or complete edition arrays. Existing empty artists return an empty page, and missing artists return 404.

UUID order is a stable catalog traversal order, not a chronological or alphabetical display order. Updating titles/dates does not move a row across a cursor. Deleting the boundary row does not invalidate continuation. Each page observes its own PostgreSQL statement snapshot: concurrent inserts before the cursor require a new traversal, while later IDs may appear in continuation. This is not a frozen catalog snapshot. Artist existence is checked separately; concurrent deletion can yield an empty page after that check.

## Alternatives

| Approach | Pros | Cons |
| --- | --- | --- |
| Separate ID-keyset page before edition counts (chosen) | Bounds returned groups and count enrichment; small compatibility surface | Requires a later editor/global-read migration; ID order has no musical meaning |
| Slice the full operator response | Can reduce transfer and rendering now | Still assembles the whole catalog; does not establish a bounded database read |
| Limit the authoritative projection's inputs | Superficially smaller work | Incorrect coverage, orphan detection, and potentially destructive saves; rejected |
| Offset pagination | Familiar numbered pages | Deep offsets still process skipped rows and shift under insert/delete |
| Date/title keyset | More useful browsing order | Mutable and nullable keys require a wider cursor and explicit movement semantics |

No new index or migration is assumed necessary. Measure the actual plan first. The candidate query may scan or sort additional group rows with existing indexes; the hard guarantee is bounded IDs and bounded groups receiving edition-count enrichment, not constant database time or bounded editions within one group.

## Official research and W3C model

Tool-discovered official sources were opened on September 12, 2026. [PostgreSQL 18 LIMIT/OFFSET](https://www.postgresql.org/docs/18/queries-limit.html) requires predictable ordering and explains skipped-offset work. [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html) supports inspecting actual rows, loops, and buffers rather than inferring performance from response length.

For the subsequent editor integration, retain a native Load more button with keyboard activation and stable focus. Use a persistent status region for loaded counts, and describe loaded-only filter/bulk scope accurately. [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [W3C status-message technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22), and [W3C pagination component](https://design-system.w3.org/components/pagination.html) support those choices. Named pagination navigation and `aria-current="page"` are appropriate only if actual page links are introduced. No UI or focus behavior changes in this foundation.

## PR review

GitHub MCP refreshed all three open PRs and their complete patches. [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40), head `649659f1e199d48d55cc8d5cccf9f079dc235d86`, is an unrelated Node-major fixture upgrade. [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24), head `40cf4d117b69bd55b9a0a7353361838216e1e952`, and [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23), head `ae651337286216e92be7ae977e39fcedc14de7f9`, are superseded by newer local action pins. No applicable patch was applied or merged.

## Acceptance and next step

Verify all-page traversal, equal titles/dates, edition counts, deletion of cursor boundaries, artist isolation, input rejection, missing/empty artists, session gating, and actual count-subplan loops against real PostgreSQL. Preserve the old full projection contract. Record fixture size, plan evidence, payload size, validation, and limitations separately in the outcome document.

Next: separate complete operator draft/global summaries from display rows, then integrate this page stream without replacing projection or draft identity on append. Preserve off-page selections, conflict handling, modal identity, and global coverage. Decide the desired browse order before exposing ID traversal as the editor's order.
