# Artist Detail Cache Observability Design

Status: Implemented and validated
Date: 2026-08-22
Owner: Metadata architecture + web platform

## Purpose

Artist Detail now uses a durable server-side stale-while-revalidate (SWR) cache
for public discography and related-artist provider data. The cache had useful
internal state, but an operator could not determine whether an Artist Detail
request was a cold load, a fresh hit, or stale data being refreshed. A failed
background refresh was also intentionally non-blocking, which made it invisible
without a safe aggregate diagnostic.

This work adds bounded cache observability without turning authenticated API
responses into browser-persistent cache entries or recording provider payloads.
It also corrects an Artist Detail response-adapter defect: the MusicBrainz route
returns a `browse` envelope, while the composable read only a top-level
`results` field. A successful cached browse could therefore be rendered as an
empty discography.

## Official Source Review

The review was performed on 2026-08-22 using official or primary sources
discovered through the web service:

- [W3C Server Timing](https://www.w3.org/TR/server-timing/) defines the
  `Server-Timing` header for request-response timing and advises compact metric
  names. It is useful browser tooling, but it cannot report a refresh that
  finishes after a stale response has already returned.
- [OpenTelemetry HTTP metrics](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/)
  recommends request-duration metrics and requires predictable, low-cardinality
  error types. Cache keys, MBIDs, paths containing IDs, and raw provider errors
  are therefore excluded from the aggregate.
- [OpenTelemetry exception log conventions](https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/)
  distinguish expected handled failures from unexpected errors. A provider
  refresh failure is counted as a recoverable cache outcome; its error message
  is not copied into the diagnostics response.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises sanitising event data and excluding sensitive information. The
  implementation never stores cache keys, artist IDs, response bodies,
  credentials, raw provider URLs, error messages, or stack traces in cache
  observability data.
- [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) confirms that stale
  reuse needs explicit policy. These measurements describe Harmoniarr's
  application-level cache policy; they do not change its authenticated API
  `Cache-Control: no-store` policy.

## Options Considered

### A. Full OpenTelemetry SDK and external exporter

Pros:

- Standard metrics, logs, and traces can be exported to an observability
  platform.
- Supports fleet-wide aggregation for a future multi-instance deployment.

Cons:

- Requires exporter configuration, retention controls, operational secrets,
  and a secure collector endpoint.
- Broad instrumentation without a defined data contract risks collecting
  high-cardinality or sensitive provider context.

Decision: deferred. The bounded local contract establishes safe dimensions
first and can be adapted to an exporter later.

### B. `Server-Timing` headers only

Pros:

- Standard browser developer-tool support.
- Very small response-level addition.

Cons:

- A stale response returns before its background refresh ends, so it cannot
  report refresh success or failure.
- It does not produce an operator-readable aggregate or survive the browser
  request context.

Decision: not sufficient as the primary design. It remains compatible with a
later browser-performance enhancement.

### C. Return cache metadata with every response only

Pros:

- Lets Artist Detail retain its own discography and related-artist cache state.
- No new storage or route needed.

Cons:

- Cannot reveal background refresh failures after the response is returned.
- Does not provide aggregate cold/fresh/stale behaviour for diagnosis.

Decision: adopted as one layer, but not alone.

### D. Bounded in-process aggregate plus scoped response metadata

Pros:

- Records cold, fresh, stale, foreground/background refresh, failures, and
  timing without sensitive dimensions.
- Keeps the cache orchestration service modular and independently testable.
- Lets Artist Detail preserve the current response's safe cache metadata while
  a fresh-admin route exposes aggregate operational evidence.
- Does not change browser persistence or API cache-control behaviour.

Cons:

- Aggregate counters reset on process restart and are per instance.
- It is not a replacement for durable metrics in a horizontally scaled setup.

Decision: accepted.

## Final Recommendation Stack

1. Keep `metadata-provider-cache-service.js` as the only SWR orchestration
   point. It classifies cache entries and coalesces in-process refreshes.
2. Keep `metadata-provider-cache-observability-service.js` process-local and
   narrow. It aggregates only static cache namespaces, fixed lookup outcomes,
   refresh modes, counts, timestamps, and rounded durations.
3. Expose `GET /api/v1/metadata/cache-observability` as a fresh-admin
   diagnostic route. It returns the aggregate only; the global API hardening
   middleware continues to set `Cache-Control: no-store`.
4. Preserve `cache` metadata on Artist Detail's provider responses and surface
   it through the `discographyCache` and `relatedArtistsCache` composable refs.
   The current view stays focused on artist curation rather than displaying
   internal cache vocabulary to every user.
5. Treat `cache.lookup` as the request outcome (`cold`, `fresh`, or `stale`).
   Keep `cache.state` as the resulting stored-entry classification and
   `cache.refresh` as `none`, `foreground`, or `background`. A cold request
   therefore returns `lookup: cold`, `state: fresh`, and
   `refresh: foreground` after a successful fill. Foreground refreshes include
   `refreshDurationMs`; background durations appear when the aggregate is read
   after completion.
6. Maintain strict data minimisation: no cache key, MBID, payload, user,
   credential, raw error, route parameter, or dynamic provider identifier may
   enter the aggregate.

## Implemented Design

### Modular responsibilities

- `metadata-provider-cache-service.js` emits safe lifecycle callbacks and
  includes the normalized lookup outcome plus foreground refresh duration in
  response metadata. Observer failures are caught so telemetry cannot break a
  metadata response.
- `metadata-provider-cache-observability-service.js` owns the in-memory,
  low-cardinality aggregate. It intentionally has no SQL or route concerns.
- `metadata-module.js` composes the cache service with the observability
  service and supplies the diagnostic read dependency to the route adapter.
- `metadata-routes.js` keeps the diagnostic route thin, requires a fresh admin
  session, and preserves similar-artist cache metadata in the existing response
  contract.
- `useArtistDetail.js` unwraps the API's `browse` envelope before reading
  release groups and preserves discography metadata in `discographyCache`.
- `useArtistDetailRelatedArtists.js` owns related-artist cache metadata in
  `relatedArtistsCache`, maintaining the prior progressive-hydration boundary.

### Security controls

- No browser or service-worker API caching is added. `/api/*` remains
  network-only client-side and `no-store` server-side.
- The aggregate route requires a fresh administrator session. It is not a
  public health endpoint.
- The aggregate intentionally accepts no cache key or error data. Invalid
  dimensions are ignored, and only fixed enum values are counted.
- Background failures remain non-blocking and retain valid stale data. The
  aggregate exposes the count and failure time, not provider internals.
- Observer callbacks are best effort; a faulty metrics observer cannot block or
  alter a catalog response.

## Open PR Applied Locally

Open Dependabot PR #41 was fetched and applied locally with
`git cherry-pick --no-commit`; it was not merged. It updates development-only
tooling:

- `@vue/language-server` 3.3.9 to 3.3.10
- `eslint` 10.8.0 to 10.8.1
- `globals` 17.9.0 to 17.11.0

The local changes were validated with this implementation before the final
commit.

## Outcome

Implemented on 2026-08-22.

- Focused server, route, route-inventory, and client tests pass, including
  cache outcome aggregation, refresh failure visibility, duration capture,
  fresh-admin protection, safe response metadata, and the real browse envelope.
- The Artist Detail discography adapter now reads the actual API shape, so a
  cached provider browse is no longer mistaken for an empty discography.
- `npm run validate` passed: ESM, lint, test hygiene, 4,078 client tests,
  234 script tests, 30 real-database integration tests, and production client
  and server builds.
- `npm run validate:security` passed with zero reported npm audit
  vulnerabilities; the Artist Detail progressive-hydration browser check also
  passed.

## Next Item

Use the diagnostic data to establish a baseline under real Artist Detail load.
If multiple application instances are introduced and cold or stale refreshes
duplicate upstream work, add a PostgreSQL-backed refresh lease with expiry and
owner-safe release. Do not add a distributed lease before the measurements show
that in-process coalescing is insufficient.
