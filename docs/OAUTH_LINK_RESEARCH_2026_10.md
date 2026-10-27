# Spotify and YouTube OAuth linking research

Consulted October 27, 2026 using connected Search MCP: primary URLs were discovered
through search, then opened or searched within. Provider documentation describes
provider contracts; RFC 9700 is IETF Best Current Practice. MDN is implementation
documentation, PostgreSQL 18 is the deployed database documentation, and W3C
Privacy Principles is informative design guidance.

## Applicable sources

- [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700) addresses browser-bound
  CSRF defenses, PKCE and replay. Preserve S256 while binding local pending state
  to the initiating browser and current administrator/session authorization.
  Authorization at local publication remains an application responsibility.
- [Spotify PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
  requires the original verifier and exact redirect in the token exchange.
  [Spotify redirect requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
  require HTTPS except explicit loopback IPs; localhost is unsupported.
  [Spotify refresh guidance](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
  distinguishes access-token expiry from refresh-token lifetime and permits
  reusing an existing refresh token when a replacement is omitted. Preserve that
  behavior; do not infer refresh-token lifetime from access-token `expires_in`.
- [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
  documents state checking, exact redirects, server credentials, offline access,
  incremental scopes, refresh and revocation. HTTPS has a localhost exception.
  Revoking a combined grant can revoke all its scopes; an access-token revocation
  can also revoke its associated refresh token. Keep the existing YouTube read-only
  scope, server secret and offline/consent/incremental parameters.
- [Google best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
  recommends encrypted token storage, unpredictable state, limited scopes and
  revocation/expiry handling. DPoP is a separate provider-specific adoption project;
  this change does not introduce it or claim sender-constrained access tokens.
- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
  documents HttpOnly, Secure, host prefixes and SameSite. Give each provider a
  separate host-only Lax verifier for top-level callback navigation while keeping
  the normal Strict refresh cookie unchanged.
- [PostgreSQL 18 DELETE](https://www.postgresql.org/docs/18/sql-delete.html)
  distinguishes matched rows from actual deletion, including trigger suppression.
  Exact state consumption, confirmed token writes and required audit share a
  bounded transaction. Refresh must compare the exact accepted token record.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/) supports
  minimizing disclosure. The public authorization URL necessarily carries OAuth
  state; new audit details omit it. Codes, verifiers, token hashes, tokens and
  client secrets are omitted from public DTO fields and new audit details. This
  is not a WCAG conformance assessment.

## Alternatives and recommendation

| Option | Advantages | Costs / limits | Decision |
| --- | --- | --- | --- |
| Existing state ID and separate writes | Small code path | No browser/current actor binding; partial publication and stale refresh can restore a cleared token | Replace |
| Strict session cookie on callback | Reuses ordinary session parsing | Absent on legitimate cross-site navigation | Keep Strict for ordinary sessions; use a separate verifier |
| Exact initiating session, browser-bound state and atomic local publication | Rejects stale authorization, replay and partial writes | Session rotation/revocation/expiry requires restarting the flow | Choose |
| Hold SQL locks during provider calls | Serializes more work | Couples database capacity and locks to remote latency | Reject |
| Short transactions plus exact token comparison on refresh | Prevents stale refresh/clear/relink overwrites | Does not serialize remote token rotation across processes | Choose; document remote limits |
| Commit local clear, then revoke the exact old Google token best effort | Failed local clear cannot trigger revocation; remote failure cannot restore local credentials | Remote grants have broader scope and cannot commit atomically with PostgreSQL | Choose |
| New deployed service, schema or OAuth SDK migration | Could provide a new protocol abstraction | Does not supply application-specific transaction/authority ownership; adds unrelated operational scope | Defer |

Recommended stack: existing provider wrappers and protocol parameters; modular ESM
policy, browser cookie, state-reader, SQL-store, transaction-owner and command
services; existing encryption/session/maintenance/audit infrastructure; bounded
provider JSON requests and exact refresh publication. Reuse automatic callback
retention with one total 100-row batch across all four pending namespaces.

Local rollback cannot reverse a successful provider code exchange, refresh-token
rotation or grant revocation. After an uncertain exchange/publication outcome,
restart linking when provider credentials are no longer usable. Controlled retry
tests establish local safety, not universal remote recoverability.

Next qualify and harden Spotify/YouTube HTTP resource ownership through actual
native request/body/socket retirement. Current fetch deadlines and bounded JSON
alone do not prove that resource lifetime.
