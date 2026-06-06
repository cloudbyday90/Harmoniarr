# Request Transfer Progress Read Model Design

> Phase 13 of the request-experience hardening track. This document covers the
> requester-safe transfer-progress read model and its persisted-snapshot source.
> Phase 14 renders the APG progress bar from this projection in
> `REQUEST_DOWNLOADING_PROGRESS_BAR_DESIGN.md`.

## Problem

Phase 12 introduced a single request journey:

`Requested -> Finding sources -> Downloading -> Importing -> In your library`

The Downloading stage can identify that work is active, but the request pipeline
response does not include quantitative progress. Harmoniarr already computes
`liveTransferSummary.percentComplete` for the operator execution workflow, but
that model is unsuitable for direct requester use:

1. It is global rather than scoped to one media request.
2. It performs a live slskd transfer reconciliation.
3. It includes peer usernames, filenames, paths, byte counts, exception text,
   and internal planning state that requesters do not need.
4. The media-request pipeline endpoint previously authenticated callers without
   authorizing access to the requested media-request ID.

The goal is to expose only the persisted progress needed by a future request
journey progress bar, without querying slskd on the request path or returning
the internal execution snapshot.

## Research Baseline

Research was performed against official primary sources available through
May 31, 2026. URLs were discovered and verified through online search rather
than inferred.

### Query-side projections

