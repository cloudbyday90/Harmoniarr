# Last.fm response containment design

## Decision and scope

Adopt the existing shared bounded JSON reader for Last.fm's similar-artist
requests: at most 2,000,000 decoded bytes and a JSON object root. Keep request
construction, origin policy, one client-owned serial queue and result normalization
in the client. Move HTTP attempts, body handling, retry backoff and approved
diagnostics into a narrow ESM request service.

Last.fm errors currently retain the complete API-key query URL and native cause.
The related-artists service catches provider failures with Promise.allSettled and
its name fallback catch; these paths do not publish the raw error. Remove those
private fields at their source without claiming a reproduced external disclosure.
Configuration errors must not echo rejected base URLs or integer values either.

Preserve transport/429/5xx retry counts and backoff, non-retryable HTTP empty-list
behavior, missing-key no-op behavior, MBID/name fallback and existing caller abort
identity. Use the same per-attempt deadline for headers and body. Malformed or
oversized successful responses are terminal typed failures, not successful empty
results and not new automatic retries. Cancel ignored HTTP error bodies before
backoff or terminal classification. Provider-originated diagnostic fields are
limited to approved codes and numeric attempt/status/retry metadata.

## Alternatives and recommendation stack

| Option | Benefits | Costs / decision |
| --- | --- | --- |
| Shared bounded reader plus Last.fm request service | Reuses reviewed parsing, caps decoded bytes, reduces client responsibilities, contains credentials | Fixed 2 MB ceiling and small transport module to maintain. Recommended |
| Hand-written Last.fm-only parser | Independent tuning | Duplicates streaming, UTF-8, cancellation and object-root policy. Reject |
| Keep response.json() and redact downstream | Small immediate edit | Unbounded materialization and raw-error retention remain. Reject |
| Convert every metadata provider now | Broad consistency | MusicBrainz release payloads and other provider retry semantics need separate compatibility evidence. Defer |

Retain Node 24.22.1/npm 12.0.2, built-in fetch, default TLS verification, explicit
redirect refusal, modular ESM services, PostgreSQL 18 and pinned Alpine images.
No new dependency, database schema, route, UI, release or branch is needed.

## Evidence plan

Use synthetic Response streams for exact byte limits, cancellation, retry policy,
queue ordering and diagnostic projections. Reuse the owned HTTPS fixture with
Last.fm's default hostname and bundled fetch for compressed overflow, malformed
content, stalled/trickling bodies and cancellation of retryable error responses.
Keep process trust/proxy state child-local. Hold a later response until earlier
server sockets close so process exit cannot substitute for native retirement.

Run the related-artists consumer alongside owning provider tests, then one stable
fast gate. Qualify the same native cases in an isolated Linux container and record
the preserved no-cache local Compose rebuild separately. See
[research](LASTFM_RESPONSE_RESEARCH_2026_10.md) and [outcome](LASTFM_RESPONSE_OUTCOME.md).
