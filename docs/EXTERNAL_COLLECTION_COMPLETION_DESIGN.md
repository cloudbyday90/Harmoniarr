# External collection preparation and reviewed completion

Research and design date: September 11, 2026. This document extends [External request discovery handoff](EXTERNAL_REQUEST_DISCOVERY_HANDOFF_DESIGN.md).

## Purpose and completion boundary

Harmoniarr manages target-owned music acquisition through Soulseek discovery and explicit import review. Preparing a provider playlist or artist catalog must not make a request look complete after only its first page. Provider metadata describes a captured enumeration; it is not a guarantee that a live playlist remains unchanged.

The release scope is bounded collection preparation followed by a **reviewed collection selection**. Spotify and Apple Music artist collections enumerate albums. Playlist preparation expands supported album references within the same bounds; it does not implicitly start artist discovery. Every captured leaf must be included through an explicit local release edition decision or excluded with a recorded reason. Unsupported entries remain visible for exclusion. Several leaves can share one accepted release intent.

Preparation is bounded to 50 container pages and 1,000 distinct leaves. Each explicit execution processes at most 10 work rows. These are Harmoniarr limits, not provider API limits. The existing recovery action queues the next batch; there is no hidden automatic continuation queue. Invalid or repeated continuations, exceeded limits and detected Spotify version changes block completion. Access and transport failures remain failed and retryable. A valid empty terminal page is enumeration evidence, but an entirely excluded or empty collection cannot be finalized as an acquisition request.

## Verified provider contracts

All URLs below were discovered through search or official documentation links and then opened. The facts reflect the documentation available on the research date.

| Provider | Verified behavior | Design consequence |
| --- | --- | --- |
| Spotify playlists | The current items endpoint returns paginated `items`, nullable `next`, `offset` and `total`; the current page maximum is 50. Current entry payloads use `item`, with legacy `track` compatibility. No maximum playlist offset is stated in this reference. | Use endpoint-specific limits, count raw entries independently of deduplicated resources, and validate continuations. |
| Spotify versions | Playlist metadata exposes `snapshot_id`; playlist changes create new snapshots. The documentation does not specify snapshot-pinned paged reads. | Compare versions before and after traversal. A detected change blocks the captured selection; never claim immutable live-provider consistency. |
| Spotify quota modes | February 2026 playlist endpoint and ownership changes apply to Development Mode; Extended Quota Mode is explicitly unaffected by that migration. Current Development Mode playlist contents require ownership or collaboration. Artist albums currently have a maximum page size of 10. July 2026 Development Mode quotas are shared per developer account. | Preserve appropriate legacy envelope compatibility, do not interpret inaccessible/missing contents as an empty collection, and retain throttling. |
| Apple Music | Resource relationships can contain identifiers without full attributes. Each relationship can have its own `next` relative subpath. Follow returned continuations until absent; an included relationship is not necessarily complete. | Traverse the playlist tracks or artist albums relationship explicitly. Keep storefront and expected collection path fixed; do not calculate offsets from prepared leaf counts. No stable read snapshot is promised by the reviewed documentation. |
| YouTube | Playlist items have a page maximum of 50 and opaque `nextPageToken`. A playlist-item ID identifies a membership occurrence, separately from its video ID. Inaccessible playlists can return explicit access errors. | Track membership identity separately from canonical resource identity. Preserve unavailable/unsupported entries where returned; permission failure never means an empty complete playlist. No stable multi-page read snapshot is promised. |

