# Apple credential-save research

Consulted October 28, 2026 through Search/GitHub MCP. URLs below were discovered
through search or official navigation. Apple's linked Markdown could not be
rendered by MCP; that exact resource was fetched directly. The application uses
Node 24.22.1. No open PR was found in the initial GitHub MCP search.

| Primary source and status | Applicable guidance | Decision |
| --- | --- | --- |
| [Apple developer tokens](https://developer.apple.com/documentation/AppleMusicAPI/generating-developer-tokens?changes=latest_maj_5&language=objc), current vendor API documentation; [linked Markdown](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens.md) | Team ID and key ID each have ten characters; MusicKit developer signatures use ES256/P-256/SHA-256. | Validate submitted IDs and parse submitted private keys before persistence. Length is documented by Apple; the ASCII letter/digit allowlist is project policy. Preserve case. |
| [Node Crypto v24.22.1](https://nodejs.org/docs/latest-v24.x/api/crypto.html), runtime documentation | Native key type, asymmetric type and curve distinguish private P-256 material from other parsable keys. Native input can also select indirect loaders. | Reuse the runtime admission module; accept bounded inline unencrypted PEM at the JSON save boundary, without URL/loader/passphrase options. |
| [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), informative security guidance | Validate expected types, shape and operation semantics before storage; authorization remains separate. | Validate replacements and submitted IDs without requiring a complete credential tuple. Retain fresh-admin/CSRF middleware and the existing transaction. Reject a combined patch before any write when an input is invalid. |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement, May 15, 2025 | Minimize unnecessary sensitive-data exposure. | Use static bounded errors, no parser causes or key echo; keep PEM out of ordinary settings, returned payloads and audit details. This is an application of the principle, not a WCAG or cryptographic certification. |

## Alternatives and recommendation

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Validate only on provider use | Preserves all previous saves | Invalid keys can be stored and reported as configured | Retain as final defense, add save validation |
| Require the whole credential tuple on every save | Simple completeness check | Breaks staged setup, key-only rotation and independent clears | Reject |
| Validate each submitted replacement/ID | Early useful refusal; preserves partial edits | Previously accepted invalid submitted values must be corrected | Implement |
| Contact Apple during every save | Could detect remote rejection | Network dependency, account/rate-limit coupling and possible extra disclosure | Keep explicit provider connection checks separate |
| Normalize case or silently repair identifiers | Some typos disappear | Changes an account-issued opaque value without proof | Preserve case; trim surrounding whitespace only |

Recommended stack: small ESM credential normalizers, shared native key admission,
the existing provider secret mutation, settings normalization and existing
transaction/encrypted owner. The 16 KiB raw PEM bound is shared project policy.
No new crypto library, database artifact, refresh job or deployed service is needed.

Validation proves local representation and key suitability. It does not establish
Apple ownership, Media Services capability, revocation state, matching key ID or
live provider acceptance. Existing stored/environment values are not rewritten
or retroactively certified. Presence status remains presence status; the runtime
signer continues to admit keys before dispatch. See [design](APPLE_CREDENTIALS_DESIGN.md)
and [outcome](APPLE_CREDENTIALS_OUTCOME.md).
