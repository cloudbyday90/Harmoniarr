# Artwork egress research and recommendation stack

Consulted October 22, 2026 through MCP official-source discovery and retrieval.
GitHub MCP found zero open PRs at selection; random PR implementation is currently
inapplicable. URLs below were returned by search/navigation rather than invented.

| Official source/status | Applicable decision |
| --- | --- |
| [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), informative security guidance | Validate both address families and connect only to validated addresses without a second DNS lookup; retain origin TLS identity |
| [IANA IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry) and [IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry), protocol registries | Reuse the conservative public-unicast policy; deliberately exclude special-purpose ranges even when some are globally reachable |
| [Node 24 net](https://r2.nodejs.org/docs/latest-v24.x/api/net.html), runtime documentation | Automatic family selection uses lookup's address list; supply only the frozen approved snapshot |
| [Node 24 HTTP](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html), runtime documentation | An owned agent supplies explicit connection policy; proxy configuration is a deployment trust boundary |
| [Node 24 streams](https://nodejs.org/download/release/latest-v24.x/docs/api/stream.html), runtime documentation | Size the Web Stream queue in bytes; a backpressure threshold does not establish a process memory limit |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), Statement May 15, 2025 | Project inference: minimize retained DNS, endpoint and proxy data; no conformance claim |

| Alternative | Pros | Cons | Decision |
| --- | --- | --- | --- |
| DNS preflight followed by default fetch | Small change | A second lookup or proxy resolution can bypass the check | Reject |
| Built-in HTTPS with a snapshot lookup and owned agent | No dependency; explicit Host/SNI, fallback and resource ownership | More stream/lifecycle code; no pooled connection reuse | Adopt for images |
| Reuse extracted Push address/DNS policy | One reviewed policy; preserves existing contracts | Requires Push compatibility checks | Adopt |
| Delegate destination DNS to environment proxies | Preserves proxy connectivity | Cannot establish the intended pin from local preflight | Reject |
| Fail closed when a proxy is configured | Avoids bypass and unqualified routing | Proxy-dependent deployments cannot fetch new artwork | Adopt; qualify proxy support separately |
| Add a new HTTP dependency/general transport migration | Could consolidate more clients | Broader dependency and regression surface | Defer |

Final stack: provider URL admission → cancellable A/AAAA snapshot → conservative
public-address policy → owned direct HTTPS agent with pinned lookup/default TLS →
existing bounded image stream → Sharp rewrite → storage/assignment. Preserve
Node 24.22.1 and current dependencies. DNS answer validation does not authenticate
DNS, override operating-system routing or establish safety of every other client.
