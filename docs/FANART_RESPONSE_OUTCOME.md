# Fanart.tv response containment outcome

Completed October 22, 2026. See [design and alternatives](FANART_RESPONSE_DESIGN.md)
and [official research](FANART_RESPONSE_RESEARCH_2026_10.md) for source status,
tradeoffs and the recommended stack.

## Implemented behavior

Fanart.tv now uses the existing shared reader with a **2,000,000-decoded-byte**
ceiling and a JSON object root. A small ESM request service owns attempts, body
cleanup, deadlines and safe failures; a separate policy module validates timeout
and retry settings. The client keeps origin admission, paths, credential resolution
and image selection. No parsing duplication or new dependency was introduced.

One per-attempt signal bounds header/body waiting. Invalid JSON/UTF-8, absent or
non-object bodies and overflow become terminal `fanarttv_invalid_response`
failures, with no new automatic retries. Body timeout is separately classified.
Ignored HTTP bodies are cancelled before retry/backoff, terminal failure or empty
404 publication; cleanup failures preserve the known status. Header-only keys,
transport/429/5xx retries, ordinary Retry-After seconds/dates and language/likes
priority remain. Credential resolution occurs once per logical request.

Failures retain approved codes and numeric attempts/status/retryability, excluding
URLs, headers, body text, native causes and rejected configuration values.
Credential-resolver failures are generic, have zero attempts and dispatch nothing.
Invalid retry counts now fail before dispatch rather than silently fall through.
Finite counts retain the existing zero-to-ten clamp.

Timeouts must fit the host timer range. A very long Retry-After stops automatic
retries with `retry_deferred` instead of overflowing into an early retry. An
actual Node 24.22.1 control requested 2,147,483,648 ms, emitted
TimeoutOverflowWarning and called back after about 3.59 ms. The new control checks
large seconds, numeric overflow and far-future HTTP dates without scheduling sleep.
This does not introduce durable cross-request provider cooldowns.

## Validation and comparison

| Evidence | Result |
| --- | --- |
| Owning client/body policy, artwork consumer/module and shared reader selection | 65 passed, no failed/cancelled/skipped cases |
| Shared providers + Last.fm + MusicBrainz + Fanart.tv native HTTPS | 17 passed on Windows; 17 passed in isolated Linux |
| `npm run validate:fast` | 10,877 passed: 5,710 server, 4,470 client, 697 scripts; static/lint/build checks passed |
| Client build hashes | All 155 artifacts unchanged |
| Reusable skill | Provider HTTPS reference extended; skill validator passed |

Both Fanart.tv methods accept the exact ceiling and reject one byte above it.
Controls distinguish UTF-8 byte counts, declared length and streamed overflow.
HTTP cleanup is gated before sleep or empty publication; retry/credential counts
and cleanup rejection are verified. Actual artwork-service composition refuses
malformed input before image download, ingestion or assignment, preserves empty
404 behavior and successfully publishes a later valid synthetic image.

Native children use bundled Node 24.22.1/Undici 7.30.1 fetch with the default
verifier and Fanart.tv's default DNS/Host/SNI. Synthetic keys appear in headers,
not query strings. A redirect sink receives no tunnel or HTTP request. Gzip and
Brotli overflow, malformed compression/JSON/UTF-8, stalled headers/body, trickling
bodies, ignored 404/401 bodies, retry responses and exhaustion are exercised.
Later responses wait for earlier sockets to close while the child remains alive;
process exit and fixture destruction cannot substitute for request retirement.
Stubbed sleeps prove selected delays/order/counts, not elapsed provider pacing.

The Linux lane is read-only, network-none, UID 1000 and resource-limited. Its exact
container was removed and absence verified. The public fixture CA/proxy belongs
only to the child; production origin admission and default TLS remain unchanged.

A baseline HEAD comparison accepts a **2,000,105-byte** object and retains private
URL/native-cause data containing a synthetic credential sentinel. The candidate
refuses that same body and retains neither private field. This establishes
internal retention differences, not a reproduced external credential disclosure.
Existing JSON-only mocks were converted to standard Response objects; production
has no JSON-only fallback. Owning request tests, native HTTPS lanes and the full
fast gate passed.
Research retrieval limits (Fanart direct-open 403 and oversized RFC HTML) were
retained; official indexed reference and the successfully opened RFC PDF are
distinguished in the research document.

The no-cache build separately found an OS Brotli security update. The original
artifact gate stopped before deployment; official release/source review and
native shared-library checks qualified the exact 1.2.0-r0 to 1.2.1-r0 change.
This is separate from Node's already backported bundled Brotli. Preliminary
probe assertions used the wrong enum number/string; official decode.h established
code -17 and the native `_ERROR_FORMAT_BLOCK_SWITCH` string. Failed logs were
retained and owned containers retired. This was a probe correction, not a
production-code failure. The [Docker outcome](LOCAL_DOCKER_FANART_RESPONSE_OUTCOME.md)
records the final package difference and selected coverage limits.

Frozen source: **3,275 files**, SHA-256
`3279a5348a1ae043905d5dada3e380fa8efe61d581b45f854fb928f1755c64d6`.
All nine changed code/fixture files retain pre-gate hashes. The fast log retains
225 existing Vue warnings. No SQL, session policy, schema, UI, repository npm
dependency or Node version changed, so unrelated database/browser/release matrices were not
repeated. [Docker evidence](LOCAL_DOCKER_FANART_RESPONSE_OUTCOME.md) owns the
separate packaged checks and preserved no-cache Compose rebuild. Private raw
evidence is under `.tmp/fanart-response-2026-10-22`.

MCP GitHub queries at selection and completion found **zero open PRs**. None was
available to implement locally, rebase, close or merge. Work stays on main with
no version bump, tag or release.

## Recommendation, limits and next item

Retain Node 24.22.1/npm 12.0.2, built-in fetch/default TLS, explicit origins and
redirect refusal, shared bounded parsing, narrow ESM provider factories and the
existing PostgreSQL/artwork stack. Benefits are bounded accepted metadata, earlier
body retirement and reduced error-data retention. Costs are a fixed byte budget,
maintained transport tests and explicit refusal of unrepresentable retry waits.
The cap limits input, not total heap, decompressor allocation or aggregate calls.

**Next: connect the existing Fanart.tv credential resolvers to the default artwork
module.** Source tracing found app.js passes settings/maintenance dependencies,
while artwork-module.js creates the client without resolvers; its defaults return
null keys. Injected native keys prove the client boundary, not saved-key delivery
through default startup. Then normalize documented v3.2 nested albums by requested
release-group identity, with legacy-version controls and actual publication.
Current flat album fixtures establish compatibility, not live v3.2 correctness.

The separate image downloader still needs URL/redirect/byte-policy qualification.
No live provider account, public DNS, full catalogue maximum, image-format safety,
general SSRF resistance or W3C/OWASP certification is established by these tests.
