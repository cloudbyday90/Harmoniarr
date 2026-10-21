# Recovery operator lifecycle research — October 2026

Consulted October 21, 2026 using connected MCP search and page opening. Rolling
documentation is evidence consulted on that date, not future October guidance.

| Primary source | Status and applicable practice | Project decision |
| --- | --- | --- |
| [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html) | PostgreSQL 18 documentation: unique indexes can enforce uniqueness over a predicate-selected subset | One armed row, with terminal history retained |
| [PostgreSQL advisory lock functions](https://www.postgresql.org/docs/18/functions-admin.html) | Transaction advisory ownership waits and ends with its transaction | Serialize lifecycle admission even when the table has no armed row |
| [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Consistent lock ordering and transaction-scoped ownership | Maintenance guard before lifecycle and run locks |
| [node-postgres transactions](https://node-postgres.com/features/transactions) | Driver documentation: one client must own all statements in a transaction | Pass queryable through state changes and audit calls |
| [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html?trk=public_post_comment-text) | Informative security guidance: single-use, expiring recovery material | Atomic replacement/cancellation; no plaintext in stored runs or diagnostic logs |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Informative explanation of WCAG 2.2 SC 4.1.3 | Preserve truthful durable-outcome feedback and the mounted browser status/refusal owner |

The combined advisory/row/index design is an engineering inference from those
contracts and the reproduced failures. W3C does not specify database locking.
This operator-armed local-admin flow differs from email-based reset examples.

Benefits are atomic rollback, one-active-run enforcement and predictable command
refusals. Costs are an additive migration, brief database ownership and deliberate
operator review when historical data is ambiguous. A lost commit acknowledgement
or failed CLI secret output remains uncertain; no automatic retry is recommended.
No dependency or global isolation upgrade is needed. See
[design tradeoffs](RECOVERY_LIFECYCLE_DESIGN.md) and
[qualified outcome](RECOVERY_LIFECYCLE_OUTCOME.md).
