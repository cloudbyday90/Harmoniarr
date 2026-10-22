# Provider HTTPS research, October 2026

Consulted October 21, 2026. URLs were discovered through MCP search and opened
against their official sites before applying the guidance.

| Official source | Status and applicable practice | Local decision |
| --- | --- | --- |
| [Node enterprise network configuration](https://nodejs.org/learn/http/enterprise-network-configuration) | Vendor documentation: Node 24 supports environment proxies for bundled fetch; additional CA certificates are process configuration | Use a fresh fixture child with an owned proxy and startup-only test CA; preserve the default verifier |
| [IETF RFC 9525](https://www.rfc-editor.org/rfc/rfc9525.html) | Standards Track, November 2023: service identity uses distinct DNS and IP matching rules | Exercise real matching and mismatched certificates; distinguish origin admission from authenticated TLS identity |
| [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | Informative security guidance: allowlist destinations and disable automatic redirects | Preserve exact parsed origin admission and prove redirect targets receive no HTTP request |
| [WHATWG Fetch](https://fetch.spec.whatwg.org/?v=1.1.1) | Living Standard, consulted current text: redirect mode `error` produces a network error | Exercise all five redirect statuses through the native consumer instead of inspecting an options object alone |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Informative guidance: exclude access tokens, passwords and other primary secrets from diagnostics | Remove malformed URL parser input at the request boundary; retain only approved status/reason/retry fields |
| [W3C Trace Context Level 2](https://www.w3.org/TR/trace-context-2/) | Candidate Recommendation Draft, not a final Recommendation: privacy/security sections prohibit sensitive tracing information and describe bounded parsing | By project inference, retain approved diagnostic fields and synthetic test correlation only; do not add trace propagation or claim Trace Context conformance |

The W3C document is supporting privacy guidance, not a TLS specification or
accessibility acceptance checklist. No browser semantics change in this work.
Tests of isolated certificates and local responses cannot establish live
provider certificate rotation, public DNS, every supported architecture, all
HTTP clients, whole-application SSRF resistance or full standards conformance.

See [design and tradeoffs](PROVIDER_HTTPS_DESIGN.md) and
[executed outcome](PROVIDER_HTTPS_OUTCOME.md).
