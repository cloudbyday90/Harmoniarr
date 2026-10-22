# MusicBrainz response containment design

## Decision

Use operation-specific decoded JSON byte budgets, keeping the existing serial
client queue, request parameters, paging metadata and transport/HTTP retry policy.
Move attempts, response ownership and approved diagnostics to an ESM request
service. Extract the existing streaming reader into a shared integration module;
the Spotify/YouTube/Apple/Last.fm wrapper retains its 2,000,000-byte ceiling.

| Operation | Decoded bytes | Reason |
| --- | ---: | --- |
| Artist lookup, artist search, artist release-group browse | 2,000,000 | Identity and paged summaries |
| Artist relations, release-group lookup, release search | 4,000,000 | Relationships, included editions and richer search summaries |
| Release lookup, release-group release browse | 8,000,000 | Complete media/recording payloads and potentially large releases |

These are conservative project budgets, not MusicBrainz guarantees or measured
catalogue maxima. A complete unusually large release can still exceed them.
The public catalogue service retains its existing 25-result admission limit;
direct client controls also qualify the vendor-supported 100-result parameter.
Do not truncate results or silently retry with smaller includes. Reject malformed,
invalid UTF-8, non-object or oversized successful responses with
`musicbrainz_invalid_response`; retain a distinct timeout diagnostic. Neither body
failure adds automatic retries. Use the same per-attempt deadline for headers and
body, and cancel ignored HTTP bodies before retry/backoff or terminal failure.

Preserve 404/not-found, 429/503 throttling, Retry-After seconds/date, attempts,
maxRetries, retryable, status and throttled health fields. Remove raw URLs and
native causes from errors, and rejected configuration values from client errors.
Searches and overrides can contain private text; this reduces retention without
claiming a reproduced external disclosure. Internal caller abort identity remains
owned by its caller.

## Alternatives and recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Shared parser with explicit operation budgets | Reuses cancellation/UTF-8 policy; allows larger releases; keeps existing providers constrained | Several reviewed budgets; parsed objects use more memory than raw bytes. Recommended |
| One 2 MB ceiling for all providers | Simple | Rejects legitimate larger release payloads. Reject |
| Raise every provider to 8 MB | Minimal wiring | Broadens unrelated providers and memory exposure. Reject |
| Keep response.json() | No compatibility ceiling | Unbounded materialization and ignored HTTP body ownership. Reject |
| Streaming domain JSON parser / smaller includes | Can reduce peak allocation | New dependency and normalization/paging contracts; requires separate evidence. Defer |

Recommended stack: Node 24.22.1/npm 12.0.2 built-in fetch and default TLS verifier,
explicit origin admission and redirect refusal, bounded shared streaming parser,
MusicBrainz operation policy plus request-service factory, client-owned serial
queue, existing PostgreSQL/cache/service consumers. No dependency, schema, route,
UI, version, branch or release change is required.

## Acceptance

Test every operation at its exact ceiling and one byte above, a structured large
multi-disc release, unchanged search/browse parameters, short pages and metadata,
terminal body errors, ignored-body cancellation, HTTP/transport retry policy,
queue/caller cancellation and approved diagnostics. Extend the existing native
HTTPS fixture to MusicBrainz's actual default hostname. Prove decompressed limits,
body deadlines and socket retirement while a subsequent healthy request remains
alive. Stubbed sleeps prove retry ordering and bounds, not elapsed rate cadence.

Run owning and affected consumer tests, then one stable fast gate. Keep Linux
transport proof and the preserved no-cache Compose rebuild separate from parser
unit evidence. Synthetic sizes do not establish all real-world catalogue limits.
See [research](MUSICBRAINZ_RESPONSE_RESEARCH_2026_10.md) and
[outcome](MUSICBRAINZ_RESPONSE_OUTCOME.md).
