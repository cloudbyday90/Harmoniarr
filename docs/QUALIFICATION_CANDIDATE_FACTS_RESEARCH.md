# Failed-candidate fact and lock research

Reviewed October 24, 2026 through the connected Search MCP. Official URLs were
discovered/opened through search or links in the returned official documentation.
The application remains on its deployed PostgreSQL 18/ESM stack.
PostgreSQL links are vendor documentation; OWASP is application-security guidance.
The W3C Understanding page is informative guidance for the WCAG status-message
criterion. This increment makes no general standards-conformance claim.

- PostgreSQL [SELECT](https://www.postgresql.org/docs/18/sql-select.html) and
  [row locking](https://www.postgresql.org/docs/18/explicit-locking.html) distinguish
  FOR UPDATE and NO KEY UPDATE compatibility. Our application decision is to
  remove child locks while retaining parent FOR UPDATE, because weaker locking
  would also change foreign-key insert serialization beyond the audited inputs.
- PostgreSQL [WITH materialization](https://www.postgresql.org/docs/18/queries-with.html)
  explains when a CTE can be folded or evaluated separately. A one-row materialized
  boundary keeps explicit saved subtrees available to the outer projection.
  This is a local query choice, not a general recommendation to materialize CTEs.
- PostgreSQL [TOAST](https://www.postgresql.org/docs/18/storage-toast.html) describes
  compressed/out-of-line values. Selecting a JSONB field can still require stored
  value processing. Reduced result bytes do not establish lower RSS or a universal
  disk-I/O/latency improvement.
- OWASP [authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  calls for current server-side permission checks. Shared policy/guard factories
  preserve those checks; a smaller record must not omit ownership, numeric floors,
  consent state or presence-based invalidation.
- W3C [status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  remains applicable to asynchronous checking. Public checking/queued state,
  persistent status and focus behavior stay on the existing mutation lifecycle;
  automated regressions are separate from deferred human assistive-device proof.

## Alternatives

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Keep full detail and child locks | Existing behavior | Repeated irrelevant transfer, mapping and locks per bounded step; replace for qualification |
| Load full detail then strip in JavaScript | Small code edit | Still transfers/allocates full payload and files; reject |
| Change every quality-review action to minimal facts | One access path | Broadens selection scope; defer until separately qualified |
| Weaken parent lock to NO KEY UPDATE | Permits more FK writers | Changes review-evidence insertion concurrency; reject this round |
| Dedicated SQL projection and parent-only FOR UPDATE, shared reader/guard factories | Small authoritative record, no child enumeration, preserved policy and parent publication boundary | Maintained field contract, possible TOAST cost, required arrays still variable; adopt |

Final recommendation stack: dedicated ESM SQL fact store; one shared scope-policy
reader and one current-guard factory; explicit qualification entry point with
parent-only FOR UPDATE; existing bounded windows, owned operation runs, NOWAIT
revision fencing and atomic intent/audit/completion. Keep downstream selection,
claim, quality and transfer checks. Qualify policy parity and real lock behavior
before treating a narrower projection as authoritative.
