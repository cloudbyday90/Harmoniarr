# Restart qualification research and recommendation stack

Official sources discovered/opened through the Search MCP on October 24, 2026.
The deployed PostgreSQL major remains 18; no dependency upgrade is part of this work.

- PostgreSQL [SELECT](https://www.postgresql.org/docs/18/sql-select.html) defines
  NOWAIT failure on a busy row and warns that it does not cover table locks.
  SKIP LOCKED produces an inconsistent view. Our inference: use immediate failure
  for the final revision fence, plus a local lock timeout; never skip unknown rows
  to infer absence.
- PostgreSQL [locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  describes transaction-held row locks, deadlocks and consistent ordering. Apply
  current canonical locks first, then a nonwaiting revision fence, followed by
  no more candidate locks. Tests must prove the actual inversion is refused.
- PostgreSQL [isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  explains per-statement Read Committed snapshots. Force that isolation before
  current-scope reads and use a durable revision as equality evidence across
  bounded steps. A snapshot or historical empty page is not command authority.
- OWASP [resource consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  recommends server-side operation limits. Bound facts per request/claim, active
  admission, progress retention, invalidations and lifetime; retain rate limits.
- OWASP [authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires current server-side checks. Revalidate original actor and all recipients
  at publication; a queued request, signed cursor or lease alone grants no action.
- W3C [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains announcing asynchronous changes without moving focus. Distinguish
  checking from queued search, preserve explicit controls and reuse existing
  persistent polite status. Automated tests do not certify assistive technology.

## Options

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Keep full command traversal | Simple current recheck | Unbounded facts/lock lifetime; replace for measured-review restarts |
| Trust completed browser walk | Cheap command | Historical/client state misses current writes and policy; reject |
| Lock revision before canonical candidate locks | Stable revision | Reproduced writer inversion; reject |
| Serializable full scan | Strong transaction semantics | Still scans all candidates and needs whole-transaction retries; defer |
| Bounded operation-run progress plus final NOWAIT fence | Built-in durability, bounded windows, atomic intent/audit and explicit contention refusal | More lifecycle/state handling; churn can reset or expire work; adopt |

Final stack: existing PostgreSQL candidate revisions; indexed nonlocking keysets;
modular ESM policy/store/service/worker files; existing owned operation runs and
leases; canonical current authority followed by NOWAIT revision fencing; atomic
intent/audit/completion; existing W3C-aligned status and mutation lifecycle.
