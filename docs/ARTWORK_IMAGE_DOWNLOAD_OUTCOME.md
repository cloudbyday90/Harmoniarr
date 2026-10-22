# Artwork image download containment outcome

Completed October 22, 2026 on `main`. See the separate
[design](ARTWORK_IMAGE_DOWNLOAD_DESIGN.md), [official research and alternatives](ARTWORK_IMAGE_DOWNLOAD_RESEARCH.md)
and [Docker outcome](LOCAL_DOCKER_ARTWORK_IMAGE_OUTCOME.md).

## Implementation

A narrow ESM downloader now owns image requests for Fanart.tv, TheAudioDB and
Cover Art Archive. Small URL/error and raster-content policy modules keep transport
and image decoding separate. The default artwork consumer passes saved byte limits
and provider identity; CAA uses the same transport inside its existing queue.

HTTPS/default-port asset admission rejects arbitrary origins, private IP literals,
userinfo, query and fragment carriers. Fanart/TheAudioDB refuse redirects. CAA
allows at most three manual hops, validates each destination, retires each prior
body and upgrades approved historical HTTP Archive links before dispatch. It sends
no plaintext image requests. API keys are absent from image headers. The final
approved destination supplies provenance rather than an unchecked response URL.

One deadline covers each redirect chain through the final byte. Responses stream
under the configured original-file limit: 20 MiB by default, at most 100 MiB.
Oversized declared lengths and the first excess streamed byte refuse before
ingestion. HTTP compression is refused after requesting identity transfer; this
is an explicit compatibility tradeoff, not decompression-bomb qualification.
Ignored bodies are retired and the request controller aborts on completion/refusal.

Raster signatures admit only JPEG/PNG/WebP before Sharp. Actual inspection and
rewrite use the configured input-pixel ceiling, preserve warning refusal and the
existing three-second rewrite timeout, and reject animation or excessive dimensions.
Native parser failures have generic approved errors. CAA keeps its User-Agent,
minimum admission interval, absence handling and retry/backoff behavior; retry
configuration is bounded to ten and unrepresentable Retry-After waits are deferred.
Image errors retain no arbitrary URL, body, Location or exception cause.

## Validation

| Check | Result |
| --- | --- |
| Focused transport, ingestion, consumer, CAA and provider compatibility cohort | 78 passed; final 13 image-policy checks also passed |
| `npm run validate:fast` | 10,900 passed: server 5,733; client 4,470; scripts 697 |
| Native provider HTTPS, including artwork images | 21 passed on Windows in the fast gate and 21 serially in isolated Linux |
| Client build comparison | All 155 artifacts unchanged |
| Actual packaged ESM probe | URL refusal, streamed byte ceiling, CAA manual redirects, Sharp pixel refusal and real rewrite passed |
| Project skill validators and documentation links | Passed |

Native image checks preserve real provider Host/SNI and the default TLS verifier.
Three provider journeys download a real PNG, invoke actual Sharp inspection and
rewrite, and write sanitized files into an owned temporary directory. Controlled
database/assignment sinks receive exactly three publications. The CAA journey
traverses approved Archive redirects, including a historical HTTP Location that
becomes HTTPS before contact. This proves filesystem publication and controlled
assignment ordering, not PostgreSQL transaction durability or a live catalogue.

Oversized/chunked, declared-size, SVG, compressed-response, forbidden-redirect,
stalled-header, stalled-body and trickle controls refuse. The healthy request is
held until failed sockets close while the child stays alive, so process exit or
fixture destruction cannot stand in for deadline-driven retirement. Forbidden
redirect authorities receive no tunnel. Public fixture trust stays child-scoped;
only the matched test leaf gained reviewed asset DNS identities. The CA and
mismatch certificate are unchanged; no signing key was committed.

Native testing found an unhandled rejection from cancelling an already-aborted
reader. Cleanup promises are now observed immediately without treating failed
redirect cancellation as retirement. Earlier CAA mocks were replaced with streamed
Responses and explicit hops; an overly broad no-TLS-errors assertion now permits
only expected ECONNRESET in deliberate abort cases. An executor-return lint issue
was also corrected. Failed evidence is retained separately from passing results.
The touched ingestion file's mixed line endings were normalized to LF.

Twelve changed/new code and fixture files were frozen for the passing gate and
packaging. The source fingerprint covers 3,286 files:
`826f901a6540ac85d49f274c2ddfca69f2f63d337294e088e15ea84dbdc947d4`.
Private inventories, logs and retirement evidence are under ignored
`.tmp/artwork-image-2026-10-22/`; initial mock logs also remain under `.tmp/`.
No SQL, dependency, release-version, tag or client UI changes were required.
Unrelated database/browser matrices were not repeated. GitHub MCP found no open
PRs at selection and completion, so no PR was implemented, merged or cleaned up.

## Recommendation and next item

Retain built-in fetch/default TLS → per-provider origins → bounded manual CAA
hops → identity image bytes → raster admission → bounded Sharp inspection/rewrite
→ existing storage/assignment. Benefits are shared containment and refusal before
publication. Costs are host-policy maintenance, stricter payload compatibility
and rejection of HTTP-compressed images. Input bytes and pixels do not cap total
heap, native allocation, aggregate requests or CPU use.

**Next: enforce destination IP policy at connection time.** Domain admission is
not DNS pinning. Qualify IPv4/IPv6 resolution, retries, fallback addresses and
proxy routing, preserving provider Host/SNI and certificate verification. Reject
private/reserved destinations on the actual connection, with no unchecked second
lookup. The current Archive suffix is a deliberate provider namespace trust
boundary; deployment DNS, proxies, TLS roots and egress controls remain trusted.
Do not describe this change as complete SSRF resistance or live provider acceptance.
