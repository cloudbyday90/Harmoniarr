# Candidate query plans: research, tradeoffs and stack

Official sources discovered and opened through Search MCP on October 24, 2026.

[PostgreSQL 18 multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html)
describes leading equality columns followed by a range column as an effective
B-tree access pattern. Our design inference is a search-ID equality followed by
the UUID cursor boundary, with the pending/held subset retained in the index.

[PostgreSQL 18 EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html) documents
actual execution/buffer evidence, prepared-plan inspection and the incompatibility
of GENERIC_PLAN with ANALYZE. Use EXPLAIN ANALYZE on EXECUTE with a transaction-local
forced cache mode instead. Treat emitted rows separately from scanned rows and
avoid adding overlapping plan-node buffer totals.

The [official PostgreSQL 18 manual](https://www.postgresql.org/files/documentation/pdf/18/postgresql-18-US.pdf)
explains partial-predicate implication at planning time. Keep the status predicate
literal while source and UUID values remain bound parameters. A [maintainer
clarification](https://www.postgresql.org/message-id/12809.1581698554@sss.pgh.pa.us)
explains why custom plans can use concrete parameter values; forced generic cases
are a distinct qualification lane, not a claim about the current driver default.

[CREATE INDEX guidance](https://www.postgresql.org/docs/current/sql-createindex.html)
distinguishes ordinary write-blocking builds inside transactions from concurrent
builds that cannot run in a transaction block. Retain the platform's transactional
startup migration path and record its startup/write-lock cost.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
supports programmatic feedback without focus movement. This store-only change
preserves the existing detail, continuation and focus/status contracts; rendered
regression checks supplement the still-deferred manual assistive-technology work.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Query-shape change alone | Removes generic nullable-OR filtering | Lacks a scoped status/UUID index | Insufficient |
| Partial index alone | Smaller active subset; helps sparse custom reads | Generic anchor can remain a filter over the entire source | Insufficient |
| Partial index plus direct parameterized boundary | Ordered scoped range; preserves policy owners | Storage, write maintenance and startup index build | Adopt |
| Cover the normalized JSON payload | Could reduce heap visits | Wide index, write amplification and payload growth | Reject |
| Force index scans globally | Predictable chosen scan type | Can hurt dense/small queries and other consumers | Reject |
| Concurrent index migration | Allows writes during build | Requires different transaction/lifecycle ownership | Defer |

## Final recommendation stack

Existing Vue/W3C status and focus contract; existing authenticated detail service
and shared eligibility/scanner; narrow ESM SQL builder/store; additive partial
PostgreSQL B-tree and schema anchor; independent fresh transactional commands.
Keep public facts/cursors unchanged. Use controlled plan evidence and functional
tests together; no benchmark result grants access or replaces current authority.
