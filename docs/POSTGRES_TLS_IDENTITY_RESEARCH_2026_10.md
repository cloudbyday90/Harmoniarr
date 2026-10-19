# TLS identity recommendations, October 2026

Consulted 2026-10-19. URLs were discovered through MCP official search, GitHub PR
metadata and official navigation, then opened. Sources have different authority
and scope; the selected practice must map to an actual owner and test.

| Source | Status and applicable practice |
| --- | --- |
| [Node 24 TLS API](https://nodejs.org/download/release/v24.20.0/docs/api/tls.html) | Runtime documentation. Retain certificate verification and default hostname/IP checks. secureConnect is a completed handshake; inspect authorized separately. Documentation is 24.20.0; actual local runtime is 24.18.1. |
| [RFC 9525](https://www.rfc-editor.org/info/rfc9525/) | IETF Standards Track identity specification. Distinguish DNS and IP SAN identities from trust-chain acceptance and avoid using common name as the intended identity. Tests are bounded evidence, not a full RFC conformance suite. |
| [PostgreSQL 18 SSL](https://www.postgresql.org/docs/current/ssl-tcp.html) | Server documentation. SSL enables negotiation; it does not by itself require encrypted clients. Restrict server key permissions and keep client trust roots explicit. libpq sslmode documentation is not a JavaScript-driver API contract. |
| [Testcontainers PostgreSQL](https://node.testcontainers.org/modules/postgresql/) | Library documentation and installed implementation. withSSL consumes existing certificate/key files and owns their container setup. Its example disabling rejection is unsuitable for identity validation; this fixture retains verification. |
| [OWASP TLS guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html) | Informative security guidance. Confidentiality, integrity and authenticated server identity are separate properties; minimize fixture trust scope and retain negative tests. |
| [W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/) | September 1 Working Draft, not a Recommendation. Monotonic process-relative offsets inform milestone measurements, without comparing independent clocks. |
| [W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/) | Candidate Recommendation Draft governing browser contexts. Database TLS alone does not establish browser secure-context behavior; no browser-conformance claim follows. |

## Alternatives and recommendation stack

| Option | Pros | Cons |
| --- | --- | --- |
| Unit-only injected TLS events | Fast, deterministic ownership checks | Cannot establish certificate verification, native handshake or actual socket retirement |
| Fake TLS endpoint | Focused handshake control | Does not prove PostgreSQL startup, authentication or real queries |
| Generate certificates for every run | Fresh keys and validity | Adds a runtime OpenSSL dependency and setup cost |
| Checked-in public test leaf keys with real PostgreSQL | Portable runtime, actual positive/negative verification, no extra dependency | Requires fixture validity maintenance and explicit isolation from production trust |
| Disable verification to simplify setup | Minimal setup | Removes the identity property the tests are intended to verify; reject this option |

Recommended stack: existing Node 24 ESM modules and reviewed pg tuple; existing
PostgreSQL/Testcontainers lifetime owners; fixture-local test CA and public leaf
keys; unmodified Node verifier with rejection enabled; actual handshake/query/
socket-close evidence; focused checks followed by selected native owners and
fast validation. Retain plaintext controls and exact driver guards. This adds
coverage without changing production TLS settings or claiming universal security.

The randomly selected dependency proposal is music-metadata PR 44. Its vendor
[v12 migration notes](https://github.com/Borewit/music-metadata/releases/tag/v12.0.0)
raise the runtime floor to Node 22/ES2023, compatible with this project's Node 24
baseline. [v12.2.1 notes](https://github.com/Borewit/music-metadata/releases/tag/v12.2.1)
include regular-file admission and parser fixes. Apply the exact PR lock locally
and qualify parseFile, cover selection, tag snapshots and actual media consumers;
release notes alone do not establish compatibility or remediation of a project
vulnerability. Keep its result separate from TLS evidence.

The [local PR outcome](OPEN_PR_44_LOCAL_EVALUATION_OUTCOME.md) supports retaining
the exact 12.2.1 proposal after actual consumers and the final fast gate pass.
Next, qualify replacement PR 49's remaining Express/Vue/router updates on actual
session/CSRF/request and asynchronous nested-navigation boundaries. TestsStream
end-listener warnings remain a separate validation-owner task; do not suppress
them or raise listener limits to make them disappear.
