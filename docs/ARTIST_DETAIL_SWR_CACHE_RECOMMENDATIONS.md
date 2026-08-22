# Artist Detail SWR Cache Recommendations

Status: Implemented and validated
Date: 2026-08-22
Owner: Metadata architecture + web platform

## Purpose

Artist Detail currently combines local metadata, a MusicBrainz release-group
browse, related-artist enrichment, and locally cached artwork. The first two
remote metadata reads do not share one durable stale-while-revalidate (SWR)
policy: discography results are not cached and related artists are cached only
in process memory after the whole enrichment chain completes.

This document records the research, alternatives, security constraints, and
recommended stack for making Artist Detail responsive without making it
silently incorrect.

## Current Findings

- `musicbrainz-catalog-service.js` calls MusicBrainz for every discography
  browse request.
- `similar-artists-service.js` has a process-local TTL map. It is lost on
  restart and does not protect concurrent cold requests.
- `metadata_provider_snapshots` is append-only provenance for normalized
  imports. It has no unique cache identity, freshness read, or one-row UPSERT;
  using it as an application cache would turn a diagnostic history table into
  a hot query path.
- Artist Detail waits for the related-artists request before clearing its page
  loading state. A slow fallback therefore delays the already-independent
  discography.
- Artwork is already a separate persistent cache: immutable artwork files are
  content-addressed and linked by assignments. It is intentionally not part
  of this response-cache table.

## Official Source Review

The source review was performed on 2026-08-22 using primary or authoritative
sources discovered through the available web service:

