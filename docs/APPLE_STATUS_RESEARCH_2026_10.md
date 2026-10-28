# Apple local signing-status research

Consulted October 28, 2026 through Search/GitHub MCP. URLs were discovered through
search or official navigation; Node's URL was rechecked from the prior verified
research. Apple's linked Markdown could not be rendered by MCP and was fetched
directly from that exact discovered URL. Current runtime is Node 24.22.1.

| Primary source/status | Applicable finding | Decision |
| --- | --- | --- |
| [Apple developer tokens](https://developer.apple.com/documentation/AppleMusicAPI/generating-developer-tokens?changes=latest_maj_5&language=objc); [linked Markdown](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens.md), vendor API documentation | MusicKit tokens use ten-character Team/key IDs and ES256/P-256/SHA-256. Local parsing does not establish enabled provider capabilities or account ownership. | Report local ID/key suitability separately from configured presence and remote connection acceptance. Reuse the existing project identifier policy; its ASCII allowlist is project convention. |
| [Node Crypto v24.22.1](https://nodejs.org/docs/latest-v24.x/api/crypto.html), runtime documentation | KeyObject type, asymmetric type and named curve support explicit private P-256 admission. | Reuse bounded native key admission through the save normalizers; do not sign tokens or invoke indirect loaders while reading status. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement, May 15, 2025 | Minimize unnecessary disclosure and explain what observations mean. | Expose only fixed field/result enums, without IDs, key contents, native errors, fingerprints or JWTs. Label results as local validation, not provider acceptance. This is informative guidance, not a WCAG certification. |
| [RFC 9111 §5.2.2.5](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5), Internet Standard, June 2022 | no-store controls storage by compliant caches but does not itself guarantee privacy. | Preserve authenticated access and existing API no-store headers. Verify headers on actual successful and failed GETs; keep credential reads free of settings/secret/audit mutation. |

## Alternatives and recommendation

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Change configured to mean valid | Simple boolean | Breaks existing presence semantics and obscures missing versus invalid input | Preserve configured; add a separate summary |
| Return detailed parser/native errors | Rich debugging | Can disclose input, storage details or implementation information | Fixed enums and bounded errors only |
| Contact Apple or sign a test token on GET | Could exercise more of the provider path | Adds side effects, network/clock coupling and possible disclosure to a read | Keep explicit connection checks separate |
| Cache/persist validation | Less repeated parsing | Invalidation ownership, stale key/ID state and extra persistence | Recompute bounded local checks per read |
| Add a local signing summary | Compatible and actionable; shared policy | Some parsing per authenticated read; cannot prove remote acceptance | Implement |

Recommended stack: a small ESM status policy over existing credential normalizers,
the existing status factory and encrypted credential resolver, and unchanged
authenticated/no-store HTTP routes. Use one supplied queryable for both reads,
capture primitive settings before the asynchronous secret lookup, and keep
storage failures distinct from invalid local material. No new UI, dependency,
schema, background job or deployed service is required for this response change.

The reads do not establish one atomic cross-store snapshot, actual signature
generation, clock validity, Apple ownership, key-ID correspondence, revocation
state or live account acceptance. See [design](APPLE_STATUS_DESIGN.md) and
[outcome](APPLE_STATUS_OUTCOME.md). GitHub MCP found no open PR initially.
