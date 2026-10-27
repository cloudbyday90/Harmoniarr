# Plex owner-link research and recommendations

Reviewed October 27, 2026 through connected Search MCP. These URLs were discovered
by search and opened or searched within; provider capabilities were not inferred
from OAuth terminology.

## Official guidance and application

- [IETF RFC 9700, section 2.1](https://datatracker.ietf.org/doc/html/rfc9700)
  calls for single-use state securely bound to the user agent when the other
  specified CSRF defenses do not apply. Plex uses a PIN flow here. Applying the
  browser-binding and replay defenses is our design inference, not a claim that
  Plex implements an OAuth authorization-code/PKCE protocol.
- [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends authorization at execution and limited authorization lifetime.
  Recheck the initiating administrator and exact session under locks before
  publication; an earlier HTTP role check cannot authorize a later write.
- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
  documents HttpOnly, Secure, host cookie constraints and SameSite navigation.
  Use a separate HttpOnly host-only Lax verifier for the cross-site top-level GET;
  keep the normal Strict session cookie unchanged. Secure deployments use a
  `__Host-` cookie with Path=/ and no Domain attribute.
- [PostgreSQL 18 DELETE](https://www.postgresql.org/docs/18/sql-delete.html)
  distinguishes matching rows from rows actually deleted, including trigger
  suppression. Require exactly one exact-record state deletion. Token replacement
  and required audit must also be confirmed in the same transaction.
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html)
  provides transaction-scoped application locks. Serialize installation owner-link
  decisions and advance an encrypted revision on clear or completion. Bound waits
  through the existing transaction owner and await actual retirement on failure.
- [W3C Privacy Principles, data minimization](https://www.w3.org/TR/privacy-principles/)
  supports limiting disclosure to the task. Public start DTOs omit authority and
  verifiers; new audit details omit state, PIN, browser hash, token and provider
  identity. Existing authorized settings display metadata is retained. This is
  privacy guidance, not a WCAG or standards-conformance certification.

## Alternatives

| Choice | Benefit | Cost / limitation |
| --- | --- | --- |
| State ID alone | Small implementation | Callback URL possession can drive linking; no browser ownership or current actor proof. Reject. |
| Require Strict refresh cookie on callback | Uses existing session parsing | Cookie is absent on legitimate cross-site navigation. Reject as the only callback defense. |
| Bound browser state plus current initiating session and atomic publication | Stops cross-browser use, stale authority, replay and partial writes | Rotating, expiring or revoking that exact session requires restarting linking. Choose. |
| Accept any later session in the same family | Fewer restarts after rotation | Broadens the original authorization and needs a separate descendant-authority proof. Defer. |
| New table or separate deployed linking service | Dedicated storage/lifecycle | Unneeded schema and operational cost for the existing encrypted-secret and maintenance owners. Defer. |

## Recommended stack

Use ESM factory services: thin existing routes; owner-link policy and bounded
state reader; SQL-only owner-link store; bounded command transaction; existing
shared Plex HTTPS owner, encryption, session/account locks, maintenance guard
and required audit. Add a versioned encrypted pending envelope and installation
revision without migrations. Extend the existing automatic retention namespace.
Keep provider calls outside database checkouts. Return success only after commit;
a lost acknowledgement produces an unavailable response with no automatic retry.

Next evaluate Spotify and YouTube linking separately using the same ownership
principles and their actual provider protocol requirements. Do not generalize
Plex PIN behavior or combine all providers into one large service.
