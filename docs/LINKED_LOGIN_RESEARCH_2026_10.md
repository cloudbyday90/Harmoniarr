# Linked provider login research — October 27, 2026

Official sources were discovered and read through the connected search MCP
service on October 27, 2026. The implementation decisions are application
inferences from that evidence, not a certification of the full sign-in protocol.

## Evidence

- [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
  describes stable, provider-scoped identities, warns against linking accounts
  solely through email/username attributes, and requires removed links to stop
  granting access. Its OIDC-specific issuer/token rules apply to OIDC; Plex's
  existing PIN flow is not converted into OIDC by this change.
- [OWASP OAuth guidance](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
  distinguishes authorization and authentication and discusses transaction-bound
  response/CSRF protections. Those principles motivate preserving server-side
  provider verification and separately reviewing callback-state ownership.
- [Plex staff authentication reference](https://forums.plex.tv/t/authenticating-with-plex/609370)
  documents obtaining a token from a claimed PIN and validating it through user
  information. This is an older, vendor-hosted staff reference, read in October
  2026. The discovered developer API page exceeded the MCP fetch size limit.
  No new provider endpoint is introduced, and live Plex behavior is not claimed
  as qualified by the controlled local transport.
- [PostgreSQL 18 application consistency guidance](https://www.postgresql.org/docs/current/applevel-consistency.html)
  explains the interaction between explicit locks and statement snapshots.
  Application inference: reuse READ COMMITTED and take the account write lock
  before rereading the provider/subject link; retain account-before-family order.
- [W3C accessible authentication explanation](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum)
  supports accessible authentication mechanisms, password managers and paste.
  Preserve the existing form/provider handoff instead of adding a challenge.
  This informative explanation is not complete accessibility acceptance.

## Options and tradeoffs

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Trust the earlier local user ID | Minimal SQL | An unlink, relink or disable can outlive stale admission | Replace |
| Match email or provider display name | Convenient discovery | Not stable identity; can associate the wrong local account | Reject |
| Provider calls inside the SQL owner | One apparent workflow | Holds locks/checkout through network delays; no atomic remote/local commit | Reject |
| Verified provider/subject descriptor, bounded candidate read, fresh locked link and atomic local writes | Current admission, minimal projection and rollback of required writes | Account contention can refuse; requires retry after some link changes | Implement |
| Compensate separate commits | Independent retries | Can leave bookkeeping/session/audit inconsistent, particularly after uncertain commit | Reject for this boundary |

## Final recommendation stack

1. Existing Plex PIN/token/user-info verification outside SQL; no email matching.
2. Bounded candidate read with explicit ID/provider/subject columns, UUID
   preference and numeric-ID fallback. Limit the two internal subjects to 256
   UTF-16 code units each as an application admission policy.
3. Server-only provider/subject/user descriptor, captured before waits. Allow Plex
   explicitly; future providers need their own verified namespace/adapter.
4. Existing bounded READ COMMITTED write owner, account write lock and fresh
   exact link/enabled-account checks, followed by common login bookkeeping,
   borrowed-client root issuance and cardinality-checked required audit.
5. Publish credentials only after confirmed local commit; never automatically
   retry that transaction after uncertain acknowledgement.

Callback-state storage/consumption and browser binding remain separate work.
See [design](LINKED_LOGIN_DESIGN.md) and [outcome](LINKED_LOGIN_OUTCOME.md).
