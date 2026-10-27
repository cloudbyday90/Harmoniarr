# Password change research — October 27, 2026

Official sources were discovered and read through the connected search MCP
service on October 27, 2026. Implementation decisions below are application
inferences from that guidance, not claims of certification.

## Evidence

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
  calls for an active session and verification of the current password when
  changing a password. Its sensitive-feature guidance also supports
  reauthentication and session invalidation/token rotation.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
  treats a session token as equivalent to the authentication it represents and
  discusses regeneration around password/privilege changes and destruction of
  previous sessions. The application already promises account-wide revocation
  during password change; the missing property was atomic delivery.
- [PostgreSQL 18 application consistency guidance](https://www.postgresql.org/docs/current/applevel-consistency.html)
  explains why explicit locks must be paired with suitable statement snapshots.
  This retrieved current-version page identifies PostgreSQL 18. Application
  inference: reuse READ COMMITTED, take the account write lock before rereading
  the source, and preserve account-before-family-before-token lock order.
- [W3C accessible authentication explanation](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html)
  supports password-manager filling and paste. Keep the existing form, whole
  password processing and autocomplete behavior. A backend ownership fix does
  not justify an additional cognitive challenge or a claim of complete WCAG
  conformance. Manual screen-reader/physical-device acceptance remains deferred.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Separate credential/revocation/issuance/audit commits | Short individual writes | Partial outcomes and stale verified credentials can survive later failure | Replace |
| Compensating background workflow | Can retry independent steps | Exposes a period with inconsistent credentials/sessions; uncertain commits make compensation unsafe | Reject for this command |
| One guarded transaction with KDF inside | Simple apparent ownership | Holds checkout/locks during expensive password work | Reject |
| Prepare KDF outside; fresh account/parent checks and atomic writes inside | Shorter lock lifetime; exact-source fencing; rollback of all required writes | Bounded lock contention can refuse; rotated parent requires retry | Implement |
| Keep an old token or reuse its family | Fewer identity changes | Conflicts with account-wide revocation and complicates replay ownership | Issue a new root family |

## Final recommendation stack

1. Existing authenticated POST and CSRF guard plus current-password verification.
2. Bounded read owner, shared asynchronous scrypt admission and existing versioned
   hash policy; prepare all password/session material outside the SQL owner.
3. Existing bounded READ COMMITTED security-write owner. Lock account in write
   mode, reread exact hash/full textual epoch, then lock the initiating family
   and exact token row and check enabled/current/unexpired authority.
4. Conditional credential replacement, full old-session revocation with no
   residual active tokens, new root publication and required audit on one client.
5. Final parent-expiry check before COMMIT and cookie delivery only after confirmed
   success. Never automatically repeat a transaction after uncertain COMMIT.

This retains current input limits, hash parameters and failure-counter policy.
It changes command ownership, not the schema or the broader password policy.
See [design](PASSWORD_CHANGE_DESIGN.md) and [outcome](PASSWORD_CHANGE_OUTCOME.md).
