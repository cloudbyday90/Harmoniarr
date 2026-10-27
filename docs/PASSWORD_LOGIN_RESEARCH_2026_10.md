# Password login transaction research

Consulted October 27, 2026 through MCP search and official navigation. The
qualified deployment uses PostgreSQL 18.6, Node 24.22.1 and pg 8.23.1.

| Official source and status | Applicable practice and owner |
| --- | --- |
| [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), PostgreSQL 18 vendor documentation | READ COMMITTED takes a new statement snapshot. Acquire the account write lock, then read the credential state; retain it through commit. |
| [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), PostgreSQL 18 vendor documentation | Consistent account-before-family lock order; take the write mode initially to avoid two successful logins upgrading shared row locks. |
| [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), informative guidance | Preserve password verification, account admission, generic invalid-credential response and authentication monitoring. |
| [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative guidance | Record successful authentication without passwords, hashes, cookies or token secrets. Atomic required audit is this project's stronger issuance contract, not a universal OWASP availability requirement. |
| [W3C accessible authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum), informative WCAG 2.2 Understanding document | Preserve normal password-manager/paste-compatible login. Add no puzzle, extra credential prompt or client-side authorization requirement. This backend change makes no new conformance claim. |

## Alternatives

| Option | Pros | Cons |
| --- | --- | --- |
| Recheck before independent writes | Small patch | Another credential-change race remains; audit and issuance can diverge |
| Verify the password while holding the account lock | Simple current-password decision | Expensive hashing occupies a database connection and blocks account writers |
| Verify outside, compare the exact accepted hash and credential epoch under the write lock (selected) | Short transaction; fences password/reset changes; atomic bookkeeping/session/audit | Same-account logins serialize and may receive bounded temporary refusal |
| Add a new credential revision column | Explicit counter | Migration and every-writer adoption are unnecessary for this step; hash plus exact existing epoch already distinguish the accepted source |

Recommended stack: existing password verification outside SQL ownership; immutable
accepted credential facts; existing account write guard; fresh exact hash/epoch
comparison and lockout/enabled checks; new-family issuance; login bookkeeping and
required audit in the same bounded transaction; cookies only after confirmed
commit. Preserve conservative uncertainty without automatic write retries.

The initial credential lookup and failed-login bookkeeping remain separate work.
External-provider/bootstrap/password-change issuance require their own source and
audit contracts; a password proof must not be invented for those callers.

See [design](PASSWORD_LOGIN_DESIGN.md) and [outcome](PASSWORD_LOGIN_OUTCOME.md).
