# MusicBrainz response containment outcome

Completed October 21, 2026 local time (October 22 UTC). Design choices and
alternatives are in the [design](MUSICBRAINZ_RESPONSE_DESIGN.md); source status
and links are in the [official research](MUSICBRAINZ_RESPONSE_RESEARCH_2026_10.md).

## Implemented behavior

The MusicBrainz client retains URL construction, query/includes, a single serial
queue and caller cancellation. A small ESM request-service factory owns HTTP
attempts, Retry-After/backoff, bounded response handling and approved failures.
Its operation policy allows 2 MB for artist identity/search and release-group
summaries, 4 MB for relations/release-group details/release search and 8 MB for
release details/release browsing. All figures are decimal decoded bytes.

The shared parser moved to an integration module with an 8 MB hard ceiling;
the existing shared-provider wrapper retains its 2 MB maximum. Successful invalid
JSON, invalid UTF-8, absent/non-object bodies and overflow are terminal typed
failures. Header and body waiting share one per-attempt deadline. HTTP bodies are
cancelled before retry or terminal classification; cleanup failures preserve the
known HTTP result. Transport/429/5xx retries, 404 handling, 429/503 throttling and
Retry-After seconds/date are retained. Client errors retain approved numeric
health metadata, excluding raw URLs, native causes and rejected configuration
values. Internal caller abort reasons retain identity.

Real consumer qualification found the new typed invalid-body error also needed
an explicit HTTP/health mapping. Metadata routes now return safe 502 feedback;
the health recorder reports degraded status. Catalogue failures cannot masquerade
as successfully cached empty results. A later valid page restores healthy status.
Existing consumer limits remain 25 results; direct-client fixtures additionally
qualify the vendor's 100-result parameter and short pages with intact totals.

## Validation

| Evidence | Result |
| --- | --- |
| Owning and affected consumer selection | 211 passed, no failed/cancelled/skipped cases |
| Native HTTPS shared clients + Last.fm + MusicBrainz | 14 passed on Windows and 14 in an isolated Linux container |
| Full `npm run validate:fast` | 10,857 passed: 5,690 server, 4,470 client, 697 scripts; static/lint/build checks passed |
| Client build comparison | All 155 artifacts unchanged |
| Skill validation | Updated provider HTTPS reference; skill validator passed |

All eight operations accept their exact byte ceiling and reject one byte above
without new retries. Multi-byte UTF-8 and declared/chunked lengths are controlled
separately. A structured **2,781,118-byte, 60-disc, 3,000-track** release survives
client parsing, gzip/Brotli native transport and actual import normalization;
malformed input stops before storage/audit. The catalogue control proves failure
propagation, health publication and successful later loading.

The native child uses bundled Node 24.22.1/Undici 7.30.1 fetch and the default
verifier with MusicBrainz's default DNS/Host/SNI. Fixture-only startup CA/proxy
state never becomes application trust or production origin policy. Compressed
overflow, malformed compression, invalid JSON/UTF-8, stalled headers/bodies,
trickling bodies and ignored error bodies are exercised. Later healthy responses
wait for earlier server sockets to close while the child is still alive. Stubbed
sleeps establish retry ordering/counts and delay selection, not actual rate cadence.
The Linux lane is read-only, network-none, UID 1000 and resource-limited; its exact
container is removed and absence verified.

Frozen source: **3,270 files**, SHA-256
`2440590bcd627680dbd40f7d04c285aefe78a450d05e18877f38e4abad65e1a7`.
All 15 changed code/fixture files match their pre-gate hashes. The existing 225
Vue warnings remain in the fast log. No database policy, SQL, session mutation,
UI or dependency changed, so unrelated database/browser/release matrices were
not repeated. The separate [Docker outcome](LOCAL_DOCKER_MUSICBRAINZ_RESPONSE_OUTCOME.md)
owns packaged runtime and preserved Compose readiness proof.

## Retained controls and limits

A baseline HEAD comparison accepts a 2,000,015-byte artist-search object and
retains a private-query sentinel in URL/cause diagnostics. The candidate rejects
the same oversized body and retains neither private field. This is retention
proof, not a demonstrated external disclosure.

Initial test controls exposed mock call-count timing and an abort fired before
the body reader started; corrected controls count completed calls and gate the
actual read. Another initial catalogue control used 100 where the existing public
service permits 25; the corrected test preserves that admission policy. Original
failed logs remain in `.tmp/musicbrainz-response-2026-10-21`. Line endings in
modified existing files match HEAD and ordinary Git whitespace checking passes.

No live MusicBrainz account/query, public DNS, aggregate multi-client rate limit,
decompressor allocation ceiling or universal real-catalogue maximum is proved.
Decoded byte caps do not bound total parsed heap. Unusually large valid releases
can exceed the chosen ceiling and will fail explicitly rather than truncate.
No W3C/OWASP certification is claimed.

MCP GitHub queries found **zero open PRs** at selection and completion. There was
no PR to implement locally, rebase, close or merge. Work remains on main with no
release, tag, version bump, package update or new branch.

## Recommendation and next item

Keep built-in fetch/default TLS, explicit origin admission/redirect refusal,
shared bounded parsing, operation-specific ESM services, the existing cache and
PostgreSQL stack. This bounds accepted input and releases ignored bodies while
preserving larger releases; the cost is explicit size policy and maintained
native transport fixtures.

Next: **Fanart.tv response containment**. Its current client still uses unbounded
`response.json()` and leaves error bodies unretired on 404/retry paths. Qualify
artist/album image payload sizes, credential-header privacy, 404-empty results and
Retry-After before adopting the bounded reader and a narrow request service.
