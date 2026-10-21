# Atomic admin-recovery research — October 2026

Consulted October 21, 2026 through connected MCP search and page opening. These
are primary sources consulted on that date; rolling pages do not establish future
October changes or the installed runtime version.

| Source | Applicable practice | Implementation decision |
| --- | --- | --- |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Database documentation: row locks coordinate competing updates; consistent lock order reduces deadlocks | Maintenance guard before run/account rows; fresh reread after waiting |
| [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | Database documentation: Read Committed statements see newly committed state; atomicity alone does not validate earlier reads | Recheck the original run within the transaction |
| [PostgreSQL 18 date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html) | `NOW()` represents transaction start; `clock_timestamp()` reflects actual current time | Check expiry after lock waits and at consumption |
| [node-postgres transactions](https://node-postgres.com/features/transactions) | Driver documentation: every transaction statement must use the same client | Pass the borrowed client through stores and audit calls |
| [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html?trk=public_post_comment-text) | Informative security guidance: expiring, single-use recovery material; session invalidation and explicit later login | Preserve server budgets, single use, session revocation and no automatic login |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Informative explanation of WCAG 2.2 SC 4.1.3 | Preserve existing mounted status/refusal feedback; completion is reported only after durable work commits |

Combining row ownership, guarded consumption and one transaction is a project
engineering recommendation inferred from these contracts and the reproduced
native failures. W3C does not prescribe database locking. OWASP's email reset
examples do not redefine this operator-armed local recovery flow.

Prefer this bounded stack over a framework, global isolation or dependency
migration. Benefits are atomic state and one-winner semantics; costs are explicit
client propagation, lock ordering and slightly longer database ownership. Hashing
stays outside that ownership. A lost/failed COMMIT response remains uncertain;
do not add automatic POST retries or claim exactly-once response delivery.

See [design tradeoffs](RECOVERY_ATOMIC_DESIGN.md) and
[qualified outcome](RECOVERY_ATOMIC_OUTCOME.md).
