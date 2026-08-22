# Artist Detail Related-Artists Response Budget

## Finding

The local controlled sample confirmed that the related-artists provider cache
is operating correctly after a cold fill: the fresh repeat returned in roughly
13 milliseconds. The cold fill itself, however, took roughly 72.6 seconds in
the rebuilt local Compose service.

This is separate from cache freshness. `createSimilarArtistsService` first
uses ListenBrainz and MusicBrainz, then may fall back to ListenBrainz radio,
per-candidate MusicBrainz relation lookups, and several MusicBrainz tag
searches. The fallback sequence has no operation-level deadline or total
provider-call budget. Existing per-request timeouts and retries protect each
outbound request, but their worst-case latency compounds during one interactive
Artist Detail load.

No artist identifier, provider payload, cache key, session value, credential,
or raw provider error is retained here. The timing was measured through the
local admin-only aggregate cache diagnostics and a fresh-cache repeat.

## Proposed Design

Introduce a small ESM service, for example
`related-artists-response-budget-service.js`, owned by the metadata layer. It
should create one monotonic deadline and one cancellation signal for a single
interactive related-artists refresh. That service should be injected into the
related-artists provider/fallback services rather than implemented as a
process-global singleton.

The implementation should:

1. Give interactive related-artists work an explicit, documented total budget.
   The proposed initial budget is six seconds, to be validated against normal
   provider latency before adoption.
2. Propagate the cancellation signal and remaining deadline to both
   MusicBrainz and ListenBrainz request clients. Queued work must not start
   after the deadline, and an in-flight fetch must be aborted rather than left
   as an orphaned provider request.
3. Bound fallback fan-out. A first implementation should permit primary
   provider reads and at most one MusicBrainz fallback search; it should not
   make one relation lookup per radio candidate on the interactive path.
   Expensive enrichment can be omitted from the initial response or handled by
   a separately budgeted background refresh.
4. Return the best available normalized candidates when the deadline is
   reached. A timeout must be an expected bounded outcome, not a raw error
   exposed to the browser.
5. Avoid storing a degraded empty result as a long-lived successful cache
   entry. Existing fresh and stale entries must remain usable; a cold timeout
   needs an explicit non-cacheable or short-lived degraded outcome with
   aggregate-only observability.
6. Keep the existing fresh-admin, no-store diagnostics boundary and record
   only bounded counters and durations. Never log provider URLs, request
   inputs, payloads, credentials, cookies, or raw stack traces.

## Why This Is SWR-Compatible

SWR serves a usable stale entry while a refresh occurs. It cannot make an
unbounded initial cache fill acceptable. The response budget completes the
contract: fresh and stale cache hits remain immediate; a cold or expired fill
uses bounded best-effort provider work; and a timeout does not poison a durable
cache entry. HTTP caching likewise requires explicit freshness and stale-use
rules, rather than treating an arbitrary incomplete response as reusable.

## Options

| Option | Advantages | Drawbacks | Decision |
| --- | --- | --- | --- |
| Raise TTLs or alter SWR windows | Fewer calls after a successful fill | Cannot bound the first fill; can increase metadata staleness | Reject |
| Lower global provider retries | Small change | Degrades import, refresh, and search reliability as well as Artist Detail | Reject |
| Remove all fallback sources | Fastest path | Materially lowers recommendation quality | Reject |
| Bounded, cancellable interactive fallback | Limits visible latency, respects provider capacity, preserves partial useful results | Requires signal propagation and explicit degraded-cache semantics | Recommended |
| Precompute every artist's recommendations | Warm reads can be immediate | Large background workload, broad data footprint, and stale-data management | Defer |

## Recommendation Stack

1. Keep the implemented module-scoped shared MusicBrainz client so default
   metadata services honor the per-process provider budget.
2. Add a related-artists operation budget with cancellation propagated into
   provider clients.
3. Cap interactive fallback calls and return available normalized candidates
   when the budget is exhausted.
4. Preserve durable cache entries only for complete successful loads; expose
   degraded outcomes through aggregate, restart-aware counters only.
5. After interactive work is bounded, assess a centralized limiter only if
   multiple Harmoniarr processes share an egress IP.

## Security and Validation Requirements

The request clients must continue to enforce their outbound-host allowlists,
HTTPS-only base URL policy, redirect rejection, meaningful MusicBrainz
User-Agent, and existing authorization boundaries. Deadline inputs are service
configuration, never request parameters. Tests must use fake clocks, abortable
fetches, and fake provider clients; they must prove that cancelled queued work
does not begin, partial results are normalized, degraded outcomes do not poison
the durable cache, and no raw provider data reaches diagnostics.

Validate with focused client and service tests, the controlled 20-artist cache
workload, the full repository gate, a walkthrough Compose rebuild, and one
rate-respectful live paired sample. The live sample must record only aggregate
duration, cache state, and counters.

## Sources

Sources accessed on 2026-08-22:

- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [MusicBrainz rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [OpenTelemetry metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Outcome

This document records the next implementation target; it does not change the
related-artists fallback policy yet. The completed change in this iteration is
the shared MusicBrainz client boundary documented in [MusicBrainz Shared Client
Rate Limiting](MUSICBRAINZ_SHARED_CLIENT_RATE_LIMITING.md).
