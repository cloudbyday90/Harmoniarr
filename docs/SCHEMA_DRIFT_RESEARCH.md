# Read-only schema drift research — October 26, 2026

## Official evidence

Sources were discovered through the connected search MCP service and opened.
Recommendations below apply that evidence to Harmoniarr; they do not claim a full
security/accessibility audit or semantic equivalence of arbitrary SQL.

- [PostgreSQL transaction modes](https://www.postgresql.org/docs/18/sql-set-transaction.html)
  prohibit permanent schema/data mutation in read-only transactions. Inference:
  use an explicit read-only transaction and a restricted role for diagnostics;
  read-only mode is not a sandbox for untrusted SQL or external effects.
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html)
  support nonwaiting shared transaction locks, automatically released when the
  transaction ends. Inference: reuse the existing two-integer preparation key;
  concurrent readers coexist, while participating preparers and observers refuse
  conflicting admission without waiting. No business maintenance row is written.
- [PostgreSQL consistency guidance](https://www.postgresql.org/docs/18/applevel-consistency.html)
  explains the stale-snapshot risk when a repeatable-read snapshot predates a lock.
  Inference: explicitly select Read Committed, acquire the shared fence before
  reading lineage/catalog facts, and avoid claiming coherence against external
  actors that ignore the application lock.
- [PostgreSQL client defaults](https://www.postgresql.org/docs/18/runtime-config-client.html)
  distinguish lock, statement and transaction timeouts. Apply local 2/5/15-second
  limits, plus a five-second idle-transaction limit, instead of changing global
  settings. These are server-work limits, not end-to-end transport deadlines.
- [node-postgres transactions](https://node-postgres.com/features/transactions)
  require a single client. Hold one captured client through observation and
  acknowledged ROLLBACK; discard unknown/disconnected sessions without retry.
- [OWASP database security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html)
  recommends least privilege. Native validation uses a non-superuser without
  create-role/database authority and only public-schema usage plus ledger SELECT.
  Catalog definitions are compared privately; output contains approved counts and
  anchor identities rather than raw definitions or database error material.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  apply to programmatic announcements of markup status changes. This CLI change
  adds no markup. Any later administrator UI integration should announce result
  changes without stealing focus and distinguish unavailable from clean status.
- [GitHub Dependabot management](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/manage-dependabot-prs)
  documents automatic rebasing and its 30-day limit. GitHub MCP found no open
  repository PRs, including Dependabot PRs; no stale cleanup/rebase or random local
  PR application was applicable. No PR was merged.

## Alternatives and recommended stack

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Ledger-only diagnostic | Small, existing command remains compatible | Cannot detect same-lineage structural drift | Retain for lineage; add a separate command |
| Automatically repair drift | Could restore a known shape | Requires mutation authority; risks destroying intentional state or evidence | Reject |
| Read-only scan without preparation fence | No lock coordination | Can combine facts from an in-progress participating preparation | Reject for this command |
| Bounded read-only scan with shared preparation fence | Restricted-role operation, private comparison, concurrent readers, immediate contention refusal | Can briefly cause a preparer to return busy; relies on cooperative actors | Adopt |
| Fail every existing startup on anchor differences | Early detection | Broad deployment compatibility change before observation evidence | Defer |

Final stack: trusted packaged contract → captured idle client → explicit Read
Committed/Read Only → local server limits → nonwaiting shared preparation fence
→ bounded ledger and 164 catalog facts → separate lineage/drift projection →
acknowledged ROLLBACK → names-only CLI output. Keep repair and startup admission
separate. No additional application, service, schema object or dependency is needed.
