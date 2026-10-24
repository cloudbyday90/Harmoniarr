# Read-only review scope: official research and recommendation

Reviewed October 24, 2026 using the connected Search MCP. URLs were found through
official search/navigation, or re-opened from the previous researched source.
The applicable database is deployed PostgreSQL 18; no upgrade is part of this change.

| Official source and status | Practice / local decision |
| --- | --- |
| PostgreSQL 18 [select lists](https://www.postgresql.org/docs/18/queries-select-lists.html), vendor documentation | Reuse explicit SQL policy projection before transferring/mapping a failed candidate. |
| PostgreSQL 18 [TOAST](https://www.postgresql.org/docs/18/storage-toast.html), vendor documentation | Narrow results do not prove avoided decompression, physical I/O or RSS. |
| OWASP [authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), security guidance | Check current access on every request; signed cursors do not grant access. |
| IETF [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), HTTP standards track | Safe methods are essentially read-only. Chooser GETs publish no domain commands/evidence. |
| W3C [focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) and [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), informative WCAG 2.2 guidance | Preserve keyboard navigation, current focus and persistent feedback through unchanged public page/status behavior; distinguish browser checks from human acceptance. |

## Alternatives and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Keep full failed detail on every chooser page | No wiring change | Repeats unrelated payload/file transfer and mapping; replace this subread |
| Strip detail in JavaScript | Easy DTO change | Still transfers/allocates full results; reject |
| Cache scope or trust the cursor as a certificate | Potentially fewer policy reads | Stale access/policy and added invalidation complexity; reject |
| Use minimal facts for selection too | One reader everywhere | Expands mutation/lock scope beyond this read change; defer |
| Reuse minimal page/qualification reader; retain full selected-command scope | Small ESM change, shared policy, no new state | Explicit field contract, variable required arrays/TOAST and remaining outer work; adopt |

Final recommendation stack: authenticated target resolution → minimal shared SQL
policy facts → current active-run/revision checks → signed actor/target/policy-bound
cursor → bounded eligible-fact scan → existing public status/focus lifecycle. Keep
selection and restart transactions independently authoritative. Prove page/cursor
and policy parity before treating the wiring change as complete.
