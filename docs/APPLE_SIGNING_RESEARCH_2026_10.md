# Apple Music signing research

Consulted October 28, 2026 through Search/GitHub MCP. Official URLs were found
through search or documentation navigation. Apple's page linked Markdown that
the MCP reader cannot render; that exact resource was fetched directly. Runtime
is the existing Node 24.22.1. The one-hour/five-minute policy below is our design
choice, not an expiry interval required by Apple or a W3C standard.

| Official source/status | Applicable finding | Application decision |
| --- | --- | --- |
| [Apple Music developer tokens](https://developer.apple.com/documentation/AppleMusicAPI/generating-developer-tokens?changes=latest_maj_5&language=objc), current API documentation; [official Markdown](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens.md) | Apple requires ES256, meaning P-256/SHA-256, with issuer/key/time claims. Six months is the maximum accepted expiry. | Admit a private P-256 key before signing; keep server-side bearer delivery and existing claim names. Reduce new tokens to one hour. |
| [RFC 8725 §3.1](https://datatracker.ietf.org/doc/html/rfc8725#section-3.1), Internet Best Current Practice, February 2020 | Cryptographic operations must match the declared algorithm and permitted key usage. | Refuse RSA, other EC curves, public/symmetric keys and indirect loader descriptors instead of labeling their signatures ES256. This is a signer change, not a new JWT verifier. |
| [Node Crypto v24.22.1](https://nodejs.org/docs/latest-v24.x/api/crypto.html), runtime documentation | KeyObject exposes private/public/secret type, asymmetric type and named curve; native signing supports IEEE-P1363 encoding. Node also supports indirect STORE inputs. | Parse bounded inline PEM or accept a private KeyObject; require EC/prime256v1, use SHA-256/P1363 and check 64 signature bytes. Do not accept URLs or arbitrary loader/options objects. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement, May 15, 2025 | Minimize unnecessary exposure of sensitive information. | Retain only admitted signing material and a per-client token; return one sanitized configuration error without key text, provider/native causes or tokens. No WCAG claim is made. |
| [Buildx action metadata](https://github.com/docker/setup-buildx-action/blob/f87e5991a6d7451dcb8d9637bfbc97413f497069/action.yml), immutable upstream source | v4.4.1 runs on Node 24 and has main/post lifecycle entry points. | Apply PR #59's two full-SHA pin updates locally and qualify actual setup/build/cleanup without release publication. |

RFC 8725bis also appeared in search as an Internet-Draft; it is not treated as
an adopted replacement standard. No new crypto library or hand-written ECDSA
implementation is needed. Existing Node/OpenSSL owns the cryptographic primitive.

## Alternatives

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Check signature length only | Cheap | secp256k1 also produces 64-byte signatures; does not establish P-256 | Reject |
| Admit native private EC/prime256v1 keys | Explicit algorithm/key binding; reject unsupported material before network | Misconfigured keys previously sent to Apple now fail locally | Implement |
| Keep 180-day tokens | Few signatures and wide clock tolerance | Long exposure if a bearer escapes; maximum accepted lifetime becomes default | Replace for new tokens |
| Sign every request | Minimal cache | Repeated local parsing/signing and no useful reuse | Retain a small per-client cache |
| One-hour tokens, renew with five minutes remaining | Shorter exposure, ordinary request reuse, local renewal needs no network | More signing and dependence on a reasonably correct clock | Implement as fixed policy |
| Persist/schedule token refresh | Survives restarts | Extra secret persistence, job and invalidation ownership | No new storage or maintenance job needed |

## Recommended stack and limits

Use a small key-admission policy module, the existing signer/cache factory and
the existing shared native HTTP owner. Capture a key once, pin ES256/P-256,
issue at most 3,600 seconds, renew at 300 seconds remaining, and renew rather
than reuse a token whose issuance lies ahead of the current clock. Refuse invalid
clock values and do not fall back to an older cached token on signing failure.

Shortening newly issued tokens does not revoke old 180-day tokens at Apple.
Key compromise still requires provider-side key revocation by an authorized
operator; this task does not perform it. Clock rollback handling is not external
clock synchronization. Local public fixtures do not establish live Apple acceptance.
See [design](APPLE_SIGNING_DESIGN.md) and [outcome](APPLE_SIGNING_OUTCOME.md).