Sources: [Spotify playlist items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items), [Spotify playlist versions](https://developer.spotify.com/documentation/web-api/concepts/playlists), [February 2026 migration](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [Spotify artist albums](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums), [July 2026 changes](https://developer.spotify.com/documentation/web-api/references/changes/july-2026), [Apple pagination](https://developer.apple.com/documentation/applemusicapi/fetching-resources-by-page?changes=_7&language=objc), [Apple relationships](https://developer.apple.com/documentation/applemusicapi/handling-resource-representation-and-relationships), [Apple playlist relationship endpoint](https://developer.apple.com/documentation/applemusicapi/fetch-a-relationship-on-this-resource-by-name-707nb), [Apple artist relationship endpoint](https://developer.apple.com/documentation/applemusicapi/fetch-a-relationship-on-this-resource-by-name-5akdm), [YouTube playlist item listing](https://developers.google.com/youtube/v3/docs/playlistItems/list), [YouTube playlist item identity](https://developers.google.com/youtube/v3/docs/playlistItems).

## Durable and secure execution

Persist page children and their checkpoint atomically. Stable input keys and database uniqueness prevent duplicate durable work. Fetch provider pages outside the transaction; validate the expected checkpoint under a lock before committing the page. Use one PostgreSQL client for the transaction. PostgreSQL supports atomic conflict handling and unique constraints; nullable key components need particular care because null values are distinct by default. These mechanisms support the recommended checkpoint design rather than guaranteeing provider snapshot consistency. Sources: [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html), [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html), [PostgreSQL row locking](https://www.postgresql.org/docs/18/sql-select.html), [node-postgres transactions](https://node-postgres.com/features/transactions).

Provider continuation data must not become an arbitrary authenticated fetch destination. Keep fixed provider origins and collection paths, reject unexpected schemes/hosts/paths, and use the existing provider transport. Treat YouTube tokens as bounded opaque values. Do not reveal credentials or raw continuation data in review UI. This follows the destination allowlisting and redirect guidance in the [OWASP SSRF prevention cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

All mutations remain administrator-only, session/CSRF protected and object-authorized on the server. Revision checks reject stale decisions. Finalization requires full traversal, all captured leaves decided, at least one inclusion and an active matching request target. Finalized decisions are immutable. Actual fulfillment additionally requires every distinct included release intent to be applied; provider preparation or search completion alone cannot fulfill the request. Existing accepted work keeps its original target.

Transactional write guards take a shared table lock on `maintenance_locks` before domain row locks, then read active maintenance state on that client. This permits concurrent guarded writes while serializing maintenance acquisition or changes with their commit. The mode conflicts with the table lock automatically taken by maintenance INSERT/UPDATE/DELETE, and remains held until transaction end. Consistent ordering avoids lock-order cycles. This follows the modes and ordering described in [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html), discovered and opened September 11. Nontransactional status reads remain unlocked; this fence does not retroactively make unrelated multi-step operations atomic.

The captured Spotify artist scope uses the provider’s `album,single` groups. It does not promise compilations or appearances in other artists’ releases. Apple song album relationships that expose an unconsumed continuation block preparation until supported, rather than silently accepting only part of that relationship.

## Review interface and API

The existing external review endpoint adds a bounded cursor page and collection summary. Review pages show included, excluded and pending leaves; unsupported rows expose the reason-required exclusion form. Native labeled controls provide local edition selection and explicit action buttons. Previous/Next buttons page the captured items. Persistent status and alert regions announce results and errors without moving focus unnecessarily. Failed mutations retain edition and exclusion drafts. Successful mutations refresh the summary and return to the first page.

`GET /api/v1/library/media-requests/:id/external-review?cursor=<uuid>&limit=25` returns existing items/intents/preparation plus `collection` and `pagination`. The summary includes status, revision, pages completed, source entries seen, leaf/included/excluded/pending counts, finalization/restart capabilities, blocking reason and target match. Returned intents are bounded to the current page. Tracked items include `collectionItemId`, `decision`, `exclusionReason`, `itemKind` and `releaseIntentId`.

Explicit protected actions:

- `POST .../collection/start { restart }` initializes an older untracked collection or restarts when offered by the server.
- Existing `POST .../recover {}` queues the next preparation batch.
- Existing `POST .../approve` additionally requires `expectedRevision` for tracked collection leaves.
- `POST .../collection/items/:collectionItemId/exclude { reason, expectedRevision }` records an exclusion.
- `POST .../collection/finalize { expectedRevision }` seals the reviewed collection selection.

The UI displays captured progress, remaining decisions, preparation failures and target mismatch explicitly. It describes the result as a reviewed collection selection, not a current complete copy of a live playlist. Applicable accessibility guidance: [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), [WAI button interaction](https://www.w3.org/WAI/ARIA/apg/patterns/button/), and the [W3C pagination example](https://design-system.w3.org/components/pagination.html). The design-system example is illustrative; native mutation buttons are appropriate for fetching review pages within the current view.

## Alternatives and recommendation stack

| Choice | Advantages | Costs and limitations |
| --- | --- | --- |
| Bounded durable batches with explicit continuation — recommended | Recoverable progress, controlled provider load, visible operator boundary, truthful incomplete state. | More state and explicit continuation actions for large collections. |
| Fetch every page in one unbounded job | Simpler happy-path interaction. | Unbounded work, costly retries, rate pressure and weak cancellation/recovery boundaries. |
| Treat the first page as complete | Small implementation. | Silently omits media and can falsely fulfill requests; unsuitable for release. |
| Automatically accept fuzzy album matches | Less manual review. | Provider titles do not establish edition identity or acquisition intent; unsafe for this release scope. |
| Claim immutable provider snapshot | Attractive completion language. | Unsupported for Apple/YouTube traversal and not established by Spotify offset reads. |

Final stack: modular ESM provider clients and page normalization; existing throttled transport and operation queue; PostgreSQL collection/checkpoint/item stores; revision-checked administrator review services; Vue composables and small native-control components; focused provider, transactional, authorization, client-state and browser tests. Retain manual import review after discovery.

## Open pull requests

GitHub MCP refreshed all three open PRs and fetched their complete patches and immutable heads on September 11, 2026. None supplies an applicable local change for this item, and none was merged or applied.

| PR | Immutable head | Disposition |
| --- | --- | --- |
| [#40 Node fixture update](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Changes the controlled-provider fixture from Node 24.19.0 to 26.7.0. Diverges from the retained Node 24 platform baseline. |
| [#24 build-push action](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Offers 7.2.0; local workflow already pins 7.3.0. |
| [#23 metadata action](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Offers 6.1.0; local workflow already pins 6.2.0. |

## Validation and outcome

The client implementation splits collection controls and item review into focused Vue components. The existing review composable owns cursor history, editable drafts and revision-checked mutations; the API module uses protected POST requests. Failed decisions retain drafts and page context, while successful decisions reset to the first review page. Included and excluded leaves remain visible, and finalization stays unavailable until the server offers it.

Client validation completed on September 11, 2026:

- `node --test test/client/external-request-review-api.test.js test/client/useExternalRequestReview.test.js test/client/useExternalRequestCollectionReview.test.js`: 23 passed.
- `npm run lint:client` and focused ESLint over the changed client/browser tests: passed.
- `npm run build:client`: passed.
- `node --test --test-concurrency=1 test/browser/external-request-review.test.js test/browser/external-request-collection-review.test.js`: five passed, zero skipped. This exercises keyboard pagination, explicit inclusion/exclusion, stale revision draft retention, finalization, explicit legacy preparation/batch/restart and the existing single-album/previous-target flows.
- Browser screenshots were inspected at 390px light and 768px dark; automated checks also covered 1280px light. Captured panels fit their widths, and mobile action controls meet the 44px size check.

The browser scenarios use controlled API responses to verify interaction contracts; they do not establish live provider correctness. Backend validation separately covers multi-page traversal and duplicates, invalid/cyclic continuations, bounded stops, atomic retry/checkpoint behavior, object authorization, target preservation, complete decision coverage and fulfillment gating. Final evidence, the five prioritized follow-ups, and implementation limits are recorded in [External collection outcome](EXTERNAL_COLLECTION_COMPLETION_OUTCOME.md): all 7,951 Node tests, five browser scenarios, both builds, schema bootstrap, and security checks passed.
