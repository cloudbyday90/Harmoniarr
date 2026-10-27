# Session replay transaction research

Consulted October 27, 2026 through MCP search and official navigation. Scope:
Harmoniarr cookie sessions on Node 24.22.1, pg 8.23.1 and PostgreSQL 18.6.

## Practices and application

| Official source and status | Applicable behavior |
| --- | --- |
| [IETF RFC 9700, section 4.14.2](https://www.rfc-editor.org/info/rfc9700/) — Best Current Practice for OAuth | Rotation retains relationships so reuse can cause active-token revocation. Harmoniarr uses cookie sessions, not an OAuth authorization server; applying that replay principle here is a design inference. |
| [PostgreSQL 18 client settings](https://www.postgresql.org/docs/18/runtime-config-client.html) — vendor documentation | Use transaction-local lock, statement, idle and transaction timeouts. Lock timeout is shorter than statement timeout; avoid changing all application sessions. |
| [PostgreSQL 18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html) and [error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html) — vendor documentation | READ COMMITTED rechecks an updated target row after contention. Completion/resolution can be unknown; an interrupted commit is not proof of rollback. |
| [node-postgres transactions](https://node-postgres.com/features/transactions) — driver documentation | All revocation and required audit SQL must use the same checked-out client. Pool query calls cannot compose a transaction. |
| [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) — informative security guidance | Record lifecycle and detected invalid activity; exclude raw credentials/session IDs from audit payloads and public errors. |
| [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) — informative Understanding document | Preserve existing surfaced error/status behavior without unnecessary focus movement. This server-only change adds no markup and establishes no new screen-reader or WCAG conformance claim. |

The local finding is concrete: replay revocation previously committed before a
separate audit insert. Audit failure could leave active sessions revoked with no
required event. Ordinary reads already had bounded ownership; these writes did not.

## Alternatives

| Option | Pros | Cons |
| --- | --- | --- |
| Keep independent writes | Small implementation | Partial durable outcome; waits lack a write owner |
| One bounded transaction on the ordinary pool (selected) | Atomic audit/revocation; existing admission; no extra service/container | More round trips, intentional 503 under contention; cannot infer commit outcome after transport loss |
| Background revocation queue | Could outlive request latency | Delays security effect; new durable retry/authorization protocol and deployment complexity |
| Generic query timeout or Promise.race only | Simple caller latency limit | Does not retire native work or distinguish unknown commit; affects unrelated SQL if global |

## Recommended stack

1. Existing bounded pool admission: 5-second connection wait and 64 pending default.
2. One replay-specific READ COMMITTED transaction, with current token/owner/family
   predicates, lock 1s, statement 3s, idle transaction 3s and transaction 5s.
3. An 8-second owner deadline includes checkout and cleanup initiation. Checkpoints
   prevent later writes/commit after expiry; actual native retirement owns capacity.
4. Required audit on the same client, only when active rows changed. Concurrent
   updates recheck the active predicate; repeated completed replay is a no-op.
5. Fixed 503 for failure; no automatic retry after COMMIT dispatch, no claimed
   rollback of an unknown commit, no raw token in events. Browser disconnect does
   not cancel a detected security action; the independent deadline still applies.
6. Validate selected audit metadata before its required insert. Invalid IP text
   and IPv6 zone IDs become null, so attacker-supplied headers cannot force an
   INET conversion error to roll revocation back. Valid syntax grants no trust.

An uncertain commit can contain both revocation and audit or neither. A later
explicit request may observe the durable state; the original owner never retries.
Transaction atomicity does not guarantee revocation succeeds during an outage.

Next: make rotation/issuance participate in compatible family ownership. Existing
rotation uses separate revoke/insert/link statements and a previously resolved
session. This change does not fence a concurrently authorized late child insert.
No advisory lock added to replay alone could fix a nonparticipating writer.

See [design](SESSION_REPLAY_DESIGN.md) and [outcome](SESSION_REPLAY_OUTCOME.md).
