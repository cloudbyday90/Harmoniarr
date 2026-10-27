# Plex HTTP ownership research and decision

Consulted October 27, 2026 through MCP search/navigation. This completes the
provider-transport followup in the [retention outcome](PLEX_RETENTION_OUTCOME.md).
Primary URLs below were discovered and opened, not inferred. The application
baseline is Node 24.22.1/OpenSSL 3.5.9, with bundled undici 7.30.1.

## Sources and concrete application

| Official source and status | Relevant guidance | Harmoniarr application |
| --- | --- | --- |
| [Node 24 HTTP API](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html), runtime documentation | Socket timeout notification alone does not abort a request; message completion and socket closure are distinct. | Use a whole-operation deadline with explicit destruction. Require complete HTTP framing and observe request, response and socket closure. |
| [Node 24 HTTPS API](https://r2.nodejs.org/docs/latest-v24.x/api/https.html), runtime documentation | HTTPS request options include TLS server identity, trust verification, agent and header limits. | Fixed Plex HTTPS origins, explicit servername/rejectUnauthorized, an isolated non-keepalive agent and a 16 KiB header cap. No redirect following or inherited global dispatcher/agent. |
| [Node/Undici project documentation](https://undici.nodejs.org/), project guidance | Response bodies should be consumed or cancelled rather than left for garbage collection. | Explicitly terminate refused bodies. A fetch promise or cancellation request alone is not used as proof of native resource retirement. The current Undici website documents a newer major; this change adds no Undici dependency or upgrade. |
| [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), informative security guidance | Keep secrets out of URLs and avoid exposing detailed internal failures. | Tokens remain in the Plex header, redirects are refused, provider error text is discarded, and public diagnostics are fixed messages/codes. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement | Minimize unnecessary collection/disclosure, rather than relying only on encryption. | Bound accepted response data and keep response bodies, tokens, DNS answers and native error text out of diagnostics. This is an engineering application, not a complete privacy/WCAG conformance claim. |

The limits below are project decisions, not durations or byte counts prescribed
by these sources. API documentation supports the mechanisms; our native fixture
supplies evidence of the resulting behavior on the actual pinned runtime.

## Alternatives and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing fetch plus response.text() | Small client | Whole-body buffering; no application deadline/cap; redirects and remote error text | Replace |
| Fetch timeout and bounded stream reader | Reuses shared readers; decoded-byte cap | Generic fetch settlement/cancellation does not expose the complete native request/socket/DNS lifetime needed here | Retain for other existing consumers; decline for this owner |
| Dedicated Undici dispatcher | Pool controls and explicit dispatcher lifecycle | New dependency and dispatcher-specific lifetime qualification | Defer |
| Owned native HTTPS with identity encoding | Observable native closes, explicit TLS/header/body policy and no new dependency | More lifecycle code; no connection reuse/compression/proxy support; may refuse unusual provider responses | Implement |

## Recommended stack

1. One application-owned Plex client shared by direct sign-in, owner linking and
   directory preview, with at most four active requests and no application queue.
2. A 15-second request result deadline spanning DNS, connect/TLS, headers, body,
   JSON validation and cleanup. A timed-out operation cannot later publish a result.
3. Fixed `plex.tv`/`clients.plex.tv` HTTPS origins, explicit TLS verification,
   public-address DNS validation, no redirects and isolated non-keepalive agents.
4. Identity encoding and 16 KiB headers; streamed byte caps of 64 KiB for PINs,
   256 KiB for user info, 1 MiB for Home users and 2 MiB for resources. Refuse
   compression, bad framing, invalid UTF-8/JSON and unexpected root shapes.
5. Fixed private diagnostics, no automatic retries, admission retained through
   actual request/response/socket close and issued DNS callbacks. Shutdown closes
   admission, cancels work and awaits those owners before pool retirement.

Costs include additional TLS connections and explicit refusal when a provider
requires compression, redirects, proxies or a larger response. Caps bound accepted
JSON bytes, not total process RSS. OS DNS completion can outlive the result
deadline; its slot and shutdown ownership remain held rather than abandoned.
Multiple sequential requests each have their own deadline, not one total workflow
budget. Native TLS uses the configured system trust store; no certificate pinning
or claim of independence from an administrator's root certificates is made.

**Next:** give the Plex **owner-link** callback current-actor authorization and
browser-bound single-use state, with token persistence, state consumption and a
required privacy-safe audit under one bounded transaction. Its current callback
still completes from a pending state ID and performs those writes separately.
Provider HTTP bounds do not supply that application authorization/publication
boundary. See [design](PLEX_HTTP_DESIGN.md), [outcome](PLEX_HTTP_OUTCOME.md),
[Docker design](LOCAL_DOCKER_PLEX_HTTP_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_PLEX_HTTP_OUTCOME.md).
