# External request discovery handoff design

Date: 2026-09-10
Status: Implemented; validation and limits are recorded in the outcome document

## Purpose and scope

Harmoniarr is a self-hosted, Soulseek-native music library manager. External URLs provide provider metadata; they do not provide downloaded music or a canonical local release selection. Previous work made preparation durable for every request target. This change connects completed provider album metadata to target-owned discovery through an explicit administrator review.

The administrator compares a prepared album leaf with an existing local metadata release, selects that release, and queues a search for the request's current target. Discovered candidates remain subject to import review. Approval does not download or import music, add a monitored artist, or guarantee fulfillment.

Tracks, videos, and containers are not automatically converted into album requests. A container may expose a completed album leaf that can be reviewed individually. This increment does not implement automatic cross-provider identity matching, remote catalog search, bulk approval, or shared acquisition delivery.

## Official research and decisions

The following official URLs were identified through web search or GitHub MCP and then read on September 10, 2026.

| Source | Finding and design consequence |
| --- | --- |
| [MusicBrainz release group](https://musicbrainz.org/doc/Release_Group) and [release](https://musicbrainz.org/doc/Release) | A release group represents the concept of an album; a release represents a particular edition. The review selects an existing local release and displays its date, country, and track count when available. Title similarity cannot establish edition identity. |
| [MusicBrainz search API](https://musicbrainz.org/doc/MusicBrainz_API/Search) | Artist, release-group, release, and recording identifiers belong to different entity domains. Provider identifiers must not be accepted as MusicBrainz identifiers. This increment searches the local catalog. A future remote search must escape literal Lucene input separately from URL encoding. |
| [Spotify album API](https://developer.spotify.com/documentation/web-api/reference/get-an-album) | Spotify exposes its own album identity, artist credits, release-date precision, external identifiers, and paginated tracks. These fields provide review evidence, not proof of a matching local edition. |
| [Apple album attributes](https://developer.apple.com/documentation/applemusicapi/albums/attributes-data.dictionary) | Apple exposes a localized title, primary artist name, date, track count, completeness, and UPC. Missing values remain unknown; the application must not manufacture matching evidence. |
| [YouTube video API](https://developers.google.com/youtube/v3/docs/videos/list) | Video snippets expose title and channel metadata. Treating a channel as a canonical music artist would be an application inference; videos remain outside automatic album approval. |
| [node-postgres transactions](https://node-postgres.com/features/transactions) and [PostgreSQL row locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Transaction statements must share a client. Lock the request, re-read current ownership/state, and commit the decision, audit, and durable operation together. Provider network work belongs outside this transaction. |
| [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Authorize each specific object and action on every request. Administrator UI visibility supplements server-side checks; the server validates request, provider leaf, selected release, and current target. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | A non-idempotent request must not be retried automatically without a safe operation contract. Exact repeated approval reuses its recorded intent; a conflicting selection returns a conflict. This does not make all application POST requests idempotent. |
| [W3C grouped controls](https://www.w3.org/WAI/tutorials/forms/grouping/) and [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Use labelled native controls, group related selection fields, and announce search/save status without moving focus. Keep failed selections available for correction. This is focused accessibility work, not a claim of complete WCAG conformance. |
| [Node.js release schedule](https://nodejs.org/en/about/previous-releases) | Node 24 remains LTS while Node 26 is Current. Retain the established Node 24 ESM platform. |

## Alternatives and tradeoffs

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Automatically accept the highest title/artist match | Fewer operator steps | Wrong editions and ambiguous artists can silently enter acquisition | Defer until an independently validated matching policy exists |
| Explicit review against the local release catalog | Bounded behavior, visible evidence, durable operator decision | Requires existing catalog metadata and a review step | Adopt |
| Reuse the existing durable operation queue | Existing worker, lease, cancellation, and observability mechanisms | Requires passing target ownership through every discovery boundary | Adopt |
| Introduce another queue or generic outbox | Could generalize future delivery workflows | Adds operational and recovery complexity without a current requirement | Defer |
| Short transaction with request-row serialization | Atomic intent creation and safe concurrent approval/recovery | Competing actions briefly wait; lock ordering matters | Adopt |
| Sweep historical requests automatically | Repairs many requests without operator effort | Can start unexpected provider work and revive stale intent | Use explicit per-request recovery instead |

## Recommended stack and module boundaries

Keep Node 24, ESM JavaScript, Express route adapters, PostgreSQL stores, and the existing operation-run queue. Place provider evidence projection, review policy, transactional approval/recovery, persistence, and discovery execution in narrow modules. The Vue view delegates review behavior to a focused component and composable, with an API adapter for transport and CSRF.

Use the existing default transaction isolation with an explicit lock on the request. Do not add network calls under that lock or change isolation globally. The durable selection records the request, selected local release, target, acting administrator, and stable provider provenance. Deduplication is per request/release with provider provenance retained, and each target receives a distinct search. An exact repeated decision returns the existing intent; an incompatible repeated decision returns HTTP 409.

The existing release-global discovery row cannot carry every recipient: it chooses one request per release, while candidate placement expects one owner. This increment uses durable `library_external_request_release_intents` and a new operation type in the existing queue. It does not insert reviewed requests into that release-global deduplication path. This costs a separate search per target while retaining correct candidate identity and placement.

Provider approval is distinct from source-file review. Candidates carry their intent ID and are excluded from automatic selection and automatic recovery. Failed or empty searches permit an explicit retry from Background Jobs; each approval or manual retry allows one search attempt. Request, user eligibility, cancellation, and maintenance checks use the same transaction client at final candidate persistence, avoiding pool starvation. Request cancellation or reassignment cannot publish candidates after the final locked guard has observed the change.

An imported album does not complete other approved albums. Collection requests remain under review even when all currently approved albums have been imported, because complete pagination and explicit inclusion/exclusion are not yet represented. A direct album request can become fulfilled when its approved target-owned album is imported. Reassigning a request does not retarget an existing intent; the UI identifies previous-target approvals and directs the administrator to create a separate request for the new target.

Accepted intents retain the target recorded at approval. Reassigning the surrounding request must not transfer already approved work. The review identifies previous-target intents, suppresses another approval form for the same provider identity, and directs the administrator to create a separate request for the new target.

## Review and recovery contract

The administrator-only review panel is available on external requests that still need fetching. It shows prepared items, accepted intents, and preparation recovery availability. Release choices are never preselected. Search results identify the local release title, artist, date, country, and track count where present. The primary action names the target: `Search this release for <target>`.

The backend exposes:

- `GET /api/v1/library/media-requests/:id/external-review`: prepared items, accepted intents, and recovery state.
- `GET /api/v1/library/media-requests/:id/external-review/releases`: bounded local catalog search by artist name and release title.
- `POST /api/v1/library/media-requests/:id/external-review/approve`: explicit provider-ingest-row and metadata-release identifiers.
- `POST /api/v1/library/media-requests/:id/external-review/recover`: explicit recovery of this request's missing preparation work.

Approval validates current request state and target eligibility, membership of the provider leaf in the request, completed album metadata, and the selected local release. The server derives provider provenance and ownership from persisted state, not client-supplied names or target identifiers. Mutations preserve session, CSRF, maintenance-lock, and audit requirements.

Both writes require a fresh administrator session and the existing administrator mutation limiter. CSRF enforcement follows the configured deployment policy; the integration suite explicitly enables and proves required CSRF mode. The secure deployment recommendation is to keep CSRF protection enabled.

Historical recovery queues planning when no provider rows exist, or execution when pending or failed provider rows exist. Existing active work is reused. Recovery never performs an automatic sweep and does not treat a completed or cancelled request as new intent. The UI refreshes after approval or recovery, preserves selections after errors, and discards results arriving for an obsolete request or search.

## Validation design

Focused service and PostgreSQL tests must prove authorization, current ownership, album-leaf eligibility, source provenance, exact-repeat reuse, conflicting approval, concurrent approval/recovery, transaction rollback, and durable queue writes. Discovery tests must show distinct target-owned searches and candidates remaining pending import review. Client tests must prove transport/CSRF, explicit selection, draft preservation, obsolete-response protection, and refresh behavior. Browser validation covers native form interaction and status/error feedback at desktop and mobile sizes.

## Open pull request assessment

GitHub MCP refreshed all open PRs and read their full patches on September 10, 2026. None applies to this work; no PR is merged or changed.

| PR | Inspected head | Disposition |
| --- | --- | --- |
| [#24: build-push action](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposes 7.2.0; local main already uses 7.3.0. Superseded. |
| [#23: metadata action](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposes 6.1.0; local main already uses 6.2.0. Superseded. |
| [#40: fixture Node major](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Changes only the controlled-provider fixture from Node 24.19 to 26.7. Retain the established LTS major rather than diverging from production. |

## Outcome document

Implementation details, actual validation, residual limits, and the next release item belong in the separate `EXTERNAL_REQUEST_DISCOVERY_HANDOFF_OUTCOME.md` document after the implementation is verified.
