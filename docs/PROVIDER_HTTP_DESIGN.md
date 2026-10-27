# Spotify and YouTube HTTP resource ownership design

October 27, 2026. This implements the next transport boundary identified by the
[OAuth outcome](OAUTH_LINK_OUTCOME.md). See the separate
[research and tradeoffs](PROVIDER_HTTP_RESEARCH_2026_10.md).

## Ownership and module boundaries

`createApp` creates one `providerHttpService`, passes it through the provider
module/resolver and both OAuth facades, and exposes it to application shutdown.
Spotify client-credentials, OAuth access, YouTube API-key/OAuth access, token
exchange/refresh and Google revocation use the same admission owner. Worker
producers drain before the HTTP owner closes. Standalone factories can receive
that owner explicitly; they do not create a process-global singleton.

| Module | Responsibility |
| --- | --- |
| `providers/provider-http-service.js` | Admission, end-to-end deadline, cancellation, safe JSON/error projection, retirement and shutdown |
| `providers/provider-http-policy.js` | Capture mutable input, bounded headers/body, fixed provider destinations and proxy refusal |
| `providers/provider-https-transport.js` | Provider response policy over native transport, retaining known HTTP failure classifications |
| `network/owned-https-transport.js` | Fresh HTTPS agent, DNS validation, TLS identity and actual request/response/socket/DNS retirement |
| `network/bounded-https-response.js` | Wire/decoded byte counters, single-codec pipeline, strict stream completion and codec close |
| `providers/provider-fetch-transport.js` | Explicit injected-fetch compatibility seam with awaited settlement/cancellation |
| `providers/provider-json-request-service.js` | Small caller adapter; existing Apple Music fetch implementation lives separately in `provider-fetch-json-request-service.js` |

Plex uses the extracted native transport core, retaining its own destination,
response-header and identity-only policy. Apple Music retains its preceding
bundled-fetch implementation in this change. It does not gain native-close or
shared-admission guarantees by using the old adapter.

## Admission and publication

Capture accepted headers and body before asynchronous preparation. There are at
most four active requests across Spotify and YouTube, with no waiting queue.
Preparation, DNS, connect, headers, body, decoding and retirement all belong to
the same request. Default timeout is 15 seconds; existing bounded configuration
up to 60 seconds remains, and the owner can impose a smaller ceiling.

A successful result is returned only after its transport has drained. Deadline
or caller cancellation can return a sanitized failure sooner, but cannot free a
slot while native work or an issued DNS callback remains. Cancellation destroys
native resources; it does not merely stop awaiting them. A false/rejected drain
marks retirement uncertain, refuses success and seals subsequent admission.
`close()` prevents admission, aborts active work and awaits its retirement; it
reuses one closing promise and fails when retirement is uncertain.

The existing transaction-owned OAuth publication happens after this boundary.
Timeouts cannot publish a late token locally. Remote code consumption, refresh
rotation and revocation are outside database rollback. No request is retried
automatically. Google revocation remains best effort after committed local clear;
failure cannot resurrect a local token. Clearing credentials is not cancellation
of unrelated work that was already admitted.

## Network and memory policy

Only HTTPS at the existing Spotify API/accounts and Google API/OAuth origins is
accepted, without userinfo, fragments or alternate ports. Every complete DNS
answer set must contain only admitted public IP addresses. Native requests keep
the original hostname for Host, SNI and certificate verification. A fresh
non-keepalive agent owns each connection. Nonempty upper/lowercase HTTP_PROXY,
HTTPS_PROXY or ALL_PROXY refuses dispatch, even with NO_PROXY; proxy routing is
not silently adopted or bypassed.

| Resource | Limit/policy |
| --- | --- |
| Active work | Four per application owner; smaller injected policies allowed |
| Headers | Native response parser 16 KiB; outbound allowlisted fields, each at most 8,192 characters |
| Request body | 65,536 bytes; GET bodies refused |
| API response | 2,000,000 encoded bytes and 2,000,000 decoded bytes, or a smaller caller cap |
| OAuth token response | Existing 65,536-byte caller cap |
| HTTP error / revoke response | At most 4,096 bytes in either representation, subject to a smaller caller cap |
| Compression | Identity or one gzip/zlib-deflate/Brotli coding; 16 KiB codec chunks; no layered/unknown encoding, trailing garbage/members or large-window Brotli |
| Parsing | Strict UTF-8 and a non-null JSON object; successful revoke can have an empty body |

Streaming counters cap accepted data, not total memory. Buffer concatenation,
JSON parsing and codec/native state also allocate. Pipelines are single-use.
Known HTTP failures preserve the existing sanitized status/reason/Retry-After
projection even when their bounded body is unreadable; successful malformed
responses fail as invalid. Arbitrary body text and native causes are discarded.

Explicit injected fetch waits for fetch settlement and reader cancellation, and
keeps admission during those promises. It provides no certificate, socket-close
or encoded-byte proof. Production defaults select native HTTPS; controlled fetch
fixtures are labeled separately in [qualification](LOCAL_DOCKER_PROVIDER_HTTP_DESIGN.md).

No SQL, migration, snapshot, UI contract, dependency or release configuration is
part of this change. Schema observation/maintenance remains automatic. The
[outcome](PROVIDER_HTTP_OUTCOME.md) owns executed evidence and limitations.
