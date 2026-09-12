# Local artist display and saved-state outcome

## Delivered

Artist Detail now opts into an operator summary that retains complete saved monitoring, release-group selections, track overrides, coverage, overview, and revision state while omitting catalog arrays. Imported artists with local groups load actor-scoped display pages separately. Empty local catalogs retain the existing remote fallback; legacy full responses remain supported.

The new page service reuses the bounded catalog reader and hydrates only the current page's policy decisions, track-override summaries, and canonical or selected editions. A shared release presentation mapper preserves the legacy resolved-release shape. Page-local orphan results are never published or used for global calculations.

The Vue page composable owns cancellation, generation, cursor progression, row identity, retry, and disposal. Appending does not update projection identity or initialize drafts. Successful local saves invalidate pending pages, retain available saved rows during refresh, and restart the display page. A failed page keeps its rows and cursor; first-page failure exposes Retry. Local terminal wording describes the end of the current traversal rather than complete external discography.

## Validation

Client contract/lifecycle tests and the browser regression passed. The browser scenario verifies keyboard focus across failure/retry, duplicate activation suppression, draft preservation on append, bounded refresh after a full save response, and off-page selection/track-override preservation in two successive save payloads. Expected revisions advance with saved projections.

The real PostgreSQL integration test passed with two actors and distinct saved policy decisions. Page output matched each actor's full projection, including canonical and selected noncanonical editions. Off-page selections and overrides remained in the complete summary, and a query-string actor override did not change session ownership. The page path used six queries without invoking the full projection. Separate catalog tests establish the bounded ID/count-enrichment plan.

Initial broad validation encountered an existing 250 ms polling-test timeout, which passed in isolation. One browser setup timed out during overlapping build activity; its complete lifecycle file rerun passed all three scenarios with build files held steady. No unrelated production or timeout changes were made. Six browser scenarios passed across the final focused runs: two local display/edition scenarios, three mutation lifecycle scenarios, and one remote pagination scenario. The new dialog regression verifies that changing an edition on page two leaves the open dialog correctly marked after page reset. `npm run validate:security` passed with zero vulnerabilities. The final `npm run validate` rerun passed repository checks, lint, 3,453 server tests, 4,273 client tests, 500 script tests, all 144 integration tests, and both builds: 8,370 Node tests total. Integration had no failures or skips.

The walkthrough Docker image was rebuilt with existing data/configuration preserved. Image `sha256:999b15dc05ab8d68e6051362c5294d1f8916a255b97ae1a4cccfb3ac04208ea5` is healthy and `/healthz` returns 200. A live authenticated check of Lauren Daigle returned an operator summary with 41 global groups and no catalog array; operator pages returned 25 then 16 groups with actor state. An unauthenticated operator-page request returned 401. No catalog import or policy mutation was needed for this smoke check.

## Limits and recommendation

Loaded rows accumulate as pages are requested; this is progressive loading, not DOM virtualization. The initial global summary still computes the full authoritative projection on the server. This change reduces transferred and retained initial catalog data and bounds per-page enrichment and the initial render; it does not eliminate the global catalog query cost. Saved override collections remain complete and can themselves be large. Existing mutation responses still return full projections for compatibility before the client separates their catalog data.

Display pages are live reads and can reflect changes between requests. Expected revision protects saved intent; it does not make browsing a frozen snapshot. UUID catalog traversal is not chronological ordering, and filtering/sorting/bulk edits apply to loaded rows. Native status messages and buttons preserve focus without introducing a custom keyboard model. Review also caught a stale off-page dialog selection after manual edition save; accepted full mutation responses now refresh the retained open group before page reset.

Recommended stack: complete operator summary plus independent actor-scoped display pages and existing revision-checked saves. The benefit is preserving global correctness and off-page intent; the cost is retaining full global computation and separate page lifecycle state.

Next measure and separate global projection computation using compact catalog identities or a revisioned read model, proving coverage/orphan equivalence before removing the full read. Remote edition continuation remains another open part of review item 14.

See [design, alternatives, official sources, and PR review](LOCAL_ARTIST_DISPLAY_STATE_DESIGN.md). No applicable open PR patch was applied or merged.
