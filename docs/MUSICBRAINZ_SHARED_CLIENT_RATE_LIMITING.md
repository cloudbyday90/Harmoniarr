# MusicBrainz Shared Client Rate Limiting

## Outcome

Artist Detail already uses server-side provider-response caching with a
stale-while-revalidate policy. A controlled local Compose sample on 2026-08-22
showed that a cold discography refresh completed in approximately 0.2 seconds
while its concurrent related-artists refresh completed in approximately 66
seconds. After the shared-client correction, a second cold related-artists fill
still completed successfully but took approximately 72.6 seconds; its
subsequent fresh-cache read completed in approximately 13 milliseconds. These
samples establish that the observed user-visible delay is not a cache-write
failure, while also showing that client sharing alone cannot bound the entire
related-artists workflow.

The metadata module constructed separate default MusicBrainz clients for
catalog, import, refresh, search, and related-artist services. Each client
correctly serialized its own requests, but multiple clients could start
requests together from the same application process. That does not satisfy
MusicBrainz's source-IP request-rate guidance and can trigger provider retries
and backoff during a single Artist Detail load. It is a correctness issue that
must be fixed independently of the longer related-artists fallback path.

No artist identifier, provider payload, cache key, cookie, credential, or
diagnostic copy was retained in this document. The sample used the protected
aggregate cache diagnostics endpoint in the local-only walkthrough service.

## Implemented Design

`createMetadataModule` now resolves one MusicBrainz client, only when at least
one default MusicBrainz-backed service is needed, and injects that client into:

- the catalog service;
- the import service;
- the background metadata refresh service;
- the MusicBrainz search service; and
- the similar-artists service.

The client remains dependency-injectable for tests and alternate composition.
If all five services are supplied by the caller, the module does not construct
an unused client or validate unrelated provider configuration. The shared
client retains the existing outbound URL allowlist, HTTPS policy, request
timeout, retries, meaningful User-Agent, and minimum request interval. No new
route, setting, persistence, browser-visible diagnostic, or provider payload
logging was introduced.

Within one Harmoniarr process, all of these service paths therefore use one
serial request queue. This prevents Harmoniarr's default metadata services from
racing one another for MusicBrainz capacity. It cannot, by itself, bound an
individual related-artists operation that performs multiple fallback calls, or
account for other applications sharing the same egress IP.

## Evidence and Guidance

MusicBrainz documents a maximum average rate of one request per second from a
source IP and asks clients to identify themselves with a meaningful User-Agent.
Its rate-limiting guidance notes that excess traffic can receive HTTP 503. The
existing client already implements a 1.1-second minimum interval and retries;
the correction is to share that limiter across metadata services rather than
duplicate it.

The operator comparison continues to use restart-aware, monotonic aggregate
metrics. This matches OpenTelemetry's guidance that cumulative monotonic sums
need a start time to interpret process restarts. It deliberately excludes raw
provider data and session material in line with OWASP logging guidance.

Sources accessed on 2026-08-22:

- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [MusicBrainz rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- [OpenTelemetry metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)

## Options Considered

| Option | Advantages | Costs | Decision |
| --- | --- | --- | --- |
| Increase cache TTLs or change SWR behavior | Reduces some future calls | Does not prevent concurrent first fills; risks staler metadata | Do not use for this fault |
| Keep per-service MusicBrainz clients | Simple local ownership | Violates the effective process-level rate budget under concurrent flows | Reject |
| Share one client in the metadata module | Honors the provider's budget, preserves existing cache contract, has no schema or API change | Mixed metadata operations queue behind one another; does not bound fallback fan-out | Implemented |
| Process-global singleton | Broadly serializes calls | Makes test isolation and multi-app composition harder | Reject |
| Distributed limiter | Coordinates multiple replicas that share egress | Adds infrastructure and operational failure modes | Defer until horizontally scaled deployment needs it |

## Final Recommendation Stack

1. Keep the existing server-side provider-response SWR cache and its current
   bounded, protected observability.
2. Use the implemented metadata-module-scoped shared MusicBrainz client for
   every default MusicBrainz service in a process.
3. Retain the current outbound URL policy, request timeout, retry behavior,
   minimum interval, and meaningful User-Agent.
4. In a deployment with multiple Harmoniarr replicas behind one egress IP,
   introduce a centrally coordinated rate limiter before enabling concurrent
   metadata traffic across replicas. A per-process queue cannot enforce an
   IP-wide budget by itself.
5. Continue storing only aggregate, restart-aware cache evidence; never place
   credentials, session values, cache keys, provider payloads, or raw errors in
   documentation or operator diagnostics.

## Validation

The regression test composes the default catalog and search services with one
injected client and verifies that both public route dependencies use it. Focused
server validation, full repository validation, and a local Compose rebuild
passed. The rebuilt paired observation verified a successful cold cache fill
and a 13-millisecond fresh read, but revealed that the cold related-artists
fallback still needs a bounded response design.

## Next Item

The interactive related-artists response budget is now implemented as described
in [Artist Detail Related-Artists Response
Budget](ARTIST_DETAIL_RELATED_ARTISTS_RESPONSE_BUDGET.md). The next recommended
item was to establish the production topology. The supported Compose shape is
now explicitly one replica because it embeds PostgreSQL and owns host-backed
mutable state; its validation gate is documented in [Single-Node Deployment
Topology Gate](SINGLE_NODE_DEPLOYMENT_TOPOLOGY_DESIGN.md). A centrally
coordinated limiter remains deferred until a deliberate shared-database,
multi-replica deployment establishes a shared egress identity. The current
single process continues to use the implemented shared client queue and
bounded interactive response policy.
