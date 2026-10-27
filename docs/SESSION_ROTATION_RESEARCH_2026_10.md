# Session rotation research

Consulted October 27, 2026 using MCP search and official navigation. Applies to
Node 24.22.1, pg 8.23.1 and PostgreSQL 18.6; no dependency upgrade is proposed.

| Official source | Status and application |
| --- | --- |
| [RFC 9700 section 4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html) | IETF Best Current Practice for OAuth. Retained rotation relationships support reuse detection and active-token revocation. Applying that principle to Harmoniarr cookie sessions is an explicit design inference, not OAuth certification. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Vendor documentation. Use consistent ordering and transaction-level advisory locks, automatically released with the transaction. Advisory locking requires every participating writer to cooperate. |
| [PostgreSQL 18 timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html) | Vendor documentation. Keep lock/statement/idle/transaction limits local to this short transaction; retain the application owner deadline and native retirement. |
| [node-postgres transactions](https://node-postgres.com/features/transactions) | Driver documentation. All parent, child, linkage and required audit operations share one client. |
| [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Informative guidance. Session renewal has races; audit lifecycle events without raw credentials. Fresh authority must be checked at the issuer. |
| [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Informative Understanding document. Preserve existing status/focus behavior and fixed errors; no new UI markup or general accessibility claim follows from SQL proof. |

## Alternatives and tradeoffs

| Option | Pros | Cons |
| --- | --- | --- |
| Parent row lock alone | Simple, no new schema | Does not serialize replay of an older ancestor with issuance from a different descendant |
| Account share lock, transaction family lock, parent CAS (selected) | Covers both replay/rotation orderings; existing schema; different families can proceed concurrently | Extra queries and contention; every descendant issuer must participate; strict duplicate refresh can revoke the winner's child |
| Persistent family table/tombstone | Explicit family lifecycle and room for broader revocation policy | Migration/backfill and all-writer adoption; larger change than needed for active-parent issuance |
| Serializable transactions/retries alone | General conflict detection | Requires transaction-wide retries and careful uncertain-commit treatment; does not replace current parent authority |

## Final recommendation stack

1. Reuse bounded ordinary pool admission and one 8-second owned write transaction.
2. Lock the account FOR SHARE, then read its fresh snapshot; acquire a namespaced
   family advisory transaction lock, then lock the exact parent by identity/hash.
3. Recheck enabled account, forced reauthentication, exact parent/family/user/hash,
   current password epoch and expiry. Preserve timestamp microseconds as SQL text.
4. Insert child, revoke/link parent with a conditional update, append required
   rotation audit and recheck expiry before commit. Return secrets only after ack.
5. Replay uses the same account/family order. A second redemption handles replay
   on the same client, commits that security action, then refuses authentication.
6. Root issuance creates a fresh family; callers cannot graft a descendant through
   its optional inputs. Reuse selected metadata validation and fixed unavailable
   errors; never automatically retry an uncertain commit or refresh POST.
7. Apply the existing deployment-controlled CSRF guard to refresh before issuance.
   Existing SameSite/cookie settings remain; permitted opt-out remains explicit.

No new container or service process is needed. Stop older binaries before
adoption: advisory locks cannot fence a nonparticipating legacy issuer.

Scope limits: password verification before root login, login audit publication,
logout/single-session and account-wide revocation ownership remain separate.
Next bind root login to the exact verified password epoch and commit its required
login audit with issuance; a fresh enabled-user read alone cannot prove that a
password verified before a concurrent change is still current.

See [design](SESSION_ROTATION_DESIGN.md) and [outcome](SESSION_ROTATION_OUTCOME.md).
