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

## Implemented Design

`related-artists-response-budget-service.js` is a small ESM metadata service.
It creates one six-second deadline and cancellation signal for a single
interactive Artist Detail related-artists refresh. The service is injected into
`createSimilarArtistsService`; it is not a process-global singleton and it
accepts no browser-provided timeout or fallback-limit input.

The implementation now:

1. Uses a server-owned six-second total budget for the interactive operation.
2. Propagates the signal to MusicBrainz, ListenBrainz, and Last.fm calls.
   A provider call waiting in a rate queue stops waiting at the deadline and
   verifies the signal again before it can start. An in-flight `fetch` uses a
   combined request-timeout and operation-budget signal; budget cancellation
   is not retried.
3. Keeps direct-provider reads but bounds interactive fallback fan-out to one
   MusicBrainz fallback search and zero per-radio-candidate MusicBrainz
   relation lookups. Existing full fallback behavior remains available to
   separately invoked code that does not use this interactive policy.
4. Returns the best available normalized candidates when the deadline is
   reached. A timeout must be an expected bounded outcome, not a raw error
   exposed to the browser.
5. Marks a deadline-exhausted load non-cacheable. The cache service returns
   that payload to the current request but skips its PostgreSQL UPSERT, so a
   partial or empty result cannot replace a fresh or stale durable entry. A
   cold non-cacheable response accurately reports cache state `miss` rather
   than `fresh`.
6. Keeps the existing fresh-admin, no-store diagnostics boundary and records
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
| Bounded, cancellable interactive fallback | Limits visible latency, respects provider capacity, preserves partial useful results | Can return fewer candidates during a slow provider interval | Implemented |
| Precompute every artist's recommendations | Warm reads can be immediate | Large background workload, broad data footprint, and stale-data management | Defer |

## Recommendation Stack

1. Keep the implemented module-scoped shared MusicBrainz client so default
   metadata services honor the per-process provider budget.
2. Use the implemented related-artists operation budget and cancellation
   propagation across provider clients.
3. Keep the interactive fallback caps: one MusicBrainz search and no
   per-candidate radio enrichment.
4. Preserve durable cache entries only for cacheable complete loads; expose
   non-persisted refreshes through existing aggregate, restart-aware counters
   only.
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
- [Node.js globals: AbortSignal](https://nodejs.org/dist/latest/docs/api/globals.html)
- [Node.js HTTP API](https://nodejs.org/api/http.html)
- [OpenTelemetry metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Outcome

The bounded response policy is implemented. Focused regression coverage proves
that an expired queued request does not begin, cancellation does not retry,
interactive fallback fan-out stays within its cap, and an incomplete result is
returned without a cache write. On 2026-08-22, `npm run validate` and the
controlled Artist Detail cache workload passed. The local walkthrough Compose
image rebuilt, the recreated service became healthy, and its one-shot bootstrap
confirmed the existing disposable local admin.
