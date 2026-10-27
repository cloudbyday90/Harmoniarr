# Failed-login transaction research

Consulted October 27, 2026 through MCP search and official navigation. The current
qualified runtime is PostgreSQL 18.6, Node 24.22.1 and pg 8.23.1.

| Official source and status | Application decision |
| --- | --- |
| [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), informative guidance | Account-associated counters need consistent updates. Retain the project's five-failure/fifteen-minute policy; avoid extending an already-active lockout on each attempt. OWASP does not prescribe these numeric defaults. |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Record admitted authentication failures and lockout outcomes with bounded selected metadata, excluding password/hash/token material. Required transactional audit is a project contract, not a universal availability requirement. |
| [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), PostgreSQL 18 vendor documentation | Use the same account write guard as successful login, followed by a fresh read; retain the lock through counter and audit commit. |
| [W3C accessible authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum), informative WCAG 2.2 Understanding document | Retain normal password-manager/paste-compatible login without adding cognitive challenges. This backend change makes no new accessibility conformance claim. |

## Alternatives and final recommendation

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Increment from the original lookup row | Few queries | Concurrent attempts overwrite counts and can undo resets; audit can fail after mutation |
| Atomic SQL increment with separate audit | Avoids lost increments | Leaves counter/audit divergence and stale-credential policy unresolved |
| Account write guard, current credential comparison, atomic counter/lockout/audit (selected) | Serializes success/failure decisions and preserves required evidence | Extra queries and temporary refusal under contention/audit outage |
| External rate-limit service or new attempt table | Could support additional distributed policy | Adds deployment/schema complexity unrelated to this account-row invariant |

Recommended stack: capture attempted credential facts before verification; use
the existing bounded write owner; lock/read the current account; count only an
eligible wrong-password attempt for the same hash/exact epoch; saturate at five
and set lockout from database time; record the selected outcome in the same
transaction; return the existing authentication refusal after confirmed commit.
Unknown, disabled, deleted, stale, already-locked and valid-password-but-refused
attempts are audited without incrementing. Active lockout deadlines are preserved.

Retain existing request rate limits and fixed public errors. Do not automatically
retry an uncertain security write or claim rollback after COMMIT dispatch. This
does not redesign lockout recovery, timing-based account enumeration, audit
retention or credential-read/password-hashing resource admission.

See [design](LOGIN_FAILURE_DESIGN.md) and [outcome](LOGIN_FAILURE_OUTCOME.md).
