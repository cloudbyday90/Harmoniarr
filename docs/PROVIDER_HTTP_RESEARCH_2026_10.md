# Spotify and YouTube HTTP ownership research

Researched October 27, 2026 using the connected Search MCP service. URLs were
discovered in search results or official documentation navigation and opened;
they are not inferred endpoint documentation. Decisions below are application
policy, rather than requirements that these sources impose on every client.

## Official evidence

| Source and status | Relevant guidance | Application decision |
| --- | --- | --- |
| [Node HTTP, v24.22.1](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html), runtime documentation | Request timeout notification alone does not abort work. Destruction and close events have separate lifetimes. | Own request, response, socket and issued DNS callbacks; keep admission until they retire. |
| [Node Streams, v24.22.1](https://nodejs.org/download/release/latest-v24.x/docs/api/stream.html), runtime documentation | Pipeline propagates destruction on errors and can leave listeners behind. | Allocate each pipeline once, observe its completion and owned stream closes, and never reuse it. |
| [Node Zlib, v24.22.1](https://nodejs.org/download/release/latest-v24.x/docs/api/zlib.html), runtime documentation | Streaming codecs expose chunk controls. `maxOutputLength` describes convenience methods. `rejectGarbageAfterEnd` was added in v24.19.0; Brotli has a separate large-window option. | Count encoded and decoded bytes in the pipeline, use 16 KiB codec chunks, reject trailing data/members and disable nonstandard large-window Brotli. |
| [Undici](https://undici.nodejs.org/), official project documentation, current site v8.10.0 | Body consumption/cancellation matters for connection release; relying on garbage collection can exhaust connections. | Retain explicit fetch injection for compatibility tests, await its cancellation, and avoid equating that promise with proof of a native socket close. This does not upgrade the packaged bundled Undici. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), HTTP Semantics, Internet Standard, June 2022 | Content coding describes representation transformation; HTTP `deflate` uses the zlib format. | Advertise gzip, deflate and Brotli; decode only one recognized coding. Reject unknown/layered codings, raw-deflate fallbacks and redirects under this bounded client policy. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement, May 15, 2025 | Data minimization applies to collection and exposure of sensitive information. | Preserve existing allowlisted provider error fields; do not expose arbitrary bodies, credentials, URLs, headers or native causes in diagnostics. This is privacy guidance, not a WCAG conformance claim. |
| [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), current official cheat sheet | Destination validation must govern the actual connection; domain allowlisting alone leaves DNS and redirect bypasses. | Validate all lookup answers used by the native connection, preserve original Host/SNI/TLS identity and refuse redirects. |

The Node links resolved to v24.22.1 during this review. The application retains
its existing exact runtime and package pins; current Undici project documentation
does not establish the behavior of a different bundled version by itself.

## Alternatives and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Race fetch against a deadline | Small implementation; existing connection reuse | Caller completion does not prove cancellation or native retirement; per-call owners do not bound aggregate work | Replace for default Spotify/YouTube transport |
| Shared in-process native HTTPS owner | Actual close/DNS ownership, common API/OAuth admission, no new dependency or deployment | Fresh TLS connections cost setup time; direct HTTP/1.1 only; proxy-configured deployments are refused | Implement |
| Add another network service | Separate process boundary | Extra deployment, credentials and operational surface for an application lifetime problem | Do not add |
| Identity-only responses | Simplest decoding policy | Loses existing provider compression compatibility | Retain single gzip/deflate/br decoding with independent wire/output counters |
| Unbounded request queue | Delays busy failures | Retains callers and credentials while work accumulates | Fail fast at four active requests, including preparation and retirement |
| New module per provider transport | Independent implementation | Duplicates lifecycle logic and weakens a common limit | Share a factory-owned transport and keep provider policy/adapters separate |

The selected limits reduce retained work and body exposure. They are not a hard
heap/RSS ceiling: TLS, codecs, native buffers and parsed objects also use memory.
CPU scheduling can delay cancellation delivery; a deadline is not a real-time
completion guarantee. Normal DNS callbacks can outlive an aborted request, so
capacity remains occupied until those callbacks finish.

## Final recommendation stack

1. One application-owned four-slot service for Spotify/YouTube API, OAuth token
   exchange/refresh and Google revocation; no global singleton and no queue.
2. Direct native HTTPS with fixed origins, public DNS validation, normal certificate
   and hostname verification, original Host/SNI, redirect refusal and proxy refusal.
3. Bounded single-codec streaming, strict UTF-8/object JSON and existing sanitized
   HTTP diagnostics, with no automatic retries of remote credential mutations.
4. Caller cancellation separated from actual transport/codec/DNS retirement;
   unsuccessful retirement seals further admission and fails shutdown.
5. Preserve local OAuth transaction fences and required audit. Extend the same
   native owner to Apple Music next, preserving developer-token signing and API
   behavior, with actual TLS/compression/cancellation controls.

See the separate [design](PROVIDER_HTTP_DESIGN.md),
[implementation outcome](PROVIDER_HTTP_OUTCOME.md) and
[Docker qualification design](LOCAL_DOCKER_PROVIDER_HTTP_DESIGN.md).
