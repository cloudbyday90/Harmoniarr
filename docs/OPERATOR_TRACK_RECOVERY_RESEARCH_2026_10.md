# Two-owner recovery research

Consulted October 12, 2026 through connected MCP search and official navigation.
The separate [design](OPERATOR_TRACK_RECOVERY_DESIGN.md) owns project choices and
tradeoffs; official guidance does not certify this repository or a speedup.

| Official source | Status/applicability | Decision |
| --- | --- | --- |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) | Server reference: cooperating locks, transaction lifetimes and ordered access. | Reuse canonical save, projection/run/lease and row boundaries; current checks and required events share one client. |
| [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) | Informative guidance: bind significant transaction data and check authorization at the final gate. | A saved copy or browser preview cannot grant recipient delivery; recheck full participants, consent, root and actual bytes. |
| [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative guidance: resource/relationship checks and conservative permission decisions. | Private owner/request/scope identities remain distinct from candidate-wide status. |
| [Node 24 filesystem API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html) | Official reference consulted as v24.21.0; installed Node 24.18.1 supports the used APIs. Copies are not promised atomic. | Exclusive existing filesystem service, verified byte witnesses, durable checkpoints and conservative crash gaps. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | IETF Standards Track HTTP semantics; non-idempotent retries need semantic justification. | Resume private delivery through durable apply commands, without treating a copy failure as authority to repeat provider dispatch. |
| [W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/) | Working Draft, September 1, 2026; work in progress. | Monotonic validation observations remain separate from SQL lease authority. No UI change or WCAG conformance claim. |

Reusing bounded JSON checkpoints is a project inference, not a standards mandate.
Indexed receipts and scan-owned invalidation need separate ownership/backfill
design. A historical receipt is not proof that a file still exists in the current
private root. External filesystem writers remain outside SQL locking; later
reconciliation must restore missing requirements without deleting saved intent.
