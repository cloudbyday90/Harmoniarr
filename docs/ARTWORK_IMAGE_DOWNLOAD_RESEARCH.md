# Artwork image research and recommendation stack

Consulted October 22, 2026 using MCP official-source search and page retrieval;
these URLs were discovered, not constructed. GitHub MCP returned zero open PRs
at selection time; random implementation/cleanup is inapplicable to an empty set.

| Official source and status | Applicable decision |
| --- | --- |
| [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), informative security guidance | Explicit provider hosts and revalidate manual redirects; domain admission alone does not establish DNS rebinding protection |
| [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API), vendor contract | Front images redirect to Internet Archive; preserve controlled hops and legacy-link HTTPS upgrade |
| [Fanart.tv API](https://api.fanart.tv/), indexed vendor reference | Images use the asset CDN; API keys do not belong in image requests |
| [TheAudioDB examples](https://www.theaudiodb.com/docs_json), vendor examples | Preserve documented apex/www artwork paths |
| [Sharp security](https://sharp.pixelplumbing.com/security/) and [constructor](https://sharp.pixelplumbing.com/api-constructor/), library documentation | Treat inputs as untrusted, retain warning refusal and constrain input pixels; process/container limits remain necessary |
| [Node 24 HTTP](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html), runtime documentation | Routing/proxy configuration is a deployment trust boundary; preserve default TLS and isolate native fixture trust |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), Statement, May 15, 2025 | Project inference: minimize outbound data and diagnostic retention; this is no conformance claim |

Fanart's direct reference previously returned 403; current indexed official
material establishes the CDN shape. No live image/API requests were used for
research. CAA's published examples include HTTP redirects; upgrading approved
Archive links to HTTPS is a project decision rather than a vendor guarantee.

| Alternative | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Provider-aware shared downloader | One byte/deadline/error owner; protects all three flows | Maintained host policy; custom CDNs require explicit review | Adopt |
| Reject every redirect | Small surface | Breaks CAA's documented behavior | Use for Fanart/TheAudioDB; bounded manual CAA hops |
| Identity HTTP images only | One streamed byte budget; no redundant decompressor | Rejects servers that ignore identity negotiation | Adopt and test compressed refusal |
| Signature + existing Sharp inspection/rewrite | Restricts formats before parser; keeps publication owner | Pixel limits do not cap total heap or aggregate concurrency | Adopt with input-pixel ceiling |
| New HTTP dependency or broad transport rewrite | Could add connect-time DNS pinning | More lifecycle/proxy compatibility work and regression scope | Defer to dedicated egress work |

Final stack: Node 24.22.1 built-in fetch/default TLS → provider URL policy →
bounded manual CAA redirects → identity streamed image budget → raster signature
→ existing Sharp 0.35.5 inspection/pixel limit/rewrite → existing artwork storage
and assignment. Deployment DNS/proxy/egress controls remain necessary; do not
interpret URL admission as full network isolation.
