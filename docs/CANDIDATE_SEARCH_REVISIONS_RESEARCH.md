# Candidate revision research and recommendation stack

Reviewed October 24, 2026 using the connected Search MCP to discover/open official
URLs. PostgreSQL 18 is the deployed major; this work does not upgrade dependencies.

## Official evidence and application

- PostgreSQL [CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html)
  defines statement transition relations and TRUNCATE triggers. Its
  [trigger overview](https://www.postgresql.org/docs/18/trigger-definition.html)
  supports collecting changed sets after a statement. We use distinct sorted
  search keys; trigger writes belong to the candidate transaction.
- PostgreSQL [transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  explains statement snapshots at Read Committed. Two matching revision reads
  detect intervening committed changes, but do not block later commits or certify
  a mutation. Sequence allocation does not establish transactional commit order;
  a durable UUID revision avoids a resettable counter and JavaScript integer loss.
- PostgreSQL [explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  explains row contention, transaction lock lifetime and consistent lock ordering.
  AFTER-trigger revision locks can interact with prelocked candidate rows. Sorting
  search keys in one statement does not solve arbitrary multi-statement cycles.
- OWASP [authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  calls for server-side permission checks on each request. A signed navigation
  context remains separate from current selection/restart authorization.
- W3C [status messages guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  explains announcing changing results without requiring focus. Existing cursor
  refresh/status handling is retained and exercised in the browser; automated
  evidence does not complete the deferred screen-reader/device acceptance.

These are our architectural applications of the sources, not standards prescribing
Harmoniarr-specific revisions or certifying whole-application conformance.

## Alternatives and tradeoffs

| Option | Benefits | Costs / decision |
| --- | --- | --- |
| Process-local cache or signed empty walk alone | Small implementation; cheap reads | Misses committed writers/restarts and stale policy; reject for authority |
| Service-only revision increments | Explicit application flow | Six writer modules plus direct SQL/upsert/cascades can escape; reject |
| Row triggers | No transition relation materialization | Revision work per changed row; unnecessary bulk write amplification |
| Statement triggers and durable UUID revisions | Atomic coverage; one rotation per affected search per statement; indexed reads | Transition storage, retained rows and same-search writer contention; adopt for browsing |
| Immediate cached restart authorization | Potentially bounds command scans | Lock inversion and stale actor/policy/phantom hazards unresolved; defer |
| Existing operation-run qualification plus coordinated command protocol | Built-in durable progress; bounded steps and replay ownership | Requires concurrency, retention and starvation qualification; next recommendation |

Final stack: PostgreSQL transactional statement triggers and UUID revisions;
small ESM revision store; existing SHA-256 context/HMAC cursor with before/after
revision checks; existing W3C-aligned refresh/status path; independent fresh
transactional selection/restart guards. Next, use existing operation runs for
bounded qualification only after the writer/command locking protocol is proven.