- [RFC 5861 — HTTP stale controls](https://www.rfc-editor.org/rfc/rfc5861.html)
  defines `stale-while-revalidate`: serve a stale representation immediately
  while validation proceeds without blocking. It also defines `stale-if-error`
  for availability during upstream failures.
- [RFC 9111 — HTTP caching](https://www.rfc-editor.org/rfc/rfc9111.html)
  specifies that stale reuse needs an explicit protocol or out-of-band policy.
  Harmoniarr therefore records the application-level freshness and stale
  windows in one policy module rather than relying on HTTP intermediary
  behaviour.
- [PostgreSQL INSERT documentation](https://www.postgresql.org/docs/current/sql-insert.html)
  documents `INSERT ... ON CONFLICT DO UPDATE` as an atomic UPSERT operation.
  It is the correct persistence primitive for one cache row per normalized
  provider key.
- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
  and [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
  recommend `Cache-Control: no-store` for sensitive responses. Harmoniarr must
  retain its existing network-only handling for authenticated API responses;
  provider-result persistence is a server-side cache of public metadata only.

## Options Considered

### A. Browser or service-worker caching for `/api/*`

Pros:

- Fast to add for a single browser session.
- No database migration.

Cons:

- Risks persisting authenticated response bodies on a shared device.
- Does not share cache state across users or application restarts.
- Cannot centralize provider rate limits, retry backoff, or request coalescing.
- Conflicts with the current intentional `/api/*` network-only service-worker
  policy.

Decision: rejected.

### B. Reuse `metadata_provider_snapshots`

Pros:

- No additional table.
- Already stores some provider payloads.

Cons:

- Its append-only history and read shape are for audit provenance, not cache
  lookup.
- It lacks a unique cache-identity constraint and would require
  expensive latest-row selection on every Artist Detail request.
- It mixes raw evidence retention with mutable cache eviction semantics.

Decision: rejected.

### C. Process-local maps only

Pros:

- Small implementation and no database I/O on hit.

Cons:

- Entries vanish on restart and are duplicated across instances.
- No durable stale fallback during provider trouble.
- Existing similar-artists map demonstrates that this alone is insufficient.

Decision: rejected as the authoritative cache. A future small L1 cache may be
added behind the durable service after measurement.

### D. Persistent metadata provider response cache with in-process refresh
coalescing

Pros:

- Persists across application restart and safely separates public provider
  metadata from authenticated response caching.
- Provides explicit fresh, stale, expired, and cold-miss policy decisions.
- Uses an atomic PostgreSQL UPSERT per cache key.
- Prevents repeated concurrent refreshes in the normal single-process Docker
  deployment.
- Keeps provider clients, cache policy, SQL store, and route adapters modular.

Cons:

- Requires a forward-only migration, snapshot update, and retention policy.
- An in-process coalescer is not distributed; multi-instance deployments need
  a later lease-based refresh extension.
- Public metadata can be intentionally stale for the configured bounded
  window.

Decision: accepted.

## Final Recommendation Stack

1. Add `metadata_provider_response_cache`, a dedicated table keyed by
   `(cache_namespace, cache_key)`. The provider is an application-controlled
   prefix in the namespace. Store only normalized public provider responses
   plus `fetched_at`; retain provider snapshots as history.
2. Add a persistence-only `metadata-provider-response-cache-store.js` with
   parameterized reads, atomic UPSERT, and explicit expiry pruning.
3. Add a policy-only `metadata-provider-cache-policy.js` and an orchestration
   `metadata-provider-cache-service.js`. The service returns fresh cache hits,
   immediately returns eligible stale entries while one refresh runs in the
   background, blocks only on a cold/expired miss, and does not poison a good
   stale entry on refresh failure.
4. Use separate policy values by response family:
   - Discography: fresh for 6 hours, then eligible for SWR for 7 days.
   - Related artists: fresh for 24 hours, then eligible for SWR for 7 days.
   These are application policy values, not browser response-cache headers.
5. Cache only public, normalized provider results. Do not include application
   user IDs, session data, credentials, request headers, raw provider tokens,
   or authorization decisions in the key or payload.
6. Keep `/api/*` network-only in the service worker and preserve API
   `no-store` behaviour for authenticated and user-specific response bodies.
7. In the next item, change Artist Detail to render after its local/catalog
   result resolves and hydrate related artists independently. Empty local
   catalog data must not suppress a needed provider fallback unless it is
   explicitly known to be a completed empty result.

The next item is now implemented and recorded separately in
`ARTIST_DETAIL_PROGRESSIVE_HYDRATION.md`. It keeps the persistent server-side
SWR cache as the source of truth while separating the page's critical render
path from the optional related-artist enhancement.

The following observability layer is implemented separately in
`ARTIST_DETAIL_CACHE_OBSERVABILITY_DESIGN.md`. It adds safe cold, fresh, stale,
refresh-failure, and refresh-duration evidence, and fixes the Artist Detail
adapter to read the API's `browse` envelope.

The next accepted baseline workflow is recorded in
`ARTIST_DETAIL_CACHE_BASELINE_WORKFLOW.md`. It makes the process observation
window and safe aggregate interpretable before any exporter or distributed
refresh lease is introduced.

The follow-on sample-capture workflow is recorded in
`ARTIST_DETAIL_CACHE_SAMPLE_CAPTURE_WORKFLOW.md`. It adds an explicit,
plain-text administrator capture action so paired process-local samples can be
collected before infrastructure is expanded.

## Security Constraints

- Every cache key and SQL value is parameterized; no provider or cache key is
  interpolated into SQL.
- Cache namespaces are application-defined constants, never client-selected.
- Only authenticated metadata routes may read these public cache entries; the
  new cache does not change route authorization.
- Cached values are normalized response objects. Provider raw payloads remain
  in the existing provenance path where applicable and are not copied into
  this hot cache.
- Refresh failures leave the last valid entry unchanged and can be surfaced
  through the application's injected telemetry or logging hook.
- Retention pruning bounds storage. Expired entries are never served after the
  configured stale window.

## PR Review Outcome

The public repository currently has five open Dependabot dependency or CI
updates (#40, #39, #36, #24, and #23). PR #39 was selected because its
development-dependency updates are compatible with this work: its commit was
applied locally with `git cherry-pick --no-commit`, then validated without
merging or creating a commit. It updates Testcontainers, ESLint, Vite,
Playwright, and related development tooling; it does not itself change Artist
Detail caching. The remaining PRs are out of scope for this change.

## Implementation Outcome

Implemented and validated as recorded in
`ARTIST_DETAIL_SWR_CACHE_IMPLEMENTATION.md`.
