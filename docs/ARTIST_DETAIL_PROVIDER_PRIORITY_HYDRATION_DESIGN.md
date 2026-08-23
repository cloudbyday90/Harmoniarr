# Artist Detail Provider-Priority Hydration

Status: Implemented and validated
Date: 2026-08-22
Owner: Client metadata experience + provider-cache architecture

## Outcome

A fresh administrator-only local pair confirmed that the provider-backed
Discography cache is durable and behaves as stale-while-revalidate policy
intends: one cold `musicbrainz.artist_release_groups` browse was followed by a
fresh read of that same cache namespace after reopening the same Artist Detail
route. No cache-store errors occurred.

The same pair exposed a separate latency and cache-quality issue. Before this
change, `useArtistDetail` launched the optional related-artists provider fanout
before it resolved local metadata and its critical Discography browse. These
operations share the module-scoped MusicBrainz client and its rate-respecting
queue. On a cold public artist, the optional request could consume the queue
and exhaust its six-second response budget while the full Artist Detail loader
waited for Discography.

`useArtistDetail` now clears the critical loader and starts related-artists
hydration only after local resolve, operator projection, and Discography
fallback work settle. The related card remains independently progressive; it
cannot pre-empt the SWR-backed Discography read.

## Official Source Review

This change was reviewed on 2026-08-22 using current primary guidance found
through the web service:

- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) requires
  clients to stay at or below an average of one request per second and use a
  meaningful User-Agent. Giving the critical browse priority reduces avoidable
  work ahead of it without increasing outbound concurrency.
- The MusicBrainz [rate-limiting policy](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
  states that excessive per-client request rates can be declined. The fix
  preserves the shared client limiter and does not introduce parallel clients.
- [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) defines cache
  freshness and validation semantics. The change does not alter TTLs or
  freshness; it makes the existing server-side cache reachable earlier in the
  critical UI path.
- [OpenTelemetry's Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  describes cumulative counters and a stable start-time boundary. The result
  is interpreted only as a same-process interval: one cold then one fresh
  Discography lookup, with no cache-store errors.
- OWASP's [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends minimizing logged sensitive information. This implementation adds
  neither provider request details nor new telemetry; it uses the existing
  fixed aggregate diagnostic only.

## Evidence

The live test used the existing fresh administrator session and a public
artist resolved through Harmoniarr's normal catalog search. It did not import,
monitor, request, or persist that artist locally.

| Flow | Discography namespace | Related-artists namespace | Result |
| --- | --- | --- | --- |
| Existing imported Artist Detail | Local projection; no provider browse required | Fresh reads | Same-process related cache reuse works for an already-warm entry. |
| First unimported Artist Detail | Cold browse, completed and stored | Cold response-budgeted work; one scoped refresh failure | Discography eventually rendered, but optional work competed for the shared provider client. |
| Reopened unimported Artist Detail | Fresh read after the cold browse | Optional work remained separate | Discography rendered immediately from the server cache. |
| Rebuilt-image verification after this fix | Fresh read rendered Discography while Related artists was independently loading | One cold refresh completed with a scoped failure and no store error | The priority inversion is removed; the remaining related-artists response-budget outcome is isolated for the next increment. |

The aggregate intentionally omits artist identifiers, provider URLs, payloads,
credentials, raw errors, and cache keys. It cannot prove identity-level
ordering; the focused composable regression supplies that ordering guarantee.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Start related artists before Discography | Maximum parallelism when provider capacity is abundant | Low-priority fanout can pre-empt a critical request in the shared rate queue | Reject |
| Increase the related-artists timeout | May make more cold related results cacheable | Extends provider work and still leaves incorrect priority; changes a resource policy without isolating the cause | Defer |
| Add a second MusicBrainz client for related artists | Could isolate queues | Violates the effective source-IP rate budget and makes coordination harder | Reject |
| Persist browser-side Artist Detail responses | Could make repeat navigation fast | Duplicates server freshness policy and can retain authenticated response bodies | Reject |
| Defer optional related-artists hydration until critical work settles | Lets Discography reach the shared cache first; retains a separate progressive card; no new data surface | Related content begins after the critical view is usable | Accept |

## Final Recommendation Stack

1. Keep one module-scoped MusicBrainz client with its meaningful User-Agent,
   one-request-per-second minimum interval, request timeout, retry policy, and
   outbound-host controls.
2. Prioritize the local/projection/Discography critical path before optional
   related-artists enrichment in Artist Detail.
3. Preserve the existing durable server-side SWR cache, fresh-admin
   `no-store` diagnostic, and same-process paired comparison.
4. Do not alter TTLs, stale windows, retry counts, or related-artists response
   budget until a post-priority fresh-admin pair identifies a remaining
   namespace-specific failure.
5. If related-artists cold fills still regularly exhaust their isolated budget,
   add a focused regression for that service before changing only its bounded
   background-refresh policy.

## Security and Data Handling

- No browser storage, service-worker API cache, provider probe route, database
  schema, telemetry exporter, or new administrative action was added.
- The server remains the sole provider-cache authority. Its authenticated
  routes, outbound-host policy, rate limiter, and cache-key controls remain
  unchanged.
- The client starts the optional request only while the current route request
  is still active and its signal is not aborted. Route changes cannot start
  a stale related-artists call after cancellation.
- The regression uses only deterministic local doubles. The live evidence is
  aggregate-only and contains no user or provider secrets.

## Implementation and Validation

- `useArtistDetail.js` now launches `loadRelatedArtists()` in the critical
  request's completion path, after `isLoading` becomes false, rather than at
  request start.
- The focused client regression holds a cold Discography double open and proves
  that `fetchSimilar()` has not begun until that critical request resolves.
- Existing progressive-hydration coverage continues to assert that an already
  ready Discography is rendered while related artists are independently
  loading.
- `npm run validate` passed: copyright, migration, schema, ESM, image-tag,
  Compose-topology, lint, test-hygiene, server/client/script/integration tests,
  and production builds.
- `docker compose -f compose.walkthrough.yaml build --no-cache harmoniarr`,
  `up -d --wait --no-build harmoniarr`, and the bootstrap helper all passed;
  the recreated local service was healthy.
- In the rebuilt browser session, cached Discography rendered before the
  Related artists card's independent loading status. The aggregate recorded
  one fresh Discography lookup and one cold related-artists lookup; after the
  background work settled, the related namespace reported one scoped refresh
  failure and zero cache-store errors.

## Open Pull Request Review

GitHub currently shows three open Dependabot pull requests. None is applicable
to this increment: #40 changes the repository's Node 24 LTS image policy to
Node 26, while #24 and #23 propose older Docker Action versions than `main`
already pins. No PR was merged or applied locally.

## Next Item

Run the same fresh-admin paired Discography sample after the priority change.
If its related-artists namespace still shows repeated budget exhaustion after
the critical browse has completed, isolate that service's refresh contract in
a focused regression before changing its timeout or cacheability policy.