Microsoft's
[CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
describes queries as read-only operations that return DTOs shaped for the
presentation layer. It also identifies separate read models in a shared data
store as the foundational CQRS level, without requiring separate databases or
event sourcing.

Applied here:

- Keep execution reconciliation and persistence as the write-side concern.
- Build a request-specific DTO from already-persisted state.
- Do not add command behavior, slskd calls, or reconciliation policy to the
  request read service.

### Persisted observations

Microsoft's
[Materialized View pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/materialized-view)
recommends query-specific views for data that is difficult or expensive to
query directly, including DTOs for UI display and restricted subsets of source
data. It also requires an explicit consistency trade-off because scheduled
views can lag behind their source.

Applied here:

- Reuse `planning_snapshot.execution.latestTransferSnapshot`, which the
  reconciliation heartbeat already persists.
- Include `observedAt` so consumers can distinguish observation time from
  response time.
- Call this persisted or observed progress in engineering documentation, not
  guaranteed real-time progress.

### JSON extraction and missing data

The
[PostgreSQL JSON functions and operators documentation](https://www.postgresql.org/docs/current/functions-json.html)
states that path extraction returns SQL `NULL` when the requested JSON
structure is absent rather than failing. This supports backward-compatible
reads across execution items created before transfer snapshots existed.

Applied here:

- Missing `execution`, `latestTransferSnapshot`, `summary`, or progress fields
  resolve to `null`.
- No migration or backfill is required.
- Normalization still occurs in JavaScript so the public DTO has one explicit,
  tested contract.

### HTTP representation semantics

[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) defines a successful GET
response as a representation of the target resource as observed when the
message originates. A stored external-system observation can be older than the
HTTP response itself.

Applied here:

- The pipeline response is the current Harmoniarr representation.
- `transferProgress.observedAt` records when Harmoniarr last reconciled the
  external transfer observation.
- The response does not imply that slskd was contacted for the GET request.

### API authorization and property minimization

OWASP
[API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
requires authorization checks for every endpoint that accepts an object ID.

OWASP
[API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
recommends explicitly selecting response properties and keeping returned data
to the minimum required by the endpoint.

Applied here:

- Administrators can read any request.
- The requesting user and requested-for user can read their request.
- Other authenticated users receive the same `404 media_request_not_found`
  response as a nonexistent ID.
- The response is allowlisted to `status`, `percentComplete`, and `observedAt`.
- Planning-snapshot fields such as transfer IDs, filenames, internal paths,
  exceptions, messages, and byte totals never enter the transfer-progress
  projection.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A - Fetch the global execution summary from the client** | Reuses an existing endpoint and live calculation | Overfetches operator data; difficult request-to-item correlation; increases property exposure; requester page depends on a global diagnostic model |
| **B - Query slskd from the request pipeline GET** | Freshest available percentage | Adds external latency and failure coupling to a frequent poll; duplicates reconciliation work; creates resource-consumption and availability risk |
| **C - Return the complete persisted execution snapshot** | Minimal backend transformation | Exposes internal paths, peer identities, filenames, execution plans, and future fields by default |
| **D - Project a minimal DTO from the persisted snapshot (chosen)** | Request-scoped; no external call; bounded response; explicit observation time; backward-compatible; independently testable | Eventually consistent; requires projection and authorization code; progress can be absent before the first reconciliation |

## Final Recommendation Stack

1. **Shared object-read authorization**
   - Centralize media-request read policy in a pure module.
   - Resolve the media request before detail, events, or pipeline data is read.
   - Return indistinguishable not-found responses for missing and unauthorized
     objects.

2. **Store/service separation**
   - Keep SQL and database row mapping in
     `library-media-request-pipeline-store.js`.
   - Keep authorization and public response shaping in
     `library-media-request-pipeline-service.js`.

3. **Persisted snapshot source**
   - Read only the newest execution run item selected by the existing
     descending run-start ordering.
   - Use `execution.latestTransferSnapshot.summary` rather than contacting
     slskd.

4. **Allowlisted public projection**
   - Return:

     ```json
     {
       "transferProgress": {
         "status": "active",
         "percentComplete": 42,
         "observedAt": "2026-05-31T12:01:02.000Z"
       }
     }
     ```

   - `percentComplete` is an integer clamped to `0..100`, or `null` when
     indeterminate.
   - `status` is restricted to `queued`, `active`, `completed`, `failed`, or
     `rejected`.
   - `observedAt` is a normalized ISO timestamp or `null`.
   - `transferProgress` is `null` when no useful persisted observation exists.

5. **No schema migration**
   - The required observation already exists in the execution item's JSONB
     planning snapshot.
   - Older rows degrade to `null` through tolerant extraction.

6. **Explicit eventual consistency**
   - The reconciliation heartbeat defaults to 60 seconds.
   - The request pipeline polls every 15 seconds while candidates are active.
   - The UI must treat `observedAt` as the source timestamp and must not call
     this value real-time.

## Security

- All three media-request ID reads used by the request detail workflow now
  enforce object-level authorization: detail, events, and pipeline.
- The authorization policy accepts only an authenticated actor ID and permits
  administrators, the requesting user, or the requested-for user.
- Unauthorized and nonexistent request IDs have the same response status,
  error code, and message to reduce object enumeration signals.
- The pipeline service authorizes before querying candidate or execution data.
- Internal JSONB is never spread into the response. The service constructs the
  transfer DTO field by field and reconstructs the execution DTO without its
  `planningSnapshot`.
- Phase 16 narrows the broader candidate contract for requester sessions in
  `REQUESTER_SAFE_CANDIDATE_LABELS_DESIGN.md`: requesters receive generic
  `Source N` labels and minimal run state, while admin/operator sessions retain
  peer/folder diagnostics.
- The endpoint remains read-only and session-protected. No CSRF requirement is
  added because GET does not mutate state.
- The request path makes no outbound call, preventing a polling client from
  amplifying slskd traffic.

## Files

| File | Role |
| --- | --- |
| `src/server/library/library-media-request-access-policy.js` | Pure request-read authorization policy. |
| `src/server/library/library-media-request-transfer-progress.js` | Pure, allowlisted persisted-snapshot projection. |
| `src/server/library/library-media-request-pipeline-store.js` | Candidate and newest run-item persistence reads. |
| `src/server/library/library-media-request-pipeline-service.js` | Authorization and public pipeline DTO composition. |
| `src/server/library/library-media-request-service.js` | Shared readable-request resolver for detail and events. |
| `src/server/routes/library-routes.js` | Passes authenticated actor identity into request-ID reads. |
| `test/server/library-media-request-*.test.js` | Policy, projection, store, service, and access coverage. |

## Outcome

The request pipeline can now return requester-safe persisted transfer progress
without a live slskd request. The read path has an explicit store/service
boundary, and the request detail workflow closes its prior object-level
authorization gap.

Real PostgreSQL validation also exposed and corrected an existing pipeline query
type mismatch: UUID candidate IDs were compared against `text[]`. Both execution
and apply lookups now use `ANY($1::uuid[])`, allowing the pipeline endpoint to
load run items instead of failing once a linked candidate had execution data.

The frontend journey now renders this data through the Phase 14 Downloading
progressbar design. That phase remains intentionally separate from this backend
read model so progress aggregation and APG semantics are tested without
coupling them to server projection code.

## Validation

- Focused request read-model and route tests.
- Real PostgreSQL coverage for persisted JSONB projection, response
  minimization, UUID run-item lookup, and unauthorized request hiding.
- Server and test lint.
- Full `npm test`.
- Full `npm run build`.
- Copyright header validation.

## Future Design Areas

1. **Requester-scoped transfer actions.** Design cancel, retry, and re-queue
   capabilities with per-request authorization, idempotency, audit events,
   rate limits, and explicit eligibility rules instead of exposing operator
   execution controls.
2. **Importing-stage explanation and quarantine visibility.** Replace the
   single Importing label with safe reasons such as validation, match review,
   tag reconciliation, and a future staging scan/clean/quarantine gate without
   exposing filesystem paths or internal exception details.
3. **Requester-safe preview and apply-preview contracts.** Decide whether
   import-candidate preview endpoints should stay admin-only or expose separate
   requester-safe projections without staging paths, collision paths, or file
   names.
4. **Retry-aware transfer progress.** Distinguish stale progress caused by a
   paused or abandoned candidate from active retry progress on a replacement
   candidate.

## Phase 17 Update

`REQUESTER_SAFE_IMPORT_CANDIDATE_DETAIL_CONTRACT_DESIGN.md` completes the
requester-safe import-candidate list/detail read contract. Owned non-admin
candidate reads now return minimal `Source` summaries and no longer expose raw
candidate diagnostics.
