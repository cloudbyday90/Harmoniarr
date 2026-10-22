# Artwork image download containment

Decision: October 22, 2026. Follow-up to [Fanart.tv composition](FANART_WIRING_OUTCOME.md).

Use a small ESM download service for Fanart.tv, TheAudioDB and Cover Art Archive.
Keep provider quotas, fallback order, target ownership and ingestion persistence
with their existing owners. The service admits HTTPS port 443 only, rejects URL
credentials/query/fragment and uses provider-specific asset hosts. Fanart.tv and
TheAudioDB refuse redirects. Cover Art Archive needs a bounded manual redirect
chain: admit each destination before dispatch, retire the previous body first,
and retain one deadline across all hops. Historical HTTP Archive redirect links
are upgraded to HTTPS before validation; plaintext requests are never sent.

The asset host policy admits Fanart.tv's exact asset host, TheAudioDB's apex/www
hosts, and Cover Art Archive plus Internet Archive's apex/subdomains. The Archive
namespace is a deliberate compatibility trust boundary for distributed storage,
not permission to contact arbitrary suffix matches. DNS/proxy routing and trusted
TLS roots remain deployment assumptions; this is not connect-time DNS pinning or
a general SSRF defense. No provider API keys are forwarded to image requests.

Request identity transfer encoding. Refuse compressed HTTP image responses before
reading them; JPEG/PNG/WebP already compress their pixel data. Count streamed body
bytes with the saved original-file limit (default 20 MiB, maximum 100 MiB), reject
oversized declared lengths, and cancel/abort on refusal. This avoids adding a
second decompression pipeline. The pixel-decoded budget is separate: ingestion
admits raster signatures before invoking Sharp, sets `limitInputPixels` from the
configured dimension ceiling, rejects animation/dimensions and rewrites pixels
before filesystem/database publication. Preserve the existing decode timeout.

Cover Art Archive keeps its queue, User-Agent, not-found behavior and bounded
retry contract. The new service returns approved numeric diagnostics only, with
no raw URL, Location, body, arbitrary headers or exception cause. Retry waits
outside Node's timer range are deferred, never shortened into immediate retries.

Prove URL refusal, body ceilings, cancellation-before-redirect/retry, format and
pixel refusal separately. Native HTTPS must retain provider Host/SNI and the
default verifier, observe absent forbidden target contact, and hold a healthy
request until failed sockets close. Then exercise actual image inspection and
ingestion with a temporary directory and controlled persistence. No live provider
requests or data resets are required. See [research](ARTWORK_IMAGE_DOWNLOAD_RESEARCH.md)
and [outcome](ARTWORK_IMAGE_DOWNLOAD_OUTCOME.md).
