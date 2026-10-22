# Last.fm response research, October 2026

Consulted October 21, 2026 through MCP discovery and official navigation. Source
status and project inference are separated from observed runtime evidence.

| Official source | Status / applicable practice | Local decision |
| --- | --- | --- |
| [Node.js Undici documentation](https://github.com/nodejs/undici/blob/main/README.md) | Vendor guidance: consume/cancel response bodies and enforce application-specific streaming size limits; current main documentation is broader than bundled Undici 7.30.1 | Reuse the standard Response stream reader and qualify it with Node 24.22.1's actual bundled fetch; add no external Undici package |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Informative security guidance: exclude credentials, tokens and sensitive data from logs | Remove API-key URL, provider body/header text and native causes at the request boundary; keep approved diagnostic metadata |
| [W3C Trace Context](https://www.w3.org/TR/trace-context/) | Recommendation, November 23, 2021; privacy sections restrict sensitive trace data | By architectural inference, keep internal request correlation separate from private URL/query data; no tracing protocol or conformance claim is added |
| [Last.fm artist.getSimilar](https://www.last.fm/api/show/artist.getSimilar) | Official vendor method documentation: API key input, artist/MBID lookup and provider-specific errors | Preserve lookup inputs and existing empty/error-envelope behavior; do not infer idempotency or new retry permission from an HTTP 200 envelope |

The byte cap is a project policy for bounded similar-artist JSON, not a vendor
published maximum. It limits accepted decoded bytes, not all internal decompressor
allocations. Controlled cancellation establishes only the observed native socket
behavior. This work does not qualify live provider infrastructure, every metadata
client, accessibility or whole-application standards conformance.

See [tradeoffs and stack](LASTFM_RESPONSE_DESIGN.md) and
[executed evidence](LASTFM_RESPONSE_OUTCOME.md).
