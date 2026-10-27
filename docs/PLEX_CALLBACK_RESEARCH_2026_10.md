# Plex callback research and decision

Reviewed October 27, 2026. This completes the callback-state followup in the
[linked-login outcome](LINKED_LOGIN_OUTCOME.md). URLs below were discovered and
read through the search MCP service. They are primary standards, project or
browser-platform documentation, not inferred links.

## Evidence and application

| Official source | Relevant guidance | Application to Harmoniarr |
| --- | --- | --- |
| [IETF RFC 9700, OAuth 2.0 Security BCP](https://datatracker.ietf.org/doc/html/rfc9700) | Clients need CSRF protection; applicable state tokens must be single-use and bound to the user agent. | Bind each encrypted pending Plex flow to a random browser verifier and consume it once. This applies the security property; Plex PIN authentication is not thereby an OAuth authorization-code or OIDC implementation. |
| [OWASP OAuth 2.0 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html) | Protect redirect-based login against CSRF and authorization-response substitution; use the protections supported by the actual protocol. | Keep provider verification, current linked-account authorization and browser-state validation as separate required checks. Do not invent PKCE or ID-token validation for the existing PIN flow. |
| [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) | HttpOnly limits script access; Lax permits appropriate cross-site top-level safe navigation. A supported `__Host-` cookie requires Secure, Path=/ and no Domain. | Use a host-only HttpOnly Lax verifier cookie, prefixed `__Host-` under the configured secure-cookie policy. Keep the verifier out of JSON, URLs and audits. HTTPS deployment is required for the secure policy. |
| [PostgreSQL 18 DELETE](https://www.postgresql.org/docs/18/sql-delete.html) | WHERE selects deleted rows; the command reports actual deletion cardinality. | Require exactly one conditional deletion of the exact encrypted record inside the transaction that publishes the session. Zero means refusal; unexpected cardinality means rollback. |
| [W3C WCAG 2.2, Accessible Authentication (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum) | Authentication should support mechanisms that avoid cognitive tests and manual transcription; password-manager and paste support matter. | Keep the existing browser redirect and local login alternative. Browser binding adds no copy/paste challenge or extra secret-entry field. A restart after expiry uses the existing login feedback. This change is not complete WCAG acceptance. |

The transaction architecture below is our engineering decision derived from
these properties, not a prescribed Plex protocol or a claim of complete standards
compliance. Provider HTTP work must remain outside SQL ownership.

## Options and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Delete pending state after login | Small implementation | Concurrent callbacks can each publish; cleanup failure follows an already durable login | Replace |
| Consume before provider verification in a separate transaction | Stops ordinary replay early | Provider failure destroys retryability; successful consumption can precede failed publication | Decline |
| Keep pending state only in process memory | Simple local lookup | Lost on restart; inconsistent across processes; adds another mutable lifetime | Decline |
| Add a dedicated state table/service | Typed expiry and direct cleanup index | Migration and deployment surface beyond this narrow fix | Defer table decision; no extra deployed service |
| Browser cookie plus exact conditional consumption with login | Browser-bound, single-use durable publication; rollback restores state | Additional bounded SQL; legacy pending flows restart; expired rows still need maintenance | Implement |

## Recommended stack

1. Random 32-byte browser verifier in the existing application's cookie boundary;
   only a domain-separated SHA-256 hash enters the encrypted versioned payload.
2. Existing encrypted-secret persistence, a bounded minimal read, and database
   clock expiry. Reuse the bounded transaction owner for creation and required
   privacy-safe start audit; serialize client-identifier initialization.
3. Existing Plex PIN/token/profile verification outside database checkout.
4. Existing exact current linked-account admission, then conditional exact-record
   deletion, bookkeeping, root-session publication and required success audit on
   one borrowed client, with a final database-clock expiry check before commit.
5. Publish cookies only after acknowledged completion. Refuse ambiguous/replayed
   outcomes without automatic commit retry. Use canonical application-only
   continuations and no-store/no-referrer responses.

**Next:** add bounded expired callback-state retention to existing maintenance.
It should recognize versioned expiry and conservatively retire legacy pending
records, leave the persistent client identifier alone, honor maintenance ownership
and prove concurrent active flows survive. Provider HTTP timeout/body/drain bounds
are another followup; callback expiry alone does not bound provider resource use.

See the separate [implementation design](PLEX_CALLBACK_DESIGN.md),
[implementation outcome](PLEX_CALLBACK_OUTCOME.md),
[Docker design](LOCAL_DOCKER_PLEX_CALLBACK_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_PLEX_CALLBACK_OUTCOME.md).
