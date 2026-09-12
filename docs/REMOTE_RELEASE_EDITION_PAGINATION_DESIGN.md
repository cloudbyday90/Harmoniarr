# Remote release edition pagination

Design reviewed September 12, 2026. Artist Detail presents release groups and their editions; choosing an edition must preserve that exact MusicBrainz release identity while the operator reviews it. A remote release group currently exposes only the first 25 editions. Continuing that list must not change the selected edition, discard loaded choices, or turn an incomplete provider response into a claim that the catalog is complete.

## Contract and boundaries

Reuse the authenticated MusicBrainz release-group releases route with an explicit page limit of 25 and an offset. The client advances by the number of raw rows received, deduplicates displayed editions by release MBID, and keeps the selected edition separate from the traversal position. A short page does not prove completion. A malformed page or missing/invalid total retains prior choices and presents a retry without advancing the cursor or claiming completion. Provider totals describe a live catalog, not an immutable snapshot.

Remote tracklist fallback adds `editionPage: { releaseGroupId, limit, offset, total }`. `allReleases` remains exactly the first browse page; a directly looked-up selected edition is returned as `release` without increasing the page's raw count. Unknown total is `null`, never an invented zero. Local tracklist responses retain their complete local arrays and current shape.

If a preferred release MBID is absent from the first provider page, the catalog service performs one release lookup through the existing MusicBrainz client and provider-health boundary. The lookup validates UUID inputs before creating the provider path and verifies both the returned release identity and its release-group identity. Foreign membership fails with 404; malformed provider identity fails with 502. If a background import has created a partial local group that omits the chosen remote release, the same remote path honors that choice rather than silently showing the local canonical edition. Existing import behavior and explicit mutation authorization remain outside this change.

The paged client uses a separate ESM composable with one active load, cancellation and a generation check. Closing the dialog or changing release group invalidates outstanding work; switching editions preserves the current page list. A native load-more/retry button retains focus and has guarded unavailable states. Visible loading/count/error feedback uses appropriate status semantics without moving focus or announcing every option.

## Official sources and tradeoffs

URLs below were discovered through web search or official links and opened for this review.

| Source | Implication |
| --- | --- |
| [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) | Browse releases by release-group MBID. The provider permits up to 100 rows, but its 500-track response cap can shorten a page. Advance by actual returned rows. Harmoniarr retains its existing maximum of 25 per request. |
| [MusicBrainz release-group model](https://musicbrainz.org/doc/Release_Group) | An edition is a release belonging to a release group; direct lookup must verify that relationship. |
| [Vue watcher cleanup](https://vuejs.org/guide/essentials/watchers.html) | Register cleanup synchronously and cancel invalidated requests. A generation check also protects publication after cancellation or context changes. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Programmatically identify visible progress and result messages, with enough context to understand changing counts. |
| [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | Support Enter and Space, accessible names, and stable focus when activation retains the current context. |

Explicit pagination bounds each request and lets the user decide when to fetch more; it requires extra activations for large groups. Fetching every edition automatically would simplify a complete in-memory list, but increases provider traffic, latency, and race exposure. A direct selected-edition lookup adds at most one logical provider request to the fallback and avoids scanning every intervening page; strict membership checks can reject stale or inconsistent provider identities instead of guessing.

The recommended stack is the existing authenticated route and shared provider client, a small lookup validation policy, the current tracklist service, an isolated page-state composable, and the existing native edition picker with explicit continuation. No new global singleton, acquisition operation, or mutation endpoint is needed.

## Open PR disposition

GitHub MCP returned three open PRs. Metadata and complete all-file patches were reviewed at these immutable heads; none is applicable to edition pagination, and none was merged or applied.

| PR | Head | Disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Unrelated controlled-provider fixture Node 24 to 26 major update. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposed build-push action 7.2 is superseded by local 7.3. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposed metadata action 6.1 is superseded by local 6.2. |

Validation covers provider short pages, exact off-page identity, foreign/malformed membership, partial local imports, additive route projection, stale loads, retries, deduplication, and keyboard focus. Actual validation results belong in the implementation outcome after execution.
